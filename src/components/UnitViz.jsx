// 單元牆的兩個進階檢視：圓圈嵌套（潛入式層級）與星系（力導向）。
// 只用 d3 的純計算模組（hierarchy/force/interpolate），渲染與動畫自己來 — 不引入 d3-selection。
import { useEffect, useMemo, useRef, useState } from 'react'
import { hierarchy, pack } from 'd3-hierarchy'
import { forceSimulation, forceLink, forceManyBody, forceRadial, forceCollide } from 'd3-force'
import { interpolateZoom } from 'd3-interpolate'
import { useStore } from '../store/StoreContext.jsx'
import { unitsOf, unitStats, pageTree, reqsOfPage, looseReqs, statusOfReq } from '../lib/units.js'

const REQC = ['#7BA7D4', '#9CBD48', '#E0A55C'] // 待確認 / 已蓋章 / 異動
const STNAME = ['待確認', '已蓋章', '異動中']

// 專案 → 單元 → 頁（含子頁）→ 需求 的階層資料（兩個檢視共用）
function useHierData() {
  const { current } = useStore()
  return useMemo(() => {
    const pageNode = (n) => ({
      name: n.wf.name,
      children: [
        ...reqsOfPage(current, n.wf).map((r) => ({ name: r.name, req: true, st: statusOfReq(r), value: 1 })),
        ...n.kids.map(pageNode),
      ],
    })
    return {
      name: current.name || '專案',
      children: unitsOf(current).map((u) => {
        const s = unitStats(current, u)
        return {
          name: u, unit: true, hot: s.chg > 0 || s.miss > 0,
          children: [
            ...pageTree(current, u).map(pageNode),
            ...looseReqs(current, u).map((r) => ({ name: r.name, req: true, st: statusOfReq(r), value: 1 })),
          ],
        }
      }),
    }
  }, [current])
}

function ReqCard({ info }) {
  if (!info) return null
  return (
    <div className="uv-card" key={info.key}>
      <span className={'uw-rq uw-st' + info.st}>{STNAME[info.st]}</span>
      <b>{info.name}</b>
      <small>{info.path}</small>
    </div>
  )
}

