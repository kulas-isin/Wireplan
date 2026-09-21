import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/StoreContext.jsx'
import { uid } from '../lib/id.js'
import QuoteText from './QuoteText.jsx'
import { X, ChevronUp, ChevronDown, Trash2, Plus, ClipboardPaste, Pencil, Eye, ArrowUpRight, GitBranch, ScrollText } from 'lucide-react'

// 頁面規格清單：頁面的真相來源是「區段＋項目」，線稿由規格自動渲染。
// 檢視模式＝膠囊掃視＋示意預覽（無任何編輯鈕）；編輯模式＝一行一項大列表（手機友善）＋貼上多行批次。
// 「轉自由編輯」單向編譯成元件陣列交給 83 元件編輯器，該頁從此脫離規格模式。
// wf.spec = { template, sections: [{ id, kind, items: [{ id, label, c }] }] }（c=true 表示合約/報價來源）

export const SECTION_KINDS = {
  searchbar: '搜尋列', filter: '快速篩選', toolbar: '工具列', table: '表格欄',
  form: '表單欄位', desc: '詳情欄位', tabs: '頁籤', stats: '統計卡',
  actions: '動作鈕', pagination: '分頁', note: '備註',
}
const NO_ITEMS = new Set(['pagination'])
export const SPEC_TEMPLATES = [
  ['list', '列表頁', ['searchbar', 'toolbar', 'table', 'pagination']],
  ['form', '表單頁', ['form', 'actions']],
  ['detail', '詳情頁', ['desc', 'table', 'actions']],
  ['dash', '儀表板', ['stats', 'table']],
  ['modal', '彈窗', ['form', 'actions']],
]
const TPL_LABEL = Object.fromEntries(SPEC_TEMPLATES.map(([k, l]) => [k, l]))
const sid = () => 's' + Math.random().toString(36).slice(2, 9)

// 規格 → 現有元件陣列（轉自由編輯用；低保真對映，細節到編輯器再調）
export function compileSpec(spec) {
  const comps = []
  for (const s of spec.sections || []) {
    const ls = (s.items || []).map((i) => i.label)
    const push = (o) => comps.push({ id: uid('c'), region: 'content', ...o })
    if (s.title) push({ type: 'divider', label: s.title })
    if (s.kind === 'searchbar') push({ type: 'searchbar', label: '搜尋：' + ls.join('／') })
    else if (s.kind === 'filter') push({ type: 'filter', fields: ls })
    else if (s.kind === 'toolbar' || s.kind === 'actions') push({ type: 'buttonRow', buttons: ls })
    else if (s.kind === 'table') push({ type: 'table', columns: ls, rows: 5 })
    else if (s.kind === 'form') ls.forEach((l) => push({ type: 'field', label: l }))
    else if (s.kind === 'desc') push({ type: 'descriptions', items: ls })
    else if (s.kind === 'tabs') push({ type: 'tabs', label: ls.join(',') })
    else if (s.kind === 'stats') push({ type: 'statcards', label: ls.join(',') })
    else if (s.kind === 'pagination') push({ type: 'pagination' })
    else if (s.kind === 'note') push({ type: 'text', label: ls.join('；') })
  }
  return comps
}

