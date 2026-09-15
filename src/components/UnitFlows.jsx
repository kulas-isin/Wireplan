import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/StoreContext.jsx'
import Mermaid from './Mermaid.jsx'
import { X, Plus, Pencil, Trash2, GitBranch } from 'lucide-react'

// 新流程圖起手式：照 mermaid 整潔畫法（方向明確、短標籤、引號包字、標示失敗路徑）
const TEMPLATE = (unit) => `flowchart TD
  %% ${unit}：主流程（節點字保持短，細節寫在邊上）
  A["開始"] --> B{"條件判斷？"}
  B -->|"是"| C["處理"]
  B -->|"否"| D["替代路徑"]
  C --> E["完成"]
  D --> E
`

// 單元流程圖：每個單元掛多張 mermaid 流程圖，每張圖有版本（變更原因＋時間）。
// 低維護：看＝直接渲染；改＝貼新的 mermaid 文字＋一句變更原因 → 自動疊一版。
export default function UnitFlows({ unit, onClose }) {
  const { current, dispatch } = useStore()
  const flows = (current.unitFlows || []).filter((f) => f.unit === unit)
  const save = (next) => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'unitFlows', value: next })
  const all = current.unitFlows || []
  const [viewVer, setViewVer] = useState({}) // { flowId: 版本索引 }，預設最新
  const [editing, setEditing] = useState(null) // { flowId|null(新增), name, code, note }
  const [preview, setPreview] = useState('')
  useEffect(() => {
    if (!editing) return
    const t = setTimeout(() => setPreview(editing.code), 600)
    return () => clearTimeout(t)
  }, [editing?.code]) // eslint-disable-line

  const openNew = () => { setPreview(''); setEditing({ flowId: null, name: '', code: TEMPLATE(unit), note: '' }) }
  const openEdit = (f) => { const cur = f.versions[f.versions.length - 1]; setPreview(''); setEditing({ flowId: f.id, name: f.name, code: cur.code, note: '' }) }
  const commit = () => {
    const { flowId, name, code, note } = editing
    if (!code.trim()) return
    if (!flowId) {
      if (!name.trim()) { alert('幫這張流程圖取個名字'); return }
      save([...all, { id: 'uf_' + Math.random().toString(36).slice(2, 10), unit, name: name.trim(), versions: [{ v: 1, at: Date.now(), note: '初版', code }] }])
    } else {
      if (!note.trim()) { alert('寫一句變更原因 — 之後回看才知道為什麼改'); return }
      save(all.map((f) => f.id === flowId ? { ...f, versions: [...f.versions, { v: f.versions.length + 1, at: Date.now(), note: note.trim(), code }] } : f))
      setViewVer((m) => ({ ...m, [flowId]: undefined }))
    }
    setEditing(null)
  }
  const remove = (f) => {
    if (!confirm(`刪除流程圖「${f.name}」與其全部 ${f.versions.length} 個版本？`)) return
    save(all.filter((x) => x.id !== f.id))
  }

  return createPortal(
    <div className="uf-wrap">
      <div className="uf-head">
        <GitBranch size={18} />
        <strong>{unit} · 流程圖（{flows.length}）</strong>
        <div className="spacer" />
        <button className="uf-new" onClick={openNew}><Plus size={14} /> 新增流程圖</button>
        <button className="rd-back" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="uf-body">
        {flows.length === 0 && (
          <div className="uf-empty">
            這個單元還沒有流程圖。<br />
            建議每個單元 1~3 張：一張主流程、必要時加分支情境（退貨、失敗路徑）。<br />
            可以自己畫，也可以把需求丟給 AI 說「畫成 mermaid flowchart」再貼進來。
          </div>
        )}
        {flows.map((f) => {
          const idx = viewVer[f.id] ?? f.versions.length - 1
          const ver = f.versions[idx]
          return (
            <div key={f.id} className="uf-card">
              <div className="uf-card-head">
                <strong>{f.name}</strong>
                <span className="uf-vchips">
                  {f.versions.map((v, i) => (
                    <button key={v.v} className={'uf-vchip' + (i === idx ? ' on' : '')}
                      onClick={() => setViewVer((m) => ({ ...m, [f.id]: i }))}>v{v.v}</button>
                  ))}
                </span>
                <div className="spacer" />
                <button className="uw-mini" title="改一版（保留舊版）" onClick={() => openEdit(f)}><Pencil size={13} /></button>
                <button className="uw-mini uf-del" title="刪除" onClick={() => remove(f)}><Trash2 size={13} /></button>
              </div>
              {idx !== f.versions.length - 1 && <div className="uf-oldnote">正在看 v{ver.v}（舊版）— 點最後一顆版本 chip 回到現行版</div>}
              <Mermaid code={ver.code} />
              <div className="ht-wrap">
                <span className="ht-title">版本履歷</span>
                {f.versions.map((v) => (
                  <div key={v.v} className="ht-row ht-seal">
                    <span className="ht-dot" style={{ fontSize: 10, fontWeight: 800 }}>v{v.v}</span>
                    <span className="ht-txt">{v.note}</span>
                    <span className="ht-date">{new Date(v.at).toLocaleDateString('zh-TW')}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {editing && (
        <div className="uf-editor">
          <div className="uf-head">
            <strong>{editing.flowId ? '改一版：' + editing.name : '新增流程圖'}</strong>
            <div className="spacer" />
            <button className="rd-back" onClick={() => setEditing(null)}><X size={16} /></button>
          </div>
          <div className="uf-editor-body">
            {!editing.flowId && (
              <input className="uf-input" autoFocus value={editing.name} placeholder="流程圖名稱（如：訂單到出貨主流程）"
                onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))} />
            )}
            {editing.flowId && (
              <input className="uf-input" autoFocus value={editing.note} placeholder="變更原因（必填，如：客戶要求加入退款分支）"
                onChange={(e) => setEditing((s) => ({ ...s, note: e.target.value }))} />
            )}
            <textarea className="uf-code" rows={12} value={editing.code} spellCheck={false}
              onChange={(e) => setEditing((s) => ({ ...s, code: e.target.value }))} />
            <div className="uf-tips">
              整潔要領：直向流程用 <b>TD</b>、管線/串接用 <b>LR</b>；節點字短、細節寫在邊標籤；
              角色/系統邊界用 <b>subgraph</b> 當泳道；失敗與例外路徑一定要畫；文字一律用引號包住。
            </div>
            {preview && <><div className="ht-title" style={{ padding: '4px 2px' }}>預覽</div><Mermaid code={preview} /></>}
            <button className="tg-big primary" onClick={commit}>{editing.flowId ? '存為 v' + ((all.find((x) => x.id === editing.flowId)?.versions.length || 0) + 1) : '建立流程圖'}</button>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
