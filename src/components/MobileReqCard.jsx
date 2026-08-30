import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { CATEGORY_LIST, categoryMeta } from '../lib/categories.js'
import ChangeControl from './ChangeControl.jsx'
import { isLocked } from '../lib/change.js'
import { ChevronUp, ChevronDown, RotateCw, Trash2 } from 'lucide-react'


// 詳細區的自動長高輸入（長頁名/備註不被截斷）
function GrowInput({ value, disabled, title, placeholder, onChange }) {
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
      onChange={onChange} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
      style={{ resize: 'none', overflow: 'hidden' }} />
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
          <label><span>功能說明</span><textarea rows={2} value={req.description} disabled={locked} title={lockTip} onChange={(e) => patch({ description: e.target.value })} /></label>
          <label><span>驗收條件（每行一條）</span><textarea rows={2} value={req.acceptance} placeholder="留空用預設" disabled={locked} title={lockTip} onChange={(e) => patch({ acceptance: e.target.value })} /></label>
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


