import { useRef, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { impactOf, changeMessage } from '../lib/change.js'
import { Copy, X, ScissorsLineDashed, Link2 } from 'lucide-react'

// 長按蓋章：按住 0.8 秒才觸發 — 簽核是鄭重的動作
export function HoldStamp({ children, onStamp, className = '' }) {
  const [holding, setHolding] = useState(false)
  const timer = useRef(null)
  const start = (e) => {
    e.preventDefault()
    setHolding(true)
    timer.current = setTimeout(() => { setHolding(false); navigator.vibrate?.(35); onStamp() }, 800)
  }
  const cancel = () => { setHolding(false); clearTimeout(timer.current) }
  return (
    <button className={'hs ' + (holding ? 'holding ' : '') + className}
      onPointerDown={start} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}>
      {children}
    </button>
  )
}

// 漣漪面板：拆封 → 撫平波紋（影響清單全綠）→ 重新蓋章
function ChangeRipple({ req, onClose }) {
  const { current, dispatch } = useStore()
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [stamped, setStamped] = useState(false)
  const pending = req.pending || null
  const patch = (p) => dispatch({ type: 'UPDATE_REQUIREMENT', id: req.id, patch: p })

  const unseal = () => {
    if (!note.trim()) return
    patch({
      pending: { note: note.trim(), at: Date.now(), impact: impactOf(current, req) },
      changeLog: [...(req.changeLog || []), { at: Date.now(), note: note.trim() }],
    })
  }
  const toggle = (key) => patch({ pending: { ...pending, impact: pending.impact.map((it) => (it.key === key ? { ...it, done: !it.done } : it)) } })
  const allDone = pending && pending.impact.every((it) => it.done)
  const copyMsg = async () => {
    const text = changeMessage(req)
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove()
    }
    setCopied(true); setTimeout(() => setCopied(false), 1800)
  }
  const restamp = () => {
    const versions = req.versions || []
    setStamped(true)
    patch({
      versions: [...versions, { v: versions.length + 1, at: Date.now(), snapshot: { name: req.name, priority: req.priority, description: req.description } }],
      pending: null,
    })
    setTimeout(onClose, 700)
  }

  return (
    <div className="cr-backdrop" onClick={onClose}>
      <div className="cr-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cr-head">
          <strong>{pending ? '異動中' : '開始異動'}</strong>
          <button className="ghost sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="cr-center">
          <span className="cr-ring r1" /><span className="cr-ring r2" /><span className="cr-ring r3" />
          <div className={'cr-card' + (stamped ? ' stamped' : '')}>{req.name}{stamped && <span className="cr-stamp-fx">v{(req.versions || []).length} ✓</span>}</div>
        </div>
        {!pending ? (
          <div className="cr-form">
            <textarea rows={2} autoFocus value={note} placeholder="改什麼？誰說的？例：白金會員歌單改無上限（8/30 客戶 LINE）"
              onChange={(e) => setNote(e.target.value)} />
            <button className="tg-big primary" disabled={!note.trim()} onClick={unseal}><ScissorsLineDashed size={16} /> 拆封，開始異動</button>
          </div>
        ) : (
          <div className="cr-form">
            <div className="cr-note">{pending.note}</div>
            {pending.impact.length === 0 ? (
              <div className="muted" style={{ fontSize: 13, textAlign: 'center' }}>沒有偵測到關聯的頁面/欄位/流程 — 確認影響後即可重新蓋章。</div>
            ) : (
              <div className="cr-chips">
                {pending.impact.map((it) => (
                  <button key={it.key} className={'cr-chip' + (it.done ? ' done' : '') + (it.via === 'guess' ? ' guess' : '')} onClick={() => toggle(it.key)}
                    title={it.via === 'link' ? '由此需求產生（精準連結）' : '名稱相似推測，可自行判斷'}>
                    <span className="cr-kind">{it.kind}</span>
                    {it.via === 'link' ? <Link2 size={11} /> : it.via === 'guess' ? <span className="cr-approx">≈</span> : null}
                    {it.label}{it.done ? ' ✓' : ''}
                  </button>
                ))}
              </div>
              <div className="cr-legend"><Link2 size={11} /> 連結建立（準）　<span className="cr-approx">≈</span> 名稱推測（自行判斷）</div>
            )}
            <div className="cr-actions">
              <button className="tg-big" onClick={copyMsg}><Copy size={15} /> {copied ? '已複製！' : '複製異動確認訊息'}</button>
              {allDone ? (
                <HoldStamp className="hs-green" onStamp={restamp}>長按重新蓋章 v{(req.versions || []).length + 1}</HoldStamp>
              ) : (
                <span className="muted" style={{ fontSize: 12 }}>把上面的波紋都點綠，才能重新蓋章</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 需求列的確認狀態格：未確認(長按蓋章) / 已確認 vN(可異動) / 異動中(開漣漪)
export default function ChangeControl({ req }) {
  const { dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const [justStamped, setJustStamped] = useState(false)
  const versions = req.versions || []
  const pending = req.pending || null

  const confirmV1 = () => {
    setJustStamped(true); setTimeout(() => setJustStamped(false), 700)
    dispatch({ type: 'UPDATE_REQUIREMENT', id: req.id, patch: {
      versions: [...versions, { v: versions.length + 1, at: Date.now(), snapshot: { name: req.name, priority: req.priority, description: req.description } }],
    } })
  }

  return (
    <>
      {pending ? (
        <button className="st-badge st-orange" title={pending.note} onClick={() => setOpen(true)}>異動中</button>
      ) : versions.length ? (
        <span className="st-wrap">
          <span className={'st-badge st-green' + (justStamped ? ' pop' : '')} title={new Date(versions[versions.length - 1].at).toLocaleString('zh-TW')}>v{versions.length} ✓</span>
          <button className="ghost sm" title="客戶要改 → 拆封開始異動" onClick={() => setOpen(true)}><ScissorsLineDashed size={13} /></button>
        </span>
      ) : (
        <HoldStamp className="hs-small" onStamp={confirmV1}>長按確認</HoldStamp>
      )}
      {open && <ChangeRipple req={req} onClose={() => setOpen(false)} />}
    </>
  )
}