// 示意預覽：低保真但帶標籤——框裡直接寫欄位名，看得懂誰是誰
// 有「頁籤」區段時頁籤可點：點哪個籤，就只顯示標題對應該籤的區段（無對應標題的區段恆顯示）
const short = (s, n = 10) => { const t = String(s || '').replace(/（[^）]*）/g, '').trim(); return t.length > n ? t.slice(0, n) + '…' : t }
const secCap = (s) => (SECTION_KINDS[s.kind] || s.kind) + (s.title ? '・' + s.title : '')
function Sketch({ spec }) {
  const sections = spec.sections || []
  const tabsSec = sections.find((s) => s.kind === 'tabs' && (s.items || []).length)
  const tabLabels = tabsSec ? tabsSec.items.map((i) => i.label.trim()) : []
  const [tab, setTab] = useState(0)
  const active = tabLabels[Math.min(tab, Math.max(0, tabLabels.length - 1))]
  const visible = (s) => {
    if (s === tabsSec) return true
    const t = (s.title || '').trim()
    return t && tabLabels.includes(t) ? t === active : true
  }
  return (
    <div className="ps-preview">
      {sections.filter(visible).map((s) => {
        const ls = (s.items || []).map((i) => i.label)
        const cap = <div className="pv-cap">{secCap(s)}</div>
        if (s === tabsSec) return (
          <div key={s.id}>{cap}
            <div className="pv-bar" style={{ border: 'none', padding: 0 }}>
              {ls.map((l, i) => (
                <button key={i} className={'pv-pill pv-tab' + (l.trim() === active ? ' on' : '')} onClick={() => setTab(i)}>{short(l, 6)}</button>
              ))}
            </div>
            <div className="pv-tabhint">點頁籤切換內容（標題對應該籤的區段才會顯示）</div>
          </div>
        )
        if (s.kind === 'searchbar') return <div key={s.id}>{cap}<div className="pv-bar">{ls.slice(0, 6).map((l, i) => <span key={i} className="pv-pill">{short(l, 6)}</span>)}<span className="pv-go">搜</span></div></div>
        if (s.kind === 'filter' || s.kind === 'tabs') return <div key={s.id}>{cap}<div className="pv-bar" style={{ border: 'none', padding: 0 }}>{ls.slice(0, 8).map((l, i) => <span key={i} className="pv-pill" style={{ background: '#E1EDF9', color: '#2E5F96' }}>{short(l, 6)}</span>)}</div></div>
        if (s.kind === 'toolbar' || s.kind === 'actions') return <div key={s.id}>{cap}<div className="pv-bar" style={{ borderStyle: 'dashed', justifyContent: s.kind === 'actions' ? 'flex-end' : 'flex-start' }}>{ls.slice(0, 6).map((l, i) => <span key={i} className="pv-btn">{short(l, 7)}</span>)}</div></div>
        if (s.kind === 'table') {
          const cols = ls.length ? ls.slice(0, 8) : ['欄', '欄']
          return (
            <div key={s.id}>{cap}
              <div className="pv-table">
                <div className="pv-th">{cols.map((l, i) => <i key={i} style={i === cols.length - 1 ? { borderRight: 'none' } : undefined}>{short(l, 4)}</i>)}</div>
                {[0, 1].map((r) => <div key={r} className="pv-tr">{cols.map((_, i) => <i key={i} style={i === cols.length - 1 ? { borderRight: 'none' } : undefined} />)}</div>)}
                {ls.length > 8 && <div className="pv-more">…共 {ls.length} 欄</div>}
              </div>
            </div>
          )
        }
        if (s.kind === 'form' || s.kind === 'desc') return (
          <div key={s.id}>{cap}<div className="pv-form">{ls.slice(0, 12).map((l, i) => <span key={i} className="pv-field">{short(l, 9)}</span>)}{ls.length > 12 && <span className="pv-field" style={{ borderStyle: 'dashed', color: '#9CBD48' }}>…共 {ls.length} 欄</span>}</div></div>
        )
        if (s.kind === 'stats') return <div key={s.id}>{cap}<div className="pv-bar" style={{ border: 'none', padding: 0 }}>{(ls.length ? ls : ['—', '—', '—']).slice(0, 4).map((l, i) => <span key={i} className="pv-stat">{short(l, 6)}</span>)}</div></div>
        if (s.kind === 'pagination') return <div key={s.id} style={{ textAlign: 'right', fontSize: 10, color: '#9CBD48', letterSpacing: 2 }}>‹ 1 2 3 ›</div>
        return <div key={s.id}>{cap}<div className="pv-note">{ls.map((l, i) => <div key={i}>· {l}</div>)}</div></div>
      })}
    </div>
  )
}

