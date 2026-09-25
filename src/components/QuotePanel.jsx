import { useMemo, useState } from 'react'
import QuoteText from './QuoteText.jsx'
import { reqsOfPage } from '../lib/units.js'
import { DECISION_KINDS, kindLabel, latest, decisionsForQuote, decisionsForPage } from '../lib/decisions.js'
import { ScrollText, X, Search, Gavel, Plus, History } from 'lucide-react'

// Wireframe 旁的報價原文對照：一顆浮在右下的按鈕，點開後桌機是右側固定欄、手機是下半頁浮板，
// 都是非模態，畫面照常可以捲、可以改，對照時不用切頁。
// 範圍：這頁（掛在此頁的需求對到的報價條目）→ 本單元 → 全部；再加關鍵字過濾。
// 每條原文底下可以「記決議」：改成怎樣、哪一類、誰決定的；決議有版本，改內容就加一版。
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

// 決議編輯器：新增（帶 title）或加新版（只改 text／source）
export function DecisionEditor({ initial = {}, revise, onSave, onCancel }) {
  const [title, setTitle] = useState(initial.title || '')
  const [kind, setKind] = useState(initial.kind || 'present')
  const [text, setText] = useState(initial.text || '')
  const [source, setSource] = useState(initial.source || '')
  const ok = text.trim() && (revise || title.trim())
  return (
    <div className="dc-editor" onClick={(e) => e.stopPropagation()}>
      {!revise && <input autoFocus value={title} placeholder="決議標題（一句話，例：進階篩選改就地展開）" onChange={(e) => setTitle(e.target.value)} />}
      {!revise && (
        <div className="dc-kinds">
          {DECISION_KINDS.map(([k, label, hint]) => (
            <button key={k} className={'dc-kind' + (kind === k ? ' on' : '')} title={hint} onClick={() => setKind(k)}>{label}</button>
          ))}
        </div>
      )}
      <textarea autoFocus={!!revise} rows={3} value={text} placeholder={revise ? '這一版改成怎樣…' : '改成怎樣、為什麼（會進會議記錄與 v2 文件）'} onChange={(e) => setText(e.target.value)} />
      <div className="dc-row">
        <input value={source} placeholder="來源：第 2 場／LINE 9/24／內部" onChange={(e) => setSource(e.target.value)} />
        <button className="ghost sm" onClick={onCancel}>取消</button>
        <button className="sm primary" disabled={!ok} onClick={() => ok && onSave({ title: title.trim(), kind, text: text.trim(), source: source.trim() })}>{revise ? '存成新版' : '記決議'}</button>
      </div>
    </div>
  )
}

export function DecisionCard({ d, dispatch, compact }) {
  const [hist, setHist] = useState(false)
  const [revising, setRevising] = useState(false)
  const cur = latest(d)
  return (
    <div className={'dc-card k-' + d.kind}>
      <div className="dc-head">
        <span className="dc-code">{d.code}</span>
        <strong className="dc-title">{d.title}</strong>
        <span className="dc-kindtag">{kindLabel(d.kind)}</span>
        <span className="dc-ver" title={cur.source}>v{cur.v}{cur.source ? ` · ${cur.source}` : ''}</span>
      </div>
      <div className="dc-text">{cur.text}</div>
      {!compact && d.pages?.length > 0 && <div className="dc-pages">{d.pages.map((p) => <span key={p}>{p}</span>)}</div>}
      {dispatch && (
        <div className="dc-acts">
          {d.versions.length > 1 && <button className="dc-lnk" onClick={() => setHist((h) => !h)}><History size={12} /> {hist ? '收起' : `歷史 ${d.versions.length - 1} 版`}</button>}
          {!revising && <button className="dc-lnk" onClick={() => setRevising(true)}><Plus size={12} /> 加新版</button>}
        </div>
      )}
      {hist && (
        <div className="dc-hist">
          {[...d.versions].reverse().slice(1).map((v) => <div key={v.v}><b>v{v.v}</b>{v.source ? ` · ${v.source}` : ''}：{v.text}</div>)}
        </div>
      )}
      {revising && (
        <DecisionEditor revise initial={{ text: cur.text }} onCancel={() => setRevising(false)}
          onSave={({ text, source }) => { dispatch({ type: 'REVISE_DECISION', id: d.id, version: { text, source } }); setRevising(false) }} />
      )}
    </div>
  )
}

export default function QuotePanel({ project, wf, onClose, dispatch }) {
  const [scope, setScope] = useState('page')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(null) // 正在記決議的條目 id
  const reqName = useMemo(() => new Map((project.requirements || []).map((r) => [r.id, r.name])), [project.requirements])
  const items = useMemo(() => {
    const list = quoteItemsFor(project, wf, scope)
    const k = q.trim().toLowerCase()
    return k ? list.filter((it) => (it.text || '').toLowerCase().includes(k) || (it.section || '').toLowerCase().includes(k)) : list
  }, [project, wf, scope, q])
  const total = (project.quote?.items || []).length
  const nPage = quoteItemsFor(project, wf, 'page').length
  const nUnit = quoteItemsFor(project, wf, 'unit').length
  const decisions = project.decisions || []
  const pageDecisions = decisionsForPage(decisions, wf?.code)

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
        {pageDecisions.length > 0 && (
          <div className="dc-pagebox">
            <div className="dc-pagebox-t"><Gavel size={13} /> 這頁的決議 {pageDecisions.length}</div>
            {pageDecisions.map((d) => <DecisionCard key={d.id} d={d} dispatch={dispatch} compact />)}
          </div>
        )}
        {total === 0 && <div className="wf-quote-empty">這個專案還沒有報價原文。到「需求整理 › 報價對照」匯入報價對照 JSON 後，這裡就能對照。</div>}
        {total > 0 && items.length === 0 && (
          <div className="wf-quote-empty">
            {q ? '沒有含這個關鍵字的條目。' : scope === 'page'
              ? '這頁掛的需求還沒對應到報價條目。切「本單元」或「全部」看，或到「報價對照」把條目綁到需求。'
              : '這個範圍沒有條目。'}
          </div>
        )}
        {items.map((it) => {
          const ds = decisionsForQuote(decisions, it.id)
          return (
            <div key={it.id} className="wf-quote-item">
              {it.section && <div className="wf-quote-sec">{it.section}</div>}
              <QuoteText text={it.text} />
              {(it.reqIds || []).length > 0 && (
                <div className="wf-quote-reqs">{it.reqIds.map((id) => reqName.get(id)).filter(Boolean).map((n) => <span key={n}>{n}</span>)}</div>
              )}
              {ds.length > 0 && <div className="dc-list">{ds.map((d) => <DecisionCard key={d.id} d={d} dispatch={dispatch} />)}</div>}
              {dispatch && adding !== it.id && (
                <button className="dc-add" onClick={() => setAdding(it.id)}><Gavel size={12} /> 記決議</button>
              )}
              {adding === it.id && (
                <DecisionEditor onCancel={() => setAdding(null)}
                  onSave={(v) => { dispatch({ type: 'ADD_DECISION', decision: { ...v, quoteIds: [it.id], pages: wf?.code ? [wf.code] : [] } }); setAdding(null) }} />
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
