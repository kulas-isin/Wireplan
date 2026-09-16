import { useEffect, useRef, useState } from 'react'

// 即時把 Mermaid 文字渲染成 SVG（mermaid 動態載入，不進主包）。
// 手勢（原生 touch 實作，雙指時 preventDefault 防瀏覽器搶手勢）：
// 雙指捏合 0.5x~3x（版面縮放，放大後單指捲動平移）；雙擊 1x↔1.8x；百分比 chip 點擊歸位。
export default function Mermaid({ code }) {
  const [svg, setSvg] = useState('')
  const [err, setErr] = useState('')
  const [nat, setNat] = useState(0)
  const [fit, setFit] = useState(1)
  const [scale, setScale] = useState(1)
  const boxRef = useRef(null)
  const scaleRef = useRef(1)
  scaleRef.current = scale

  useEffect(() => {
    let alive = true
    setScale(1)
    ;(async () => {
      try {
        const [{ default: mermaid }, { default: elkLayouts }] = await Promise.all([
          import('mermaid'),
          import('@mermaid-js/layout-elk'),
        ])
        mermaid.registerLayoutLoaders(elkLayouts)
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          layout: 'elk', // ELK 排版引擎：正交走線由演算法規劃，轉角最少（draw.io 同款）
          elk: { mergeEdges: true, nodePlacementStrategy: 'BRANDES_KOEPF' },
          flowchart: { curve: 'linear' }, // 沿 ELK 算好的轉折點直線連接，不再自己加彎
          theme: 'base',
          themeVariables: { // Nuviq 檸檬橄欖：與 app 同語彙
            primaryColor: '#F4F9E8',
            primaryBorderColor: '#9CBD48',
            primaryTextColor: '#22301F',
            secondaryColor: '#E1EDF9',
            secondaryBorderColor: '#7BA7D4',
            tertiaryColor: '#FFF8EC',
            tertiaryBorderColor: '#E0A55C',
            lineColor: '#7A8A70',
            textColor: '#22301F',
            clusterBkg: '#FDFEF7',
            clusterBorder: '#C9D8AC',
            edgeLabelBackground: '#F7FAEC',
            fontFamily: 'inherit',
          },
        })
        const id = 'mmd-' + Math.random().toString(36).slice(2)
        const { svg } = await mermaid.render(id, code)
        if (alive) {
          const m = svg.match(/max-width:\s*([\d.]+)px/)
          setNat(m ? Math.ceil(parseFloat(m[1])) : 0)
          setSvg(svg); setErr('')
        }
      } catch (e) {
        if (alive) setErr(String(e?.message || e))
      }
    })()
    return () => { alive = false }
  }, [code])

  // 自動填滿：比容器窄的圖放大到滿版（上限 2x），呈現面積最大化；比容器寬的維持原尺寸橫向捲
  useEffect(() => {
    const el = boxRef.current
    if (!el || !nat) { setFit(1); return }
    const cs = getComputedStyle(el)
    const cw = el.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0)
    setFit(cw > nat ? Math.min(2, cw / nat) : 1)
  }, [svg, nat])

  // 原生 touch 手勢：React 的 touch 監聽是 passive，preventDefault 無效，
  // 瀏覽器會把雙指判成捲動/系統縮放並 cancel 掉 — 這裡用非 passive 監聽自己接手。
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    let pinch = null
    let lastTap = 0
    const clamp = (v) => Math.min(3, Math.max(0.5, v))
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const ts = (e) => {
      if (e.touches.length === 2) {
        pinch = { d: dist(e.touches), s: scaleRef.current }
        e.preventDefault() // 從第一刻就接管，不給瀏覽器搶
      } else if (e.touches.length === 1) {
        const t = Date.now()
        if (t - lastTap < 300) setScale((s) => (s === 1 ? 1.8 : 1))
        lastTap = t
      }
    }
    const tm = (e) => {
      if (e.touches.length === 2) {
        if (!pinch) pinch = { d: dist(e.touches), s: scaleRef.current } // 第二指較晚落下也接得住
        e.preventDefault()
        setScale(clamp(pinch.s * dist(e.touches) / pinch.d))
      }
    }
    const te = (e) => { if (e.touches.length < 2) pinch = null }
    el.addEventListener('touchstart', ts, { passive: false })
    el.addEventListener('touchmove', tm, { passive: false })
    el.addEventListener('touchend', te)
    el.addEventListener('touchcancel', te)
    return () => {
      el.removeEventListener('touchstart', ts)
      el.removeEventListener('touchmove', tm)
      el.removeEventListener('touchend', te)
      el.removeEventListener('touchcancel', te)
    }
  }, [svg])

  if (err) return <div className="mermaid-box muted">圖表渲染失敗：{err}</div>
  if (!svg) return <div className="mermaid-box muted">渲染中…</div>
  return (
    <div ref={boxRef} className="mermaid-box" style={{ position: 'relative' }}>
      {scale !== 1 && (
        <button className="mmd-zoom" onClick={() => setScale(1)}>{Math.round(scale * 100)}% ✕</button>
      )}
      <div style={nat ? { width: Math.round(nat * fit * scale), minWidth: Math.round(nat * fit * scale) } : undefined}
        dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}