// ── 圓圈嵌套：點泡泡潛入下一層，麵包屑逐段可點，點彩色泡泡看需求 ──
export function PackView() {
  const data = useHierData()
  const wrapRef = useRef(null)
  const [size, setSize] = useState(440)
  useEffect(() => { if (wrapRef.current) setSize(Math.min(wrapRef.current.clientWidth || 440, 480)) }, [])
  const root = useMemo(() =>
    pack().size([size, size]).padding(5)(
      hierarchy(data).sum((d) => d.value || 0)
        .sort((a, b) => (b.value - a.value) || ((a.data.st ?? 0) - (b.data.st ?? 0)))),
  [data, size])
  const [focus, setFocus] = useState(root)
  const [view, setView] = useState([root.x, root.y, root.r * 2.15])
  const [card, setCard] = useState(null)
  const animRef = useRef(0)
  // 資料重算後 root 是新物件 — 對回同名節點，找不到就回頂層
  useEffect(() => {
    const path = []
    let f = focus
    while (f && f.parent) { path.unshift(f.data.name); f = f.parent }
    let node = root
    for (const nm of path) {
      const hit = (node.children || []).find((c) => c.data.name === nm)
      if (!hit) break
      node = hit
    }
    setFocus(node)
    setView([node.x, node.y, node.r * 2.15])
  }, [root]) // eslint-disable-line
  const zoomTo = (node) => {
    setCard(null)
    setFocus(node)
    const target = [node.x, node.y, node.r * 2.15]
    const ip = interpolateZoom(view, target)
    const t0 = performance.now()
    cancelAnimationFrame(animRef.current)
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 520)
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
      setView(ip(e))
      if (p < 1) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }
  const k = size / view[2]
  const pos = (d) => `translate(${(d.x - view[0]) * k},${(d.y - view[1]) * k})`
  const nodes = root.descendants().slice(1)
  const anc = focus.ancestors().reverse()
  return (
    <div ref={wrapRef} className="uv-wrap">
      <div className="uv-crumb">
        {anc.map((a, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span className="uv-sep">›</span>}
            <button className={'uv-seg' + (a === focus ? ' now' : '')} onClick={() => a !== focus && zoomTo(a)}>{a.data.name}</button>
          </span>
        ))}
      </div>
      <svg viewBox={[-size / 2, -size / 2, size, size].join(' ')} style={{ width: '100%', display: 'block', cursor: 'pointer' }}
        onClick={() => { setCard(null); if (focus.parent) zoomTo(focus.parent) }}>
        <defs>
          <radialGradient id="uvUnit" cx="35%" cy="30%"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="100%" stopColor="#EDF4DC" /></radialGradient>
          <radialGradient id="uvHot" cx="35%" cy="30%"><stop offset="0%" stopColor="#FFFBF2" /><stop offset="100%" stopColor="#F8E6C8" /></radialGradient>
        </defs>
        {nodes.map((d, i) => {
          const vis = d.parent === focus ? 1 : (d.parent && d.parent.parent === focus) ? 0.2 : 0
          return (
            <circle key={i} transform={pos(d)} r={d.r * k}
              fill={d.data.req ? REQC[d.data.st] : d.depth === 1 ? (d.data.hot ? 'url(#uvHot)' : 'url(#uvUnit)') : 'rgba(255,255,255,0.5)'}
              fillOpacity={d.data.req ? 0.92 : 1}
              stroke={d.data.req ? '#fff' : d.depth === 1 ? (d.data.hot ? 'rgba(224,134,60,0.6)' : 'rgba(58,93,37,0.32)') : 'rgba(58,93,37,0.2)'}
              strokeWidth={d.data.req ? 1.4 : 1.2}
              style={{ opacity: vis, transition: 'opacity .4s', pointerEvents: d.parent === focus ? 'auto' : 'none' }}
              onClick={(e) => {
                e.stopPropagation()
                if (d.data.req) {
                  setCard({ key: Math.random(), name: d.data.name, st: d.data.st, path: d.ancestors().reverse().slice(1, -1).map((a) => a.data.name).join(' › ') })
                  return
                }
                if (d.children) zoomTo(d)
              }} />
          )
        })}
        {focus.parent && <circle className="uv-focring" r={size / 2.15 + 9} fill="none" stroke="rgba(156,189,72,0.75)" strokeWidth="1.6" strokeDasharray="2 9" strokeLinecap="round" />}
        {nodes.filter((d) => d.parent === focus).map((d, i) => {
          const rk = d.r * k
          const nm = d.data.name
          if (d.data.unit) {
            const small = rk < 34
            return (
              <text key={'t' + i} transform={pos(d)} textAnchor="middle" fill="#22301F" style={{ fontWeight: 900, pointerEvents: 'none' }}>
                <tspan x="0" dy={small ? 3 : -2} style={{ fontSize: small ? 9.5 : 12.5 }}>{small && nm.length > 5 ? nm.slice(0, 4) + '…' : nm.slice(0, 6)}</tspan>
                {!small && <tspan x="0" dy="13" style={{ fontSize: 9.5, fontWeight: 600 }} fill="#56684C">{d.value} 需求</tspan>}
              </text>
            )
          }
          const per = rk < 42 ? 5 : 7
          const lines = (nm.match(new RegExp(`.{1,${per}}`, 'g')) || ['']).slice(0, 2)
          const fs = d.data.req ? Math.max(8.5, Math.min(10.5, rk * 0.24)) : Math.max(9, Math.min(11.5, rk * 0.2))
          return (
            <text key={'t' + i} transform={pos(d)} textAnchor="middle" fill="#22301F"
              style={{ fontSize: fs, fontWeight: d.data.req ? 600 : 700, pointerEvents: 'none' }}>
              {lines.map((ln, j) => (
                <tspan key={j} x="0" dy={j === 0 ? (lines.length > 1 ? -2.5 : 3.5) : 11}>
                  {j === 1 && nm.length > per * 2 ? ln.slice(0, per - 1) + '…' : ln}
                </tspan>
              ))}
            </text>
          )
        })}
      </svg>
      <ReqCard info={card} />
      <div className="uw-legend" style={{ justifyContent: 'center' }}>
        <span><i style={{ background: '#7BA7D4' }} />待確認</span>
        <span><i style={{ background: '#9CBD48' }} />已蓋章</span>
        <span><i style={{ background: '#E0A55C' }} />異動中</span>
      </div>
    </div>
  )
}

