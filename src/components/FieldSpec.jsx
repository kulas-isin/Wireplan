import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { downloadText } from '../lib/download.js'
import { extractFields, emptyField, fieldsToMarkdown, F_TYPES, F_REQUIRED, F_SOURCE, F_STATUS, MODULE_CODES } from '../lib/fieldSpec.js'
import { Plus, Download, X, Sparkles } from 'lucide-react'

export default function FieldSpec() {
  const { current, dispatch } = useStore()
  const fields = current.fields || []
  const wireframes = current.wireframes || []
  const [wfId, setWfId] = useState(wireframes[0]?.id || '')

  const setFields = (next) => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'fields', value: next })
  const patch = (k, p) => setFields(fields.map((f) => (f._k === k ? { ...f, ...p } : f)))
  const patchMap = (k, p) => setFields(fields.map((f) => (f._k === k ? { ...f, mapping: { ...f.mapping, ...p } } : f)))
  const del = (k) => setFields(fields.filter((f) => f._k !== k))

  const doExtract = () => {
    const wf = wireframes.find((w) => w.id === wfId)
    if (!wf) return
    const got = extractFields(wf)
    const have = new Set(fields.map((f) => f.label + '|' + (f.mapping?.wf || '')))
    const fresh = got.filter((g) => !have.has(g.label + '|' + (g.mapping?.wf || '')))
    setFields([...fields, ...fresh])
  }

  const Sel = ({ v, opts, onChange }) => (
    <select value={v || ''} onChange={(e) => onChange(e.target.value)}>
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  return (
    <div className="fs-wrap">
      <div className="toolbar">
        <strong>欄位規格</strong>
        <span className="muted" style={{ fontSize: 12 }}>從 wireframe 自動抽欄位 → 下拉補完 11 屬性（視覺規格寫在 wireframe，不寫這）</span>
        <div className="spacer" />
        <select className="fs-wf" value={wfId} onChange={(e) => setWfId(e.target.value)}>
          {wireframes.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <button className="primary" onClick={doExtract}><Sparkles size={15} /> 從此畫面抽欄位</button>
        <button onClick={() => setFields([...fields, emptyField()])}><Plus size={15} /> 空白列</button>
        <button onClick={() => downloadText(`${current.name}-欄位規格.md`, fieldsToMarkdown(current), 'text/markdown')}><Download size={15} /> 匯出 Markdown</button>
      </div>

      {fields.length === 0 ? (
        <div className="empty"><div className="muted">選一張畫面 → 按「從此畫面抽欄位」，欄位 ID/Label/型別會自動帶入，再用下拉補完來源、必填、驗證等。</div></div>
      ) : (
        <div className="fs-tablewrap">
          <table className="fs-table">
            <thead>
              <tr>
                <th>欄位 ID</th><th>Label / i18n</th><th>型別</th><th>必填</th><th>來源</th><th>預設</th>
                <th>驗證規則</th><th>顯示/啟用條件</th><th>使用情境</th><th>對應 WF / API / DB</th><th>狀態</th><th></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f._k}>
                  <td>
                    <div className="fs-id">
                      <select value={idMod(f.id)} onChange={(e) => patch(f._k, { id: e.target.value + '.' + idName(f.id) })} className="fs-mod">
                        <option value="">模組</option>
                        {MODULE_CODES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <input value={idName(f.id)} placeholder="欄位camelCase" onChange={(e) => patch(f._k, { id: idMod(f.id) + '.' + e.target.value })} />
                    </div>
                  </td>
                  <td>
                    <input value={f.label} placeholder="顯示字" onChange={(e) => patch(f._k, { label: e.target.value })} />
                    <input value={f.i18n} placeholder="i18n key" className="fs-sub" onChange={(e) => patch(f._k, { i18n: e.target.value })} />
                  </td>
                  <td><Sel v={f.type} opts={F_TYPES} onChange={(v) => patch(f._k, { type: v })} /></td>
                  <td><Sel v={f.required} opts={F_REQUIRED} onChange={(v) => patch(f._k, { required: v })} /></td>
                  <td><Sel v={f.source} opts={F_SOURCE} onChange={(v) => patch(f._k, { source: v })} /></td>
                  <td><input value={f.default} onChange={(e) => patch(f._k, { default: e.target.value })} /></td>
                  <td><input value={(f.validations || []).join('；')} placeholder="必填；≤30字元…" onChange={(e) => patch(f._k, { validations: e.target.value.split(/[；;]/).map((s) => s.trim()).filter(Boolean) })} /></td>
                  <td><input value={f.visibility} onChange={(e) => patch(f._k, { visibility: e.target.value })} /></td>
                  <td><input value={f.usage} placeholder="7.1 建立(C)…" onChange={(e) => patch(f._k, { usage: e.target.value })} /></td>
                  <td>
                    <input value={f.mapping?.wf || ''} placeholder="WF" className="fs-sub" onChange={(e) => patchMap(f._k, { wf: e.target.value })} />
                    <input value={f.mapping?.api || ''} placeholder="API" className="fs-sub" onChange={(e) => patchMap(f._k, { api: e.target.value })} />
                    <input value={f.mapping?.db || ''} placeholder="DB" className="fs-sub" onChange={(e) => patchMap(f._k, { db: e.target.value })} />
                  </td>
                  <td><Sel v={f.status} opts={F_STATUS} onChange={(v) => patch(f._k, { status: v })} /></td>
                  <td><button className="ghost sm danger" onClick={() => del(f._k)}><X size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const idMod = (id) => String(id || '').split('.')[0] || ''
const idName = (id) => { const p = String(id || '').split('.'); return p.length > 1 ? p.slice(1).join('.') : (p[0] && !MODULE_CODES.includes(p[0]) ? p[0] : '') }
