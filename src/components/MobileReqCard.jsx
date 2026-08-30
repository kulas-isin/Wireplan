import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/StoreContext.jsx'
import { CATEGORY_LIST, categoryMeta } from '../lib/categories.js'
import ChangeControl from './ChangeControl.jsx'
import { isLocked } from '../lib/change.js'
import { findElementOnPages, suggestElements } from '../lib/elements.js'
import { ChevronUp, ChevronDown, ChevronRight, RotateCw, Trash2, Check, X, Plus, User, Store, ArrowDownToLine, ArrowLeft, MessageSquareText, BookOpen, CalendarDays, LayoutTemplate, Boxes } from 'lucide-react'

// 標題輸入：多行自動長高（需求名稱常常一行放不下）
function TitleArea({ value, disabled, title, placeholder, onChange }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    document.fonts?.ready?.then(fit)
    return () => ro.disconnect()
  }, [value])
  return (
    <textarea ref={ref} rows={1} className="rq-name" value={value} disabled={disabled} title={title}
      placeholder={placeholder} onChange={onChange}
      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }} />
  )
}

// 詳細區的自動長高輸入
function GrowInput({ value, disabled, title, placeholder, onChange, multiline, className }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
    fit()
    requestAnimationFrame(fit)
    const t = setTimeout(fit, 260) // 進場動畫結束後再量一次
    document.fonts?.ready?.then(fit)
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    if (el.parentElement) ro.observe(el.parentElement)
    return () => { ro.disconnect(); clearTimeout(t) }
  }, [value])
  return (
    <textarea ref={ref} rows={1} className={className} value={value} disabled={disabled} title={title} placeholder={placeholder}
      onChange={onChange} onKeyDown={(e) => { if (e.key === 'Enter' && !multiline) e.preventDefault() }}
      style={{ resize: 'none', overflow: 'hidden' }} />
  )
}

// 單行語意、多行顯示（驗收條件整句可見）
function GrowLine({ value, disabled, placeholder, onChange }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
    fit()
    requestAnimationFrame(fit)
    const t = setTimeout(fit, 260)
    document.fonts?.ready?.then(fit)
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => { ro.disconnect(); clearTimeout(t) }
  }, [value])
  return (
    <textarea ref={ref} rows={1} value={value} disabled={disabled} placeholder={placeholder}
      onChange={onChange} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }} />
  )
}

// 驗收條件：逐條清單列
function AcceptList({ value, disabled, onChange }) {
  const lines = value ? value.split('\n') : []
  const set = (arr) => onChange(arr.join('\n'))
  return (
    <div className="al-wrap">
      {lines.length === 0 && <div className="al-empty">尚未填寫 — 確認書會帶預設驗收條件</div>}
      {lines.map((l, i) => (
        <div key={i} className="al-row">
          <span className="al-dot"><Check size={12} /></span>
          <GrowLine value={l} disabled={disabled} placeholder="輸入可驗收的條件…" onChange={(e) => set(lines.map((x, j) => (j === i ? e.target.value : x)))} />
          {!disabled && <button className="al-x" onClick={() => set(lines.filter((_, j) => j !== i))}><X size={13} /></button>}
        </div>
      ))}
      {!disabled && <button className="al-add" onClick={() => set([...lines, ''])}><Plus size={13} /> 新增條件</button>}
    </div>
  )
}