// ── 星系：軌道結構＋星座聚焦＋能量脈波（微妙版） ──
export function GalaxyView() {
  const data = useHierData()
  const wrapRef = useRef(null)
  const svgRef = useRef(null)
  const [card, setCard] = useState(null)
  const [focusUnit, setFocusUnit] = useState(null)
  const world = useMemo(() => {
    const nodes = [], links = []
    let nid = 0
    ;(function add(d, depth, parent) {
      const n = { id: nid++, name: d.name, depth, req: d.req, st: d.st, hot: d.hot, parent,
        r: depth === 0 ? 20 : d.req ? 4.5 : depth === 1 ? 13 : 7 }
      n.rootUnit = depth === 1 ? n : (parent ? parent.rootUnit : null)
      nodes.push(n)
      if (parent) links.push({ source: parent.id, target: n.id })
      ;(d.children || []).forEach((c) => add(c, depth + 1, n))
    })(data, 0, null)
    const R = [0, 96, 162, 214, 244]
    const units = nodes.filter((d) => d.depth === 1)
    units.forEach((n, i) => {
      const a = i / Math.max(1, units.length) * Math.PI * 2 - Math.PI / 2
      n.x = Math.cos(a) * R[1]; n.y = Math.sin(a) * R[1]
    })
    nodes.forEach((n) => {
      if (n.depth > 1 && n.rootUnit) {
        const f = R[Math.min(n.depth, 4)] / R[1]
        n.x = n.rootUnit.x * f + (Math.random() - 0.5) * 30
        n.y = n.rootUnit.y * f + (Math.random() - 0.5) * 30
      }
    })
    // 專案活力＝定案程度：已蓋章比例越高（未定案越少），星系游得越有勁
    const reqLeaves = nodes.filter((n) => n.req)
    const vitality = reqLeaves.length ? reqLeaves.filter((n) => n.st === 1).length / reqLeaves.length : 0.5
    return { nodes, links, R, vitality }
  }, [data])
  const W = 440, H = 500
  const simRef = useRef(null)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const { nodes, links, R, vitality } = world
    const vit = 0.35 + vitality * 2.8 // 活力係數：全未定案≈慵懶 0.35，全蓋章≈3.15 三倍速游動
    const warm = 0.02 + vitality * 0.08
    const lineEls = [...svg.querySelectorAll('[data-link]')]
    const nodeEls = [...svg.querySelectorAll('[data-node]')]
    const haloEls = [...svg.querySelectorAll('[data-halo]')]
    const textEls = [...svg.querySelectorAll('[data-label]')]
    // 生物感：模擬永不冷卻（alphaTarget 保溫）＋ 每顆星各自的緩慢游動（隨機相位微擾）
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    nodes.forEach((n) => {
      n.ph = Math.random() * Math.PI * 2
      n.sp = (0.00025 + Math.random() * 0.0004) * (1 + vitality * 2)
      n.amp = n.depth === 0 ? 0 : n.req ? 0.022 : 0.013
    })
    // 水母鐘形搏動：整個軌道半徑隨呼吸收縮-舒張，外環起伏比內環大
    const radial = forceRadial((d) => R[Math.min(d.depth, 4)]).strength((d) => d.depth === 1 ? 0.5 : 0.16)
    const sim = forceSimulation(nodes)
      .velocityDecay(0.5)
      .force('link', forceLink(links).id((d) => d.id).distance((l) => l.target.req ? 15 : 38).strength(0.55))
      .force('charge', forceManyBody().strength(-52))
      .force('radial', radial)
      .force('collide', forceCollide((d) => d.r + 2.5))
      .force('wander', reduced ? null : () => {
        const t = performance.now()
        // 鐘形呼吸：慢週期整體收放（外圈幅度大），傘緣再帶相位差的蕩漾；幅度與節奏隨活力縮放
        const bellSpeed = 0.0006 + vitality * 0.0016
        const bell = Math.sin(t * bellSpeed)
        radial.radius((d) => {
          const depth = Math.min(d.depth, 4)
          const sway = Math.sin(t * bellSpeed + d.ph * 1.4) * 0.025 * vit * (depth >= 3 ? 1 : 0.4)
          return R[depth] * (1 + bell * 0.03 * vit * depth + sway)
        })
        if (!pausedRef.current) {
          for (const n of nodes) {
            n.vx += Math.cos(t * n.sp + n.ph) * n.amp * vit
            n.vy += Math.sin(t * n.sp * 0.83 + n.ph * 1.7) * n.amp * vit
          }
        }
      })
      .on('tick', () => {
        // 泳池邊界：游到框邊就柔性折返，永遠留在可閱覽範圍內
        const bx = W / 2 - 14, by = H / 2 - 14
        for (const n of nodes) {
          if (n.x < -bx) { n.x = -bx; n.vx = Math.abs(n.vx) * 0.5 }
          else if (n.x > bx) { n.x = bx; n.vx = -Math.abs(n.vx) * 0.5 }
          if (n.y < -by) { n.y = -by; n.vy = Math.abs(n.vy) * 0.5 }
          else if (n.y > by) { n.y = by; n.vy = -Math.abs(n.vy) * 0.5 }
        }
        links.forEach((l, i) => {
          const e = lineEls[i]; if (!e) return
          e.setAttribute('x1', l.source.x); e.setAttribute('y1', l.source.y)
          e.setAttribute('x2', l.target.x); e.setAttribute('y2', l.target.y)
        })
        nodes.forEach((n, i) => {
          const e = nodeEls[i]; if (!e) return
          e.setAttribute('cx', n.x); e.setAttribute('cy', n.y)
        })
        haloEls.forEach((e) => {
          const n = nodes[+e.dataset.halo]
          e.setAttribute('cx', n.x); e.setAttribute('cy', n.y)
        })
        textEls.forEach((e) => {
          const n = nodes[+e.dataset.label]
          e.setAttribute('x', n.x); e.setAttribute('y', n.y - n.r - 5)
        })
      })
    // 能量脈波：核心漣漪外擴，星體與連線依距離微微亮起
    const tween = (fn, dur, delay) => setTimeout(() => {
      const t0 = performance.now()
      const step = (t) => { const p = Math.min(1, (t - t0) / dur); fn(p); if (p < 1) requestAnimationFrame(step) }
      requestAnimationFrame(step)
    }, delay)
    const pulse = () => {
      const maxR = Math.hypot(W, H) / 2
      const dur = 1500, speed = maxR / dur
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', 'rgba(156,189,72,0.28)'); ring.setAttribute('stroke-width', '1.4')
      svg.querySelector('[data-wave]').appendChild(ring)
      tween((p) => {
        ring.setAttribute('r', 8 + (maxR - 8) * (1 - Math.pow(1 - p, 3)))
        ring.setAttribute('stroke-opacity', String(0.28 * (1 - p)))
        if (p === 1) ring.remove()
      }, dur, 0)
      nodes.forEach((n, i) => {
        const e = nodeEls[i]; if (!e) return
        const delay = Math.hypot(n.x, n.y) / speed
        tween((p) => {
          const s = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7
          e.setAttribute('r', String(n.r * (1 + s * (n.req ? 0.3 : 0.1))))
        }, 700, delay)
      })
    }
    if (!reduced) sim.alphaTarget(warm) // 保溫程度隨活力：定案越多越有勁
    sim.__warm = reduced ? 0 : warm
    simRef.current = sim
    const first = setTimeout(pulse, 900)
    const iv = setInterval(pulse, Math.round(7000 - vitality * 2600))
    return () => { sim.stop(); simRef.current = null; clearTimeout(first); clearInterval(iv) }
  }, [world])
  // 查看即暫停：打開需求卡或聚焦星座時，星系緩緩停下讓你細看；放開（點空白）恢復流動
  const pausedRef = useRef(false)
  useEffect(() => {
    const s = simRef.current
    const paused = !!(card || focusUnit)
    pausedRef.current = paused
    if (!s) return
    if (paused) s.alphaTarget(0)
    else if (s.__warm) s.alphaTarget(s.__warm).restart()
  }, [card, focusUnit])
  // 拖曳：把手＝星球本身；只有星球鎖手勢
  const dragRef = useRef(null)
  const toSvg = (e) => {
    const svg = svgRef.current
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse())
    return pt
  }
  const inSub = (d) => !focusUnit || d.depth === 0 || (d.rootUnit && d.rootUnit.name === focusUnit)
  return (
    <div ref={wrapRef} className="uv-wrap">
      <svg ref={svgRef} viewBox={[-W / 2, -H / 2, W, H].join(' ')} style={{ width: '100%', display: 'block' }}
        onClick={() => { setFocusUnit(null); setCard(null) }}>
        <defs>
          <radialGradient id="gvCore"><stop offset="0%" stopColor="#5C8A38" /><stop offset="65%" stopColor="#3A5D25" /><stop offset="100%" stopColor="#2A4519" /></radialGradient>
          <radialGradient id="gvStar"><stop offset="0%" stopColor="#F6FBD6" /><stop offset="55%" stopColor="#D7E693" /><stop offset="100%" stopColor="#AECA58" /></radialGradient>
          <radialGradient id="gvHot"><stop offset="0%" stopColor="#FFF6E4" /><stop offset="55%" stopColor="#F3D7A4" /><stop offset="100%" stopColor="#E2A75F" /></radialGradient>
          <radialGradient id="gvHalo"><stop offset="0%" stopColor="#C6DC6A" stopOpacity="0.45" /><stop offset="100%" stopColor="#C6DC6A" stopOpacity="0" /></radialGradient>
          <radialGradient id="gvHaloH"><stop offset="0%" stopColor="#E0863C" stopOpacity="0.4" /><stop offset="100%" stopColor="#E0863C" stopOpacity="0" /></radialGradient>
        </defs>
        <g data-wave />
        <g>
          {world.links.map((l, i) => (
            <line key={i} data-link
              stroke={!focusUnit || (l.target.rootUnit && l.target.rootUnit.name === focusUnit) ? 'rgba(58,93,37,0.22)' : 'rgba(58,93,37,0.06)'}
              strokeWidth="1" style={{ transition: 'stroke .25s' }} />
          ))}
        </g>
        <g>
          {world.nodes.map((n, i) => n.depth <= 1 && (
            <circle key={i} data-halo={i} r={n.depth === 0 ? 46 : n.hot ? 34 : 27}
              fill={n.depth === 0 ? 'url(#gvHalo)' : n.hot ? 'url(#gvHaloH)' : 'url(#gvHalo)'}
              className={n.hot ? 'uv-halopulse' : undefined}
              style={{ pointerEvents: 'none', opacity: inSub(n) ? 1 : 0.1, transition: 'opacity .25s' }} />
          ))}
        </g>
        <g>
          {world.nodes.map((n, i) => (
            <circle key={i} data-node={i} r={n.r}
              fill={n.req ? REQC[n.st] : n.depth === 0 ? 'url(#gvCore)' : n.depth === 1 ? (n.hot ? 'url(#gvHot)' : 'url(#gvStar)') : 'rgba(255,255,255,0.96)'}
              stroke={n.req ? '#fff' : 'rgba(58,93,37,0.35)'} strokeWidth="1"
              style={{ cursor: 'grab', touchAction: 'none', opacity: inSub(n) ? 1 : 0.13, transition: 'opacity .25s' }}
              onPointerDown={(e) => {
                e.stopPropagation()
                e.currentTarget.setPointerCapture(e.pointerId)
                dragRef.current = { n, moved: false }
              }}
              onPointerMove={(e) => {
                const d = dragRef.current
                if (!d || d.n !== n) return
                d.moved = true
                const p = toSvg(e)
                n.fx = p.x; n.fy = p.y
                simRef.current?.alphaTarget(0.3).restart()
              }}
              onPointerUp={(e) => {
                const d = dragRef.current
                dragRef.current = null
                n.fx = null; n.fy = null
                simRef.current?.alphaTarget(pausedRef.current ? 0 : (simRef.current.__warm ?? 0.03))
                if (d && !d.moved) {
                  e.stopPropagation()
                  if (n.req) {
                    const path = []
                    let p = n.parent
                    while (p && p.depth > 0) { path.unshift(p.name); p = p.parent }
                    setCard({ key: Math.random(), name: n.name, st: n.st, path: path.join(' › ') })
                  } else if (n.depth === 1) {
                    setFocusUnit((f) => f === n.name ? null : n.name)
                  } else setFocusUnit(null)
                }
              }}
              onPointerCancel={() => { dragRef.current = null; n.fx = null; n.fy = null; simRef.current?.alphaTarget(pausedRef.current ? 0 : (simRef.current.__warm ?? 0.03)) }} />
          ))}
        </g>
        <g style={{ pointerEvents: 'none' }}>
          {world.nodes.map((n, i) => (n.depth >= 1 && n.depth <= 2 && !n.req) && (
            <text key={i} data-label={i} textAnchor="middle" fill="#22301F"
              style={{
                fontSize: n.depth === 1 ? 11 : 9.5,
                fontWeight: n.depth === 1 ? 900 : 700,
                opacity: n.depth === 1 ? (inSub(n) ? 1 : 0.15) : (focusUnit && n.rootUnit && n.rootUnit.name === focusUnit ? 1 : 0),
                transition: 'opacity .25s',
              }}>{n.name}</text>
          ))}
        </g>
      </svg>
      <ReqCard info={card} />
      <div className="uw-legend" style={{ justifyContent: 'center' }}>
        <span><i style={{ background: '#3A5D25', borderRadius: '50%' }} />專案</span>
        <span><i style={{ background: '#C6DC6A', borderRadius: '50%' }} />單元</span>
        <span><i style={{ background: '#fff', border: '1px solid rgba(58,93,37,.35)', borderRadius: '50%' }} />頁面</span>
        <span><i style={{ background: '#7BA7D4', borderRadius: '50%' }} />待確認</span>
        <span><i style={{ background: '#9CBD48', borderRadius: '50%' }} />已蓋章</span>
        <span><i style={{ background: '#E0A55C', borderRadius: '50%' }} />異動</span>
        <span style={{ fontWeight: 700, color: '#3A5D25' }}>活力 {Math.round(world.vitality * 100)}%＝定案程度</span>
      </div>
    </div>
  )
}