// 單一區段的編輯列表：一行一項大目標；↑↓ 排序、✕ 刪除、底部新增＋貼上多行
function SectionEditor({ sec, onPatch, onRemove, onMove }) {
  const [adding, setAdding] = useState('')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const items = sec.items || []
  const setItems = (next) => onPatch({ items: next })
  const move = (i, d) => {
    const n = i + d
    if (n < 0 || n >= items.length) return
    const arr = [...items]; const [x] = arr.splice(i, 1); arr.splice(n, 0, x)
    setItems(arr)
  }
  const add = () => { if (!adding.trim()) return; setItems([...items, { id: sid(), label: adding.trim(), c: false, at: Date.now() }]); setAdding('') }
  return (
    <div className="ps-sec ps-editing">
      <div className="ps-sec-head">
        {SECTION_KINDS[sec.kind] || sec.kind}
        <input className="ps-title-in" value={sec.title || ''} placeholder="自訂標題（如：銷售資訊）"
          onChange={(e) => onPatch({ title: e.target.value })} />
        <div className="spacer" />
        <button className="uw-mini" title="區段上移" onClick={() => onMove(-1)}><ChevronUp size={13} /></button>
        <button className="uw-mini" title="區段下移" onClick={() => onMove(1)}><ChevronDown size={13} /></button>
        <button className="uw-mini uf-del" title="刪除整個區段" onClick={() => confirm(`刪除「${SECTION_KINDS[sec.kind]}」區段？`) && onRemove()}><Trash2 size={13} /></button>
      </div>
      {!NO_ITEMS.has(sec.kind) && (<>
        {items.map((it, i) => (
          <div key={it.id} className="ps-row">
            <input value={it.label} onChange={(e) => setItems(items.map((x) => x.id === it.id ? { ...x, label: e.target.value } : x))} />
            {it.c && <span className="ps-row-c" title="報價合約來源">約</span>}
            <button className="uw-mini" onClick={() => move(i, -1)}><ChevronUp size={13} /></button>
            <button className="uw-mini" onClick={() => move(i, 1)}><ChevronDown size={13} /></button>
            <button className="uw-mini uf-del" onClick={() => setItems(items.filter((x) => x.id !== it.id))}><X size={13} /></button>
          </div>
        ))}
        <div className="ps-row ps-addrow">
          <input value={adding} placeholder="＋ 新項目…" onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="uw-mini" onClick={add}><Plus size={13} /></button>
          <button className={'uw-mini' + (pasteOpen ? ' on' : '')} title="貼上多行文字，一行一項" onClick={() => setPasteOpen(!pasteOpen)}><ClipboardPaste size={13} /></button>
        </div>
        {pasteOpen && (
          <div className="ps-paste">
            <textarea rows={4} value={pasteText} placeholder={'貼上多行文字（或以「、，/」分隔）\n每行變成一個項目'} onChange={(e) => setPasteText(e.target.value)} />
            <button className="uf-new" onClick={() => {
              const parts = pasteText.split(/[\n、，,／/]/).map((s) => s.trim()).filter(Boolean)
              if (parts.length) setItems([...items, ...parts.map((label) => ({ id: sid(), label, c: false, at: Date.now() }))])
              setPasteText(''); setPasteOpen(false)
            }}>加入 {pasteText.split(/[\n、，,／/]/).filter((s) => s.trim()).length} 項</button>
          </div>
        )}
      </>)}
    </div>
  )
}