// 對話串（LINE 式氣泡；預設只顯示最近 2 則）
function TalkThread({ talks = [], disabled, onChange }) {
  const [txt, setTxt] = useState('')
  const [expand, setExpand] = useState(false)
  const add = (who) => {
    const t = txt.trim()
    if (!t) return
    onChange([...talks, { at: Date.now(), who, text: t }])
    setTxt('')
  }
  const del = (i) => onChange(talks.filter((_, j) => j !== i))
  const indexed = talks.map((t, i) => ({ t, i }))
  const shown = expand || talks.length <= 3 ? indexed : indexed.slice(-2)
  return (
    <div className="tk-wrap">
      {talks.length === 0 && <div className="al-empty">還沒有對話 — 客戶說了什麼、你確認了什麼，逐則記在這裡</div>}
      {talks.length > 3 && !expand && (
        <button className="tk-more" onClick={() => setExpand(true)}>查看全部 {talks.length} 則對話</button>
      )}
      {talks.length > 3 && expand && (
        <button className="tk-more" onClick={() => setExpand(false)}>收合，只看最近 2 則</button>
      )}
      {shown.map(({ t, i }) => (
        <div key={i} className={'tk-row ' + (t.who === 'client' ? 'tk-client' : 'tk-us')}>
          <div className="tk-bubble">
            <div className="tk-meta">{t.who === 'client' ? '客戶' : '我方'} · {new Date(t.at).toLocaleDateString('zh-TW')}</div>
            {t.text}
            {!disabled && <button className="tk-x" onClick={() => del(i)}><X size={12} /></button>}
          </div>
        </div>
      ))}
      {!disabled && (
        <div className="tk-input">
          <textarea rows={1} value={txt} placeholder="記一則對話…" onChange={(e) => setTxt(e.target.value)}
            onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }} />
          <div className="tk-btns">
            <button className="tk-send tk-send-client" disabled={!txt.trim()} onClick={() => add('client')}><User size={13} /> 客戶說</button>
            <button className="tk-send tk-send-us" disabled={!txt.trim()} onClick={() => add('us')}><Store size={13} /> 我方</button>
          </div>
        </div>
      )}
    </div>
  )
}

// 元件清單：這條需求需要哪些元件（欄位/按鈕/表格…）。
// 狀態自動比對已對應頁面：畫好的打綠勾（點頁名可跳過去），沒畫的標「還沒畫」。
// 蓋章後仍可編輯 — 元件清單是「確定需求之後」規劃畫面用的工作清單，不是規格本身。
function ElemList({ req, pages, onChange }) {
  const [txt, setTxt] = useState('')
  const items = req.elements || []
  const add = () => { const t = txt.trim(); if (!t) return; if (!items.includes(t)) onChange([...items, t]); setTxt('') }
  const fill = () => {
    const sug = suggestElements(req).filter((l) => !items.includes(l))
    if (!sug.length) { alert('這個分類的範本建議都已在清單裡了'); return }
    onChange([...items, ...sug])
  }
  const jump = (pid) => { sessionStorage.setItem('wp-open-wf', pid); window.location.hash = 'wf' }
  return (
    <div className="el-wrap">
      {items.length === 0 && <div className="al-empty">列出這條需求需要的元件（欄位、按鈕、表格…）— 對應畫面畫好會自動打勾，漏掉的一眼看到</div>}
      {items.map((l, i) => {
        const hit = findElementOnPages(l, pages)
        return (
          <div key={i} className={'el-row' + (hit ? ' el-ok' : '')}>
            <span className="el-dot">{hit && <Check size={12} />}</span>
            <span className="el-label">{l}</span>
            {hit
              ? <button className="el-pg" onClick={() => jump(hit.page.id)}><LayoutTemplate size={11} /> {hit.page.name}</button>
              : <span className="el-miss">還沒畫</span>}
            <button className="al-x" onClick={() => onChange(items.filter((_, j) => j !== i))}><X size={13} /></button>
          </div>
        )
      })}
      <div className="el-add">
        <input value={txt} placeholder="加一個元件，如：搜尋列、匯出鈕…" onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add() }} />
        <button className="al-add" disabled={!txt.trim()} onClick={add}><Plus size={13} /> 加入</button>
      </div>
      <button className="al-add" onClick={fill}><ArrowDownToLine size={13} /> 依分類範本帶入建議元件</button>
    </div>
  )
}

