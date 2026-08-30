import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { categoryMeta, CATEGORY_LIST } from '../lib/categories.js'
import { ArrowLeft, ArrowRight, ArrowUp, Check, ClipboardList, Copy, Flame, HelpCircle, LayoutGrid, ListChecks, Merge, Sparkles, Split, Trophy } from 'lucide-react'

// ── 相似度：字元 bigram Dice 係數（抓「會員登入」vs「登入/註冊」這類重複卡）──
const norm = (s) => String(s || '').toLowerCase().replace(/[\s/／、,，.。()（）\-_]/g, '')
function similar(a, b) {
  const A = norm(a), B = norm(b)
  if (!A || !B) return 0
  if (A.includes(B) || B.includes(A)) return 1
  const grams = (t) => { const g = new Set(); for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2)); return g }
  const ga = grams(A), gb = grams(B)
  if (!ga.size || !gb.size) return 0
  let hit = 0
  for (const g of ga) if (gb.has(g)) hit++
  return (2 * hit) / (ga.size + gb.size)
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.9, dur: 1.4 + Math.random() * 1.2,
    color: ['#43E97B', '#FFD84D', '#5BB8FF', '#FF8FB1', '#B45CFF', '#1FA65A'][i % 6],
    size: 7 + Math.random() * 7, rot: Math.random() * 360,
  })), [])
  return (
    <div className="tg-confetti" aria-hidden>
      {pieces.map((p, i) => (
        <span key={i} style={{ left: p.left + '%', background: p.color, width: p.size, height: p.size * 0.55, animationDelay: p.delay + 's', animationDuration: p.dur + 's', transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  )
}

// 收牌局：訪談後的收整 — 回合1 配對合併、回合2 滑卡定優先、回合3 歸隊、結算
export default function TriageGame({ onExit }) {
  const { state, current, dispatch } = useStore()
  const reqs = current.requirements || []
  const [stage, setStage] = useState('pair')
  const [mergeCount, setMergeCount] = useState(0)
  const [pairIdx, setPairIdx] = useState(0)
  const [pairAnim, setPairAnim] = useState('')
  const [queue, setQueue] = useState(null) // 回合2 待掃 id 佇列
  const [fly, setFly] = useState('')
  const [drag, setDrag] = useState(null)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const downRef = useRef(null)

  // 回合1：相似卡配對（每張卡最多出現一次）
  const pairs = useMemo(() => {
    const used = new Set(), out = []
    for (let i = 0; i < reqs.length; i++) {
      if (used.has(reqs[i].id)) continue
      for (let j = i + 1; j < reqs.length; j++) {
        if (used.has(reqs[j].id)) continue
        if (similar(reqs[i].name, reqs[j].name) >= 0.5) { out.push([reqs[i].id, reqs[j].id]); used.add(reqs[i].id); used.add(reqs[j].id); break }
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 進場算一次即可
  const byId = (id) => reqs.find((r) => r.id === id)
  const curPair = pairs[pairIdx] && byId(pairs[pairIdx][0]) && byId(pairs[pairIdx][1]) ? pairs[pairIdx] : null

  const nextPair = () => {
    setPairAnim('')
    if (pairIdx + 1 < pairs.length) setPairIdx(pairIdx + 1)
    else startSwipe()
  }
  const decidePair = (merge) => {
    if (!curPair) return nextPair()
    setPairAnim(merge ? 'merge' : 'split')
    const [aId, bId] = curPair
    setTimeout(() => {
      if (merge) {
        const a = byId(aId), b = byId(bId)
        if (a && b) {
          const keep = a.name.length >= b.name.length ? a : b
          const drop = keep === a ? b : a
          dispatch({ type: 'UPDATE_REQUIREMENT', id: keep.id, patch: { note: [keep.note, drop.note, `（合併自「${drop.name}」）`].filter(Boolean).join('｜') } })
          dispatch({ type: 'DELETE_REQUIREMENT', id: drop.id })
          setMergeCount((n) => n + 1)
        }
      }
      nextPair()
    }, 320)
  }

  // 回合2：滑卡
  const startSwipe = () => { setQueue((current.requirements || []).map((r) => r.id)); setStage('swipe') }
  const q = queue || []
  const swipeCard = q.length ? byId(q[0]) : null
  const setPriority = (p, dir) => {
    if (!swipeCard) return
    navigator.vibrate?.(15)
    setFly(dir)
    dispatch({ type: 'UPDATE_REQUIREMENT', id: swipeCard.id, patch: { priority: p } })
    setTimeout(() => { setFly(''); setDrag(null); setEditing(false); setQueue((prev) => prev.slice(1)) }, 260)
  }
  const skip = () => { setFly('skip'); setTimeout(() => { setFly(''); setDrag(null); setEditing(false); setQueue((prev) => prev.slice(1)) }, 200) }

  const onDown = (e) => { if (editing) return; downRef.current = { x: e.clientX, y: e.clientY }; setDrag({ dx: 0, dy: 0 }) }
  const onMove = (e) => { if (!downRef.current || editing) return; setDrag({ dx: e.clientX - downRef.current.x, dy: e.clientY - downRef.current.y }) }
  const onUp = () => {
    const d = drag; downRef.current = null
    if (!d) return
    if (d.dx > 80) setPriority('高', 'r')
    else if (d.dx < -80) setPriority('低', 'l')
    else if (d.dy < -80) setPriority('中', 'u')
    else {
      if (Math.abs(d.dx) < 6 && Math.abs(d.dy) < 6) setEditing(true)
      setDrag(null)
    }
  }

  // 回合3：歸隊
  const groups = useMemo(() => {
    const g = {}
    for (const r of reqs) (g[r.category] ||= []).push(r)
    return g
  }, [reqs])

  // 結算
  const guide = state.library?.guide || []
  const checks = current.guideChecks || {}
  const guideRemain = guide.filter((x) => !checks[x]).length
  const high = reqs.filter((r) => r.priority === '高').length
  const summaryText = () => {
    const lines = [`【${current.name}】訪談需求確認`, `今天訪談整理出 ${reqs.length} 項需求：`]
    reqs.forEach((r, i) => lines.push(`${i + 1}. ${r.name}（${r.priority}）${r.note ? ' — ' + r.note.split('｜')[0] : ''}`))
    lines.push('', '麻煩幫我確認有沒有漏掉或理解錯的地方，謝謝！')
    return lines.join('\n')
  }
  const copySummary = async () => {
    try { await navigator.clipboard.writeText(summaryText()) } catch {
      const ta = document.createElement('textarea'); ta.value = summaryText(); document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove()
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }

  useEffect(() => {
    if (stage === 'pair' && !curPair) startSwipe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, pairIdx])
  useEffect(() => {
    if (stage === 'swipe' && queue && queue.length === 0) setStage('group')
  }, [stage, queue])

  const stageNo = { pair: 1, swipe: 2, group: 3, done: 4 }[stage]

  return (
    <div className="tg-wrap">
      <div className="tg-head">
        <Sparkles size={18} />
        <strong>收牌局</strong>
        {stage !== 'done' && <span className="tg-step">回合 {stageNo}/3</span>}
        <div className="spacer" />
        {stage !== 'done' && <button className="ghost sm" onClick={() => (stage === 'pair' ? startSwipe() : setStage(stage === 'swipe' ? 'group' : 'done'))}>跳過此回合 ›</button>}
      </div>

      {stage === 'pair' && (
        <div className="tg-stage">
          {!curPair ? null : (
            <>
              <div className="tg-q">這兩張是同一件事嗎？<span className="muted">（{pairIdx + 1}/{pairs.length}）</span></div>
              <div className={'tg-pair ' + pairAnim}>
                <div className="tg-card tg-a">{byId(curPair[0])?.name}</div>
                <div className="tg-vs">VS</div>
                <div className="tg-card tg-b">{byId(curPair[1])?.name}</div>
              </div>
              <div className="tg-btns">
                <button className="tg-big primary" onClick={() => decidePair(true)}><Merge size={16} /> 合併</button>
                <button className="tg-big" onClick={() => decidePair(false)}><Split size={16} /> 不是，分開</button>
              </div>
            </>
          )}
        </div>
      )}

      {stage === 'swipe' && (
        <div className="tg-stage">
          {!swipeCard ? null : (
            <>
              <div className="tg-q">這件事多重要？<span className="muted">（剩 {q.length} 張）</span><span className="tg-legend"><ArrowRight size={13} />高<ArrowLeft size={13} />低<ArrowUp size={13} />中</span></div>
              <div className="tg-deck">
                {q[1] && byId(q[1]) && <div className="tg-card tg-under">{byId(q[1]).name}</div>}
                <div
                  className={'tg-card tg-top' + (fly ? ' fly-' + fly : '')}
                  style={drag ? { transform: `translate(${drag.dx}px,${drag.dy}px) rotate(${drag.dx / 14}deg)`, transition: 'none' } : undefined}
                  onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                >
                  {editing ? (
                    <input autoFocus defaultValue={swipeCard.name}
                      onBlur={(e) => { dispatch({ type: 'UPDATE_REQUIREMENT', id: swipeCard.id, patch: { name: e.target.value || swipeCard.name } }); setEditing(false) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }} />
                  ) : (
                    <>
                      <span className="tg-cat" style={{ color: categoryMeta(swipeCard.category).color }}>{categoryMeta(swipeCard.category).label}</span>
                      <div className="tg-name">{swipeCard.name}</div>
                      {swipeCard.note && <div className="tg-note">{swipeCard.note.split('｜')[0]}</div>}
                      <div className="muted" style={{ fontSize: 11 }}>點一下可改名</div>
                    </>
                  )}
                  {drag && drag.dx > 40 && <span className="tg-hint tg-hi">高</span>}
                  {drag && drag.dx < -40 && <span className="tg-hint tg-lo">低</span>}
                  {drag && drag.dy < -40 && Math.abs(drag.dx) <= 40 && <span className="tg-hint tg-mid">中</span>}
                </div>
              </div>
              <div className="tg-btns">
                <button className="tg-pri lo" onClick={() => setPriority('低', 'l')}><ArrowLeft size={15} /> 低</button>
                <button className="tg-pri mid" onClick={() => setPriority('中', 'u')}><ArrowUp size={15} /> 中</button>
                <button className="tg-pri hi" onClick={() => setPriority('高', 'r')}><ArrowRight size={15} /> 高</button>
                <button className="ghost sm" onClick={skip}>跳過</button>
              </div>
            </>
          )}
        </div>
      )}

      {stage === 'group' && (
        <div className="tg-stage tg-scroll">
          <div className="tg-q">歸隊完成 — 最後掃一眼，要調就調</div>
          {Object.entries(groups).map(([cat, rows]) => (
            <div key={cat} className="tg-group">
              <div className="tg-gt" style={{ color: categoryMeta(cat).color }}>{categoryMeta(cat).label}（{rows.length}）</div>
              {rows.map((r) => (
                <div key={r.id} className="tg-row">
                  <span className={'tg-pchip p' + r.priority}>{r.priority}</span>
                  <input value={r.name} onChange={(e) => dispatch({ type: 'UPDATE_REQUIREMENT', id: r.id, patch: { name: e.target.value } })} />
                  <select value={r.category} onChange={(e) => dispatch({ type: 'UPDATE_REQUIREMENT', id: r.id, patch: { category: e.target.value } })}>
                    {CATEGORY_LIST.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          ))}
          <button className="tg-big primary" style={{ margin: '14px auto' }} onClick={() => setStage('done')}><Check size={16} /> 收工結算</button>
        </div>
      )}

      {stage === 'done' && (
        <div className="tg-stage tg-done">
          <Confetti />
          <div className="tg-trophy"><Trophy size={54} /></div>
          <div className="tg-result">
            <div className="tg-rt">本場戰果</div>
            <div className="tg-stats">
              <span><ClipboardList size={16} /> {reqs.length} 項需求</span>
              <span><Merge size={16} /> 合併 {mergeCount} 張</span>
              <span><Flame size={16} /> 高優先 {high} 項</span>
              <span>{guideRemain === 0 ? <><Check size={16} /> 引導題全問完</> : <><HelpCircle size={16} /> 引導題剩 {guideRemain} 題沒問</>}</span>
            </div>
          </div>
          <div className="tg-btns tg-col">
            <button className="tg-big primary" onClick={copySummary}><Copy size={16} /> {copied ? '已複製！貼給客戶吧' : '複製摘要給客戶確認'}</button>
            <button className="tg-big" onClick={() => onExit('requirements')}><ListChecks size={16} /> 進需求清單</button>
            <button className="ghost" onClick={() => onExit('menu')}><LayoutGrid size={15} /> 回目錄</button>
          </div>
        </div>
      )}
    </div>
  )
}