export default function SpecSheet({ wfId, onClose }) {
  const { current, dispatch } = useStore()
  const wf = (current.wireframes || []).find((w) => w.id === wfId)
  const [mode, setMode] = useState('view')
  const [addSec, setAddSec] = useState(false)
  const [quoteOpen, setQuoteOpen] = useState(false)
  if (!wf) return null
  // 脈絡列：這頁的需求 → 相關粗流（covers 反查）＋ 報價原文（審規格時就地比對缺漏）
  const req = (current.requirements || []).find((r) => r.id === wf.requirementId)
  const relFlows = req ? (current.unitFlows || []).filter((f) => (f.covers || []).includes(req.id)) : []
  const qItems = req ? (current.quote?.items || []).filter((it) => (it.reqIds || []).includes(req.id)) : []
  const spec = wf.spec
  const patch = (p) => dispatch({ type: 'UPDATE_WIREFRAME', id: wf.id, patch: p })
  const patchSpec = (p) => patch({ spec: { ...spec, ...p } })
  const patchSection = (id, p) => patchSpec({ sections: spec.sections.map((s) => (s.id === id ? { ...s, ...p } : s)) })
  const moveSection = (id, d) => {
    const i = spec.sections.findIndex((s) => s.id === id); const n = i + d
    if (n < 0 || n >= spec.sections.length) return
    const arr = [...spec.sections]; const [x] = arr.splice(i, 1); arr.splice(n, 0, x)
    patchSpec({ sections: arr })
  }
  const jumpBoard = () => { sessionStorage.setItem('wp-open-wf', wf.id); window.location.hash = 'wf' }
  const toFree = () => {
    if (!confirm('轉為自由編輯？規格會編譯成元件交給編輯器，此頁從此不再由規格清單管理（回不去）。')) return
    patch({ components: compileSpec(spec), spec: undefined })
    jumpBoard()
  }

  const isCustom = !spec && (wf.components || []).length > 0
  return createPortal(
    <div className="uf-wrap">
      <div className="uf-head">
        <strong>{wf.name}</strong>
        {spec?.template && <span className="ps-type">{TPL_LABEL[spec.template] || spec.template}</span>}
        <div className="spacer" />
        {spec && (mode === 'view'
          ? <button className="uf-new" onClick={() => setMode('edit')}><Pencil size={14} /> 編輯</button>
          : <button className="uf-new" onClick={() => setMode('view')}><Eye size={14} /> 完成</button>)}
        <button className="rd-back" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="uf-body">
        {isCustom && (
          <div className="uf-empty">此頁已是自由編輯頁（由元件編輯器管理）。<br /><br />
            <button className="uf-new" onClick={jumpBoard}><ArrowUpRight size={14} /> 開啟 Wireframe 編輯器</button></div>
        )}
        {!spec && !isCustom && (
          <div className="uf-card" style={{ alignItems: 'stretch' }}>
            <div className="ht-title">這一頁要長什麼樣？選個頁型起手：</div>
            {SPEC_TEMPLATES.map(([k, label, kinds]) => (
              <button key={k} className="ps-tplbtn" onClick={() => {
                patch({ spec: { template: k, sections: kinds.map((kind) => ({ id: sid(), kind, items: [] })) } })
                setMode('edit')
              }}>
                <strong>{label}</strong>
                <span>{kinds.map((x) => SECTION_KINDS[x]).join('＋')}</span>
              </button>
            ))}
          </div>
        )}
        {spec && mode === 'view' && (
          <div className="uf-card" style={{ gap: 10 }}>
            {(req || relFlows.length > 0 || qItems.length > 0) && (
              <div className="ps-links">
                {req && <span className="ps-kind">需求：{req.name}</span>}
                {relFlows.map((f) => <span key={f.id} className="rd-flow-chip"><GitBranch size={11} /> {f.name}{f.sealed ? ' ✓' : ''}</span>)}
                {qItems.length > 0 && (
                  <button className={'uf-quotebtn' + (quoteOpen ? ' on' : '')} onClick={() => setQuoteOpen(!quoteOpen)}>
                    <ScrollText size={12} /> 報價原文 {qItems.length}</button>
                )}
              </div>
            )}
            {quoteOpen && qItems.map((it) => (
              <div key={it.id} className="uf-quote">
                <div className="uf-quote-name"><ScrollText size={11} /> {it.name}｜報價原文</div>
                <QuoteText text={it.text} interactive />
              </div>
            ))}
            {spec.sections.map((s) => (
              <div key={s.id} className="ps-sec">
                <div className="ps-sec-head">{secCap(s)}
                  {(s.items || []).length > 0 && <span className="ps-kind">{s.items.length} 項</span>}</div>
                {(s.items || []).length > 0 && (
                  <div className="ps-items">
                    {s.items.map((it) => <span key={it.id} className={'ps-item' + (it.c ? ' contract' : '')}>{it.label}</span>)}
                  </div>
                )}
              </div>
            ))}
            <div className="ht-title" style={{ padding: '2px 2px 0' }}>示意預覽</div>
            <Sketch spec={spec} />
          </div>
        )}
        {spec && mode === 'edit' && (
          <div className="uf-card" style={{ gap: 10 }}>
            {spec.sections.map((s) => (
              <SectionEditor key={s.id} sec={s}
                onPatch={(p) => patchSection(s.id, p)}
                onRemove={() => patchSpec({ sections: spec.sections.filter((x) => x.id !== s.id) })}
                onMove={(d) => moveSection(s.id, d)} />
            ))}
            {addSec ? (
              <div className="ps-items">
                {Object.entries(SECTION_KINDS).map(([k, label]) => (
                  <button key={k} className="ps-item" style={{ cursor: 'pointer' }} onClick={() => {
                    patchSpec({ sections: [...spec.sections, { id: sid(), kind: k, items: [] }] }); setAddSec(false)
                  }}>{label}</button>
                ))}
              </div>
            ) : (
              <button className="ps-add" style={{ alignSelf: 'flex-start' }} onClick={() => setAddSec(true)}>＋ 加區段</button>
            )}
            <button className="ps-add" style={{ alignSelf: 'flex-end', borderStyle: 'solid', opacity: 0.8 }} onClick={toFree}>轉自由編輯 →</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
