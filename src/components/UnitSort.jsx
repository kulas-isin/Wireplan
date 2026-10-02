import { useMemo, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { unitsOf } from '../lib/units.js'
import { ArrowLeft, Check, LayoutGrid, Plus, SkipForward, Boxes } from 'lucide-react'

// 歸單元：一張卡一張卡翻，確認「這張該掛哪個單元」。
// 卡上先顯示目前（通常是匯入時推的）單元；對就按「沒錯」，不對就點下面的單元籤，沒有的單元可以現場加。
export default function UnitSort({ onExit }) {
  const { current, dispatch } = useStore()
  const reqs = current.requirements || []
  const units = unitsOf(current)
  const [queue, setQueue] = useState(() => reqs.map((r) => r.id))
  const [fly, setFly] = useState('')
  const [adding, setAdding] = useState(false)
  const [moved, setMoved] = useState(0)
  const byId = (id) => reqs.find((r) => r.id === id)
  const card = queue.length ? byId(queue[0]) : null
  const done = reqs.length - queue.length

  // 單元籤依「前綴｜」分組（前台／倉管／後台…），沒有前綴的放「其他」
  const groups = useMemo(() => {
    const g = new Map()
    for (const u of units) {
      const k = u.includes('｜') ? u.split('｜')[0] : ''
      if (!g.has(k)) g.set(k, [])
      g.get(k).push(u)
    }
    return [...g.entries()]
  }, [units])

  const next = (dir) => {
    setFly(dir)
    setTimeout(() => { setFly(''); setQueue((q) => q.slice(1)) }, 220)
  }
  const assign = (u) => {
    if (!card) return
    navigator.vibrate?.(12)
    if (u !== card.unit) { dispatch({ type: 'UPDATE_REQUIREMENT', id: card.id, patch: { unit: u } }); setMoved((n) => n + 1) }
    next('r')
  }
  const addUnit = (name) => {
    const n = (name || '').trim()
    if (!n) { setAdding(false); return }
    if (!units.includes(n)) dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'units', value: [...(current.units || []), n] })
    setAdding(false)
    assign(n)
  }
  const quote = card ? (card.talks || []).find((t) => t.who === 'client')?.text || '' : ''

  return (
    <div className="tg-wrap">
      <div className="tg-head">
        <Boxes size={18} />
        <strong>歸單元</strong>
        <span className="tg-step">{done}/{reqs.length}</span>
        <div className="spacer" />
        <button className="ghost sm" onClick={() => onExit('requirements')}><ArrowLeft size={15} /> 回需求</button>
      </div>

      {card ? (
        <div className="tg-stage us-stage">
          <div className="tg-q">這張卡該掛哪個單元？<span className="muted">（剩 {queue.length} 張）</span></div>
          <div className="tg-deck">
            {queue[1] && byId(queue[1]) && <div className="tg-card tg-under">{byId(queue[1]).name}</div>}
            <div className={'tg-card tg-top' + (fly ? ' fly-' + fly : '')} style={{ cursor: 'default' }}>
              <span className="tg-cat us-cur">{card.unit || '（未歸單元）'}</span>
              <div className="tg-name">{card.name}</div>
              {quote && <div className="tg-note">{quote.replace(/^\[[^\]]*\]\s*/, '')}</div>}
            </div>
          </div>
          <div className="tg-btns">
            <button className="tg-big primary" onClick={() => assign(card.unit)}><Check size={16} /> 單元沒錯</button>
            <button className="ghost sm" onClick={() => next('skip')}><SkipForward size={14} /> 跳過</button>
          </div>
          <div className="us-units">
            {groups.map(([k, list]) => (
              <div key={k || '_'} className="us-group">
                <div className="us-gt">{k || '其他'}</div>
                <div className="us-chips">
                  {list.map((u) => (
                    <button key={u} className={'us-chip' + (u === card.unit ? ' cur' : '')} onClick={() => assign(u)}>
                      {u.includes('｜') ? u.split('｜')[1] : u}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="us-group">
              {adding ? (
                <input className="us-new" autoFocus placeholder="新單元名稱，Enter 加入並掛上"
                  onKeyDown={(e) => { if (e.key === 'Enter') addUnit(e.currentTarget.value); if (e.key === 'Escape') setAdding(false) }}
                  onBlur={(e) => addUnit(e.target.value)} />
              ) : (
                <button className="us-chip add" onClick={() => setAdding(true)}><Plus size={13} /> 新單元</button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="tg-stage tg-done">
          <div className="tg-result">
            <div className="tg-rt">歸單元完成</div>
            <div className="tg-stats"><span><Check size={16} /> {reqs.length} 張看完</span><span><Boxes size={16} /> 改了 {moved} 張</span></div>
          </div>
          <div className="tg-btns tg-col">
            <button className="tg-big primary" onClick={() => onExit('requirements')}><ArrowLeft size={16} /> 回需求清單</button>
            <button className="ghost" onClick={() => onExit('menu')}><LayoutGrid size={15} /> 回目錄</button>
          </div>
        </div>
      )}
    </div>
  )
}