// 全螢幕故事頁：核心三件（故事/對話/驗收）大空間，行政欄位收進「更多資訊」
function ReqDetailSheet({ req, pages, locked, lockTip, patch, dispatch, onClose }) {
  const [more, setMore] = useState(false)
  return createPortal(
    <div className="rd-wrap">
      <div className="rd-head">
        <button className="rd-back" onClick={onClose}><ArrowLeft size={18} /></button>
        <strong className="rd-title">{req.name || '需求詳情'}</strong>
        <div className="spacer" />
        <ChangeControl req={req} />
      </div>
      <div className="rd-body">
        <div className="rd-sec"><BookOpen size={14} /> 故事句（一句話說清楚）</div>
        <GrowInput multiline className="rd-input" value={req.description} placeholder="身為＿＿，我想要＿＿，以便＿＿"
          disabled={locked} title={lockTip} onChange={(e) => patch({ description: e.target.value })} />
        {!locked && !req.description && (
          <button className="tk-tpl" onClick={() => patch({ description: '身為＿＿，我想要＿＿，以便＿＿' })}><Plus size={13} /> 用故事模板開頭</button>
        )}
        {!locked && (req.talks || []).length === 0 && (req.description || '').length > 80 && (
          <button className="tk-tpl" onClick={() => patch({ talks: [{ at: Date.now(), who: 'us', text: req.description }], description: '' })}><ArrowDownToLine size={13} /> 這段太長 — 搬進對話串</button>
        )}

        <div className="rd-sec"><MessageSquareText size={14} /> 對話串（客戶說了什麼 / 我方確認了什麼）</div>
        <TalkThread talks={req.talks || []} disabled={locked} onChange={(v) => patch({ talks: v })} />

        <div className="rd-sec"><Check size={14} /> 驗收條件</div>
        <AcceptList value={req.acceptance} disabled={locked} onChange={(v) => patch({ acceptance: v })} />

        <div className="rd-sec"><Boxes size={14} /> 元件清單{(req.elements || []).length > 0 ? `（${(req.elements || []).filter((l) => findElementOnPages(l, pages)).length}/${(req.elements || []).length} 已畫）` : ''}</div>
        <ElemList req={req} pages={pages} onChange={(v) => patch({ elements: v })} />

        <button className="rd-more" onClick={() => setMore((m) => !m)}>
          {more ? <ChevronDown size={15} /> : <ChevronRight size={15} />} 更多資訊（畫面 / 備註 / 工時報價 / 履歷）
        </button>
        {more && (
          <div className="rd-moresec">
            <label><span>記錄日期（哪天的訪談記的）</span>
              <input type="date" className="rd-input" disabled={locked} title={lockTip}
                value={req.createdAt ? new Date(req.createdAt).toISOString().slice(0, 10) : ''}
                onChange={(e) => { const v = e.target.value; if (v) patch({ createdAt: Date.parse(v + 'T09:00:00') }) }} />
            </label>
            <label><span>對應畫面名稱</span><GrowInput className="rd-input" value={req.screen} disabled={locked} title={lockTip} onChange={(e) => patch({ screen: e.target.value })} /></label>
            <label><span>備註</span><GrowInput className="rd-input" value={req.note} disabled={locked} title={lockTip} onChange={(e) => patch({ note: e.target.value })} /></label>
            <div className="rq-2">
              <label><span>工時</span><GrowInput className="rd-input" value={req.estimate} disabled={locked} title={lockTip} onChange={(e) => patch({ estimate: e.target.value })} /></label>
              <label><span>報價</span><GrowInput className="rd-input" value={req.price} disabled={locked} title={lockTip} onChange={(e) => patch({ price: e.target.value })} /></label>
            </div>
            {((req.versions || []).length > 0 || (req.changeLog || []).length > 0) && (
              <div className="req-history">
                {(req.versions || []).map((v) => <span key={'v' + v.v} className="st-badge st-green">v{v.v} ✓ {new Date(v.at).toLocaleDateString('zh-TW')}</span>)}
                {(req.changeLog || []).map((c, i) => <span key={'c' + i} className="req-h-change">✂ {new Date(c.at).toLocaleDateString('zh-TW')}：{c.note}</span>)}
              </div>
            )}
            <button className="tk-tpl" onClick={() => dispatch({ type: 'REGENERATE_WIREFRAME', requirementId: req.id })}><RotateCw size={13} /> 依分類重新產生 wireframe</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// 手機專屬卡片：精簡清單卡 + 摘要 chips；詳細 → 全螢幕故事頁
export default function MobileReqCard({ req, index, total }) {
  const { current, dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const cat = categoryMeta(req.category)
  const locked = isLocked(req)
  const lockTip = locked ? '已確認 — 要修改請先按 ✂ 拆封' : undefined
  const patch = (p) => dispatch({ type: 'UPDATE_REQUIREMENT', id: req.id, patch: p })
  const talksN = (req.talks || []).length
  const accN = req.acceptance ? req.acceptance.split('\n').filter((s) => s.trim()).length : 0
  // 對應畫面：requirementId 連結優先，名稱模糊比對補
  const coreN = (l) => String(l || '').replace(/^[wWＷ]?\s*[.\d]+[a-zA-Z]?\s*/, '').replace(/[（(【[].*?[）)】\]]/g, '').replace(/\s+/g, '').trim()
  const k = coreN(req.screen || req.name)
  const pages = (current.wireframes || []).filter((w) => w.requirementId === req.id || (k && coreN(w.name) && (coreN(w.name).includes(k) || k.includes(coreN(w.name)))))
  const openWf = (e) => {
    e.stopPropagation()
    if (!pages.length) return
    sessionStorage.setItem('wp-open-wf', pages[0].id)
    window.location.hash = 'wf'
  }
  const els = req.elements || []
  const elOk = els.filter((l) => findElementOnPages(l, pages)).length
  return (
    <div className={'rq-card' + (locked ? ' rq-locked' : '')}>
      <div className="rq-top">
        <TitleArea value={req.name} placeholder="功能名稱" disabled={locked} title={lockTip} onChange={(e) => patch({ name: e.target.value })} />
        <ChangeControl req={req} />
      </div>
      <div className="rq-mid">
        <span className="rq-catwrap">
          <i style={{ background: cat.color }} />
          <select value={req.category} disabled={locked} title={lockTip} onChange={(e) => patch({ category: e.target.value })}>
            {CATEGORY_LIST.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </span>
        <span className="rq-seg" title={lockTip}>
          {['高', '中', '低'].map((p) => (
            <button key={p} className={req.priority === p ? 'on' : ''} disabled={locked} onClick={() => patch({ priority: p })}>{p}</button>
          ))}
        </span>
      </div>
      {(talksN > 0 || accN > 0 || req.description || req.createdAt || pages.length > 0 || els.length > 0) && (
        <div className="rq-hints" onClick={() => setOpen(true)}>
          {req.createdAt && <span className="rq-hint"><CalendarDays size={12} /> {new Date(req.createdAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</span>}
          {req.description && <span className="rq-hint"><BookOpen size={12} /> 故事</span>}
          {talksN > 0 && <span className="rq-hint"><MessageSquareText size={12} /> {talksN}</span>}
          {accN > 0 && <span className="rq-hint"><Check size={12} /> {accN}</span>}
          {pages.length > 0 && <span className="rq-hint rq-hint-wf" onClick={openWf} title={'查看畫面：' + pages.map((w) => w.name).join('、')}><LayoutTemplate size={12} /> {pages.length} 頁</span>}
          {els.length > 0 && <span className={'rq-hint ' + (elOk === els.length ? 'rq-hint-ok' : 'rq-hint-warn')} title={elOk === els.length ? '元件都畫好了' : `還有 ${els.length - elOk} 個元件沒畫進畫面`}><Boxes size={12} /> {elOk}/{els.length}</span>}
        </div>
      )}
      <div className="rq-foot">
        <button onClick={() => setOpen(true)}><ChevronRight size={15} /> 詳細</button>
        <div className="spacer" />
        <button disabled={index === 0} title="上移" onClick={() => dispatch({ type: 'MOVE_REQUIREMENT', id: req.id, dir: -1 })}><ChevronUp size={16} /></button>
        <button disabled={index === total - 1} title="下移" onClick={() => dispatch({ type: 'MOVE_REQUIREMENT', id: req.id, dir: 1 })}><ChevronDown size={16} /></button>
        <button className="danger" onClick={() => { if (locked) { alert('這條需求已確認（蓋章）。要刪除請先按 ✂ 拆封。'); return } if (confirm('刪除此需求？')) dispatch({ type: 'DELETE_REQUIREMENT', id: req.id }) }}><Trash2 size={14} /></button>
      </div>
      {open && <ReqDetailSheet req={req} pages={pages} locked={locked} lockTip={lockTip} patch={patch} dispatch={dispatch} onClose={() => setOpen(false)} />}
    </div>
  )
}
