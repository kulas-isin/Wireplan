import { useMemo, useState } from 'react'
import QuoteText from './QuoteText.jsx'
import { reqsOfPage } from '../lib/units.js'
import { ScrollText, X, Search } from 'lucide-react'

// Wireframe 旁的報價原文對照：一顆浮在右下的按鈕，點開後桌機是右側固定欄、手機是下半頁浮板，
// 都是非模態，畫面照常可以捲、可以改，對照時不用切頁。
// 範圍：這頁（掛在此頁的需求對到的報價條目）→ 本單元 → 全部；再加關鍵字過濾。
export function QuoteFab({ open, onToggle, count }) {
  return (
    <button className={'wf-quote-fab' + (open ? ' on' : '')} title={open ? '收起報價原文' : '對照報價原文'} onClick={onToggle}>
      <ScrollText size={18} />
      {!open && count > 0 && <span className="wf-quote-n">{count}</span>}
    </button>
  )
}

export function quoteItemsFor(project, wf, scope) {
  const items = project?.quote?.items || []
  if (scope === 'all') return items
  const reqs = wf ? reqsOfPage(project, wf) : []
  if (wf?.requirementId && !reqs.some((r) => r.id === wf.requirementId)) {
    const r = (project.requirements || []).find((x) => x.id === wf.requirementId)
    if (r) reqs.push(r)
  }
  if (scope === 'unit') {
    const u = (wf?.unit || '').trim()
    const ids = new Set((project.requirements || []).filter((r) => (r.unit || '').trim() === u).map((r) => r.id))
    return items.filter((it) => (it.reqIds || []).some((id) => ids.has(id)))
  }
  const ids = new Set(reqs.map((r) => r.id))
  return items.filter((it) => (it.reqIds || []).some((id) => ids.has(id)))
}

export default function QuotePanel({ project, wf, onClose }) {
  const [scope, setScope] = useState('page')
  const [q, setQ] = useState('')
  const reqName = useMemo(() => new Map((project.requirements || []).map((r) => [r.id, r.name])), [project.requirements])
  const items = useMemo(() => {
    const list = quoteItemsFor(project, wf, scope)
    const k = q.trim().toLowerCase()
    return k ? list.filter((it) => (it.text || '').toLowerCase().includes(k) || (it.section || '').toLowerCase().includes(k)) : list
  }, [project, wf, scope, q])
  const total = (project.quote?.items || []).length
  const nPage = quoteItemsFor(project, wf, 'page').length
  const nUnit = quoteItemsFor(project, wf, 'unit').length

  return (
    <aside className="wf-quote" onClick={(e) => e.stopPropagation()}>
      <div className="wf-quote-head">
        <ScrollText size={15} />
        <strong>報價原文</strong>
        <span className="muted wf-quote-pg">{wf?.code ? wf.code + ' ' : ''}{wf?.name}</span>
        <button className="ghost sm" title="收起" onClick={onClose}><X size={15} /></button>
      </div>
      <div className="wf-quote-tools">
        <div className="wseg">
          <button className={scope === 'page' ? 'active' : ''} onClick={() => setScope('page')}>這頁 {nPage}</button>
          <button className={scope === 'unit' ? 'active' : ''} onClick={() => setScope('unit')}>{wf?.unit || '本單元'} {nUnit}</button>
          <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>全部 {total}</button>
        </div>
        <label className="wf-quote-search"><Search size={13} /><input value={q} placeholder="找關鍵字…" onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      <div className="wf-quote-body">
        {total === 0 && <div className="wf-quote-empty">這個專案還沒有報價原文。到「需求整理 › 報價對照」匯入報價對照 JSON 後，這裡就能對照。</div>}
        {total > 0 && items.length === 0 && (
          <div className="wf-quote-empty">
            {q ? '沒有含這個關鍵字的條目。' : scope === 'page'
              ? '這頁掛的需求還沒對應到報價條目。切「本單元」或「全部」看，或到「報價對照」把條目綁到需求。'
              : '這個範圍沒有條目。'}
          </div>
        )}
        {items.map((it) => (
          <div key={it.id} className="wf-quote-item">
            {it.section && <div className="wf-quote-sec">{it.section}</div>}
            <QuoteText text={it.text} />
            {(it.reqIds || []).length > 0 && (
              <div className="wf-quote-reqs">{it.reqIds.map((id) => reqName.get(id)).filter(Boolean).map((n) => <span key={n}>{n}</span>)}</div>
            )}
          </div>
        ))}
      </div>
    </aside>
  )
}
