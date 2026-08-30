import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { CATEGORY_LIST, categoryMeta } from '../lib/categories.js'
import ChangeControl from './ChangeControl.jsx'
import { isLocked } from '../lib/change.js'
import { ChevronUp, ChevronDown, RotateCw, Trash2, Check, X, Plus, User, Store, ArrowDownToLine } from 'lucide-react'


// 詳細區的自動長高輸入（長頁名/備註不被截斷）
function GrowInput({ value, disabled, title, placeholder, onChange, multiline }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [value])
  return (
    <textarea ref={ref} rows={1} value={value} disabled={disabled} title={title} placeholder={placeholder}
      onChange={onChange} onKeyDown={(e) => { if (e.key === 'Enter' && !multiline) e.preventDefault() }}
      style={{ resize: 'none', overflow: 'hidden' }} />
  )
}

// 單行語意、多行顯示的自動長高輸入（驗收條件整句可見）
function GrowLine({ value, disabled, placeholder, onChange }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [value])
  return (
    <textarea ref={ref} rows={1} value={value} disabled={disabled} placeholder={placeholder}
      onChange={onChange} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }} />
  )
}

// 驗收條件：逐條清單列（圓勾徽章 + 一行一條 + 新增/刪除），儲存為換行字串
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

// 標題輸入：多行自動長高（需求名稱常常一行放不下）
function TitleArea({ value, disabled, title, placeholder, onChange }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
    fit()
    // 寬度改變或字型載入完成時重算，避免初次量測過窄造成高度撐大
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


// 對話串（user story 的 Conversation）：客戶氣泡靠左、我方靠右，一框兩鈕送出，自動帶日期
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
  // 預設只顯示最近 2 則，避免對話一長卡片爆長
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

// 手機專屬卡片：名稱如標題、分類膠囊、優先分段器、操作 ghost 列 — 減框線噪音、層級分明
export default function MobileReqCard({ req, index, total }) {
  const { dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const cat = categoryMeta(req.category)
  const locked = isLocked(req)
  const lockTip = locked ? '已確認 — 要修改請先按 ✂ 拆封' : undefined
  const patch = (p) => dispatch({ type: 'UPDATE_REQUIREMENT', id: req.id, patch: p })
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
      <div className="rq-foot">
        <button onClick={() => setOpen((o) => !o)}>{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />} 詳細</button>
        <button onClick={() => dispatch({ type: 'REGENERATE_WIREFRAME', requirementId: req.id })}><RotateCw size={14} /> 版面</button>
        <div className="spacer" />
        <button disabled={index === 0} title="上移" onClick={() => dispatch({ type: 'MOVE_REQUIREMENT', id: req.id, dir: -1 })}><ChevronUp size={16} /></button>
        <button disabled={index === total - 1} title="下移" onClick={() => dispatch({ type: 'MOVE_REQUIREMENT', id: req.id, dir: 1 })}><ChevronDown size={16} /></button>
        <button className="danger" onClick={() => { if (locked) { alert('這條需求已確認（蓋章）。要刪除請先按 ✂ 拆封。'); return } if (confirm('刪除此需求？')) dispatch({ type: 'DELETE_REQUIREMENT', id: req.id }) }}><Trash2 size={14} /></button>
      </div>
      {open && (
        <div className="rq-detail">
          <label><span>故事句（一句話說清楚）</span>
            <GrowInput multiline value={req.description} placeholder="身為＿＿，我想要＿＿，以便＿＿" disabled={locked} title={lockTip} onChange={(e) => patch({ description: e.target.value })} />
          </label>
          {!locked && !req.description && (
            <button className="tk-tpl" onClick={() => patch({ description: '身為＿＿，我想要＿＿，以便＿＿' })}><Plus size={13} /> 用故事模板開頭</button>
          )}
          {!locked && (req.talks || []).length === 0 && (req.description || '').length > 80 && (
            <button className="tk-tpl" onClick={() => patch({ talks: [{ at: Date.now(), who: 'us', text: req.description }], description: '' })}><ArrowDownToLine size={13} /> 這段太長 — 搬進對話串</button>
          )}
          <div className="rq-acc"><span>對話串（客戶說了什麼 / 我方確認了什麼）</span>
            <TalkThread talks={req.talks || []} disabled={locked} onChange={(v) => patch({ talks: v })} />
          </div>
          <div className="rq-acc"><span>驗收條件</span><AcceptList value={req.acceptance} disabled={locked} onChange={(v) => patch({ acceptance: v })} /></div>
          <label><span>對應畫面名稱</span><GrowInput value={req.screen} disabled={locked} title={lockTip} onChange={(e) => patch({ screen: e.target.value })} /></label>
          <label><span>備註</span><GrowInput value={req.note} disabled={locked} title={lockTip} onChange={(e) => patch({ note: e.target.value })} /></label>
          <div className="rq-2">
            <label><span>工時</span><input value={req.estimate} disabled={locked} title={lockTip} onChange={(e) => patch({ estimate: e.target.value })} /></label>
            <label><span>報價</span><input value={req.price} disabled={locked} title={lockTip} onChange={(e) => patch({ price: e.target.value })} /></label>
          </div>
          {((req.versions || []).length > 0 || (req.changeLog || []).length > 0) && (
            <div className="req-history">
              {(req.versions || []).map((v) => <span key={'v' + v.v} className="st-badge st-green">v{v.v} ✓ {new Date(v.at).toLocaleDateString('zh-TW')}</span>)}
              {(req.changeLog || []).map((c, i) => <span key={'c' + i} className="req-h-change">✂ {new Date(c.at).toLocaleDateString('zh-TW')}：{c.note}</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


