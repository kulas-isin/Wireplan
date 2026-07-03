import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { downloadText } from '../lib/download.js'
import { extractFields, emptyField, emptyDictEntry, fieldsToMarkdown, normalizeField, validateField, wireframeSync, FIELD_TEMPLATES, F_TYPES, F_REQUIRED, F_SOURCE, F_STATUS, MODULE_CODES } from '../lib/fieldSpec.js'
import WireframePreview from './WireframePreview.jsx'
import { Plus, Download, X, Sparkles, PanelRight, Columns3, BookOpen, TriangleAlert } from 'lucide-react'

export default function FieldSpec() {
  const { current, dispatch } = useStore()
  const fields = current.fields || []
  const wireframes = current.wireframes || []
  const [wfId, setWfId] = useState(wireframes[0]?.id || '')
  const [showPreview, setShowPreview] = useState(true)
  const [focusComp, setFocusComp] = useState(null)
  const [full, setFull] = useState(false)
  const [showDict, setShowDict] = useState(false)
  const selectedWf = wireframes.find((w) => w.id === wfId)
  const dictionary = current.dictionary || []
  const dictIds = dictionary.map((d) => d.id).filter(Boolean)

  const setFields = (next) => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'fields', value: next })
  const patch = (k, p) => setFields(fields.map((f) => (f._k === k ? { ...f, ...p } : f)))
  const patchMap = (k, p) => setFields(fields.map((f) => (f._k === k ? { ...f, mapping: { ...f.mapping, ...p } } : f)))
  const del = (k) => setFields(fields.filter((f) => f._k !== k))

  const setDict = (next) => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'dictionary', value: next })
  const patchDict = (k, p) => setDict(dictionary.map((d) => (d._k === k ? { ...d, ...p } : d)))
  const delDict = (k) => setDict(dictionary.filter((d) => d._k !== k))
  // enum 欄位選字典引用（沒有就新建）
  const pickDict = (fk, val) => {
    if (val === '__new') {
      const id = window.prompt('新字典 ID（例 member.plan）：', '')
      if (!id) return
      if (!dictIds.includes(id)) setDict([...dictionary, { ...emptyDictEntry(), id }])
      patch(fk, { dictRef: id, validations: [`見字典 [[${id}]]`] })
      setShowDict(true)
    } else if (val) {
      patch(fk, { dictRef: val, validations: [`見字典 [[${val}]]`] })
    } else {
      patch(fk, { dictRef: null })
    }
  }

  const sync = wireframeSync(current)
  const orphanK = new Map(sync.orphans.map((o) => [o._k, o.reason]))

  // 一鍵登錄「所有畫面上還沒登錄」的欄位
  const registerAllNew = () => {
    const have = new Set(fields.map((f) => (f.ref?.wfId || '') + '|' + f.label))
    const add = []
    for (const wf of wireframes) extractFields(wf).forEach((g) => { const k = wf.id + '|' + g.label; if (!have.has(k)) { have.add(k); add.push(g) } })
    if (add.length) setFields([...fields, ...add])
  }

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
        <select className="fs-wf" value="" onChange={(e) => { const t = FIELD_TEMPLATES[e.target.value]; if (t) setFields([...fields, ...t.rows.map(normalizeField)]); e.target.value = '' }} title="一鍵帶入常見欄位">
          <option value="">＋ 範本…</option>
          {Object.entries(FIELD_TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
        </select>
        <button onClick={() => setFields([...fields, emptyField()])}><Plus size={15} /> 空白列</button>
        <button className={full ? 'active' : ''} onClick={() => setFull((v) => !v)}><Columns3 size={15} /> {full ? '完整欄位' : '簡易'}</button>
        <button className={showDict ? 'active' : ''} onClick={() => setShowDict((v) => !v)}><BookOpen size={15} /> 字典（{dictionary.length}）</button>
        <button className={showPreview ? 'active' : ''} onClick={() => setShowPreview((v) => !v)}><PanelRight size={15} /> {showPreview ? '隱藏畫面' : '顯示畫面'}</button>
        <button onClick={() => downloadText(`${current.name}-欄位規格.md`, fieldsToMarkdown(current), 'text/markdown')}><Download size={15} /> 匯出 Markdown</button>
      </div>

      {(sync.newCount > 0 || sync.orphans.length > 0) && (
        <div className="fs-alert">
          {sync.newCount > 0 && <span className="fs-alert-new"><TriangleAlert size={14} /> 有 {sync.newCount} 個畫面欄位尚未登錄<button className="sm" onClick={registerAllNew}>一鍵登錄</button></span>}
          {sync.orphans.length > 0 && <span className="fs-alert-orphan"><TriangleAlert size={14} /> {sync.orphans.length} 個欄位的來源已刪除/變更（下方紅列）</span>}
        </div>
      )}
      {showDict && (
        <div className="fs-dict">
          <div className="fs-dict-head">
            <strong>欄位字典（單一真相源）</strong>
            <span className="muted" style={{ fontSize: 12 }}>enum / 共用實體只定義一次，欄位用 [[ID]] 引用；改一次全專案一致</span>
            <div className="spacer" />
            <button className="sm" onClick={() => setDict([...dictionary, emptyDictEntry()])}><Plus size={14} /> 字典項</button>
          </div>
          {dictionary.length === 0 ? <div className="muted" style={{ fontSize: 12, padding: 8 }}>還沒有字典項。enum 欄位選「＋新增字典」會自動建立。</div> : (
            <table className="fs-dict-table">
              <thead><tr><th>ID</th><th>值（用 / 或換行分隔）</th><th>說明</th><th>狀態</th><th></th></tr></thead>
              <tbody>
                {dictionary.map((d) => (
                  <tr key={d._k}>
                    <td><input value={d.id} placeholder="member.plan" onChange={(e) => patchDict(d._k, { id: e.target.value })} /></td>
                    <td><input value={(d.values || []).join(' / ')} placeholder="試聽會員 / 白金會員 / 尊爵會員" onChange={(e) => patchDict(d._k, { values: e.target.value.split(/[/\n]/).map((s) => s.trim()).filter(Boolean) })} /></td>
                    <td><input value={d.note} onChange={(e) => patchDict(d._k, { note: e.target.value })} /></td>
                    <td><select value={d.status} onChange={(e) => patchDict(d._k, { status: e.target.value })}>{F_STATUS.map((o) => <option key={o}>{o}</option>)}</select></td>
                    <td><button className="ghost sm danger" onClick={() => delDict(d._k)}><X size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <div className="fs-body">
      {fields.length === 0 ? (
        <div className="empty" style={{ flex: 1 }}><div className="muted">選一張畫面 → 按「從此畫面抽欄位」，欄位 ID/Label/型別會自動帶入，再用下拉補完來源、必填、驗證等。點某一列會在右側畫面高亮對應元件。</div></div>
      ) : (
        <div className="fs-tablewrap">
          <table className="fs-table">
            <thead>
              <tr>
                <th>欄位 ID</th><th>Label / i18n</th><th>型別</th><th>必填</th><th>來源</th>
                {full && <><th>預設</th><th>驗證規則</th><th>顯示/啟用條件</th><th>使用情境</th><th>對應 WF / API / DB</th></>}
                <th>狀態</th><th></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => {
                const issues = validateField(f, fields)
                const orphan = orphanK.get(f._k)
                return (
                <tr key={f._k} className={(focusComp && f.ref?.compId === focusComp ? 'fs-row-on ' : '') + (orphan ? 'fs-row-orphan' : issues.length ? 'fs-row-warn' : '')}
                  onFocusCapture={() => { if (f.ref?.wfId) setWfId(f.ref.wfId); setFocusComp(f.ref?.compId || null) }}
                  onClick={() => { if (f.ref?.wfId) setWfId(f.ref.wfId); setFocusComp(f.ref?.compId || null) }}>
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
                  <td>
                    <Sel v={f.type} opts={F_TYPES} onChange={(v) => patch(f._k, { type: v })} />
                    {f.type === 'enum' && (
                      <select className="fs-dictpick" value={f.dictRef || ''} onChange={(e) => pickDict(f._k, e.target.value)}>
                        <option value="">引用字典…</option>
                        {dictIds.map((id) => <option key={id} value={id}>[[{id}]]</option>)}
                        <option value="__new">＋ 新增字典</option>
                      </select>
                    )}
                  </td>
                  <td><Sel v={f.required} opts={F_REQUIRED} onChange={(v) => patch(f._k, { required: v })} /></td>
                  <td><Sel v={f.source} opts={F_SOURCE} onChange={(v) => patch(f._k, { source: v })} /></td>
                  {full && <>
                    <td><input value={f.default} onChange={(e) => patch(f._k, { default: e.target.value })} /></td>
                    <td><input value={(f.validations || []).join('；')} placeholder="必填；≤30字元…" onChange={(e) => patch(f._k, { validations: e.target.value.split(/[；;]/).map((s) => s.trim()).filter(Boolean) })} /></td>
                    <td><input value={f.visibility} onChange={(e) => patch(f._k, { visibility: e.target.value })} /></td>
                    <td><input value={f.usage} placeholder="7.1 建立(C)…" onChange={(e) => patch(f._k, { usage: e.target.value })} /></td>
                    <td>
                      <input value={f.mapping?.wf || ''} placeholder="WF" className="fs-sub" onChange={(e) => patchMap(f._k, { wf: e.target.value })} />
                      <input value={f.mapping?.api || ''} placeholder="API" className="fs-sub" onChange={(e) => patchMap(f._k, { api: e.target.value })} />
                      <input value={f.mapping?.db || ''} placeholder="DB" className="fs-sub" onChange={(e) => patchMap(f._k, { db: e.target.value })} />
                    </td>
                  </>}
                  <td><Sel v={f.status} opts={F_STATUS} onChange={(v) => patch(f._k, { status: v })} /></td>
                  <td className="fs-actcell">
                    {(issues.length > 0 || orphan) && <span className="fs-warn" title={[orphan, ...issues].filter(Boolean).join(' · ')}><TriangleAlert size={13} /></span>}
                    <button className="ghost sm danger" onClick={() => del(f._k)}><X size={14} /></button>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {showPreview && selectedWf && (
        <div className="fs-preview">
          <div className="fs-preview-head">{selectedWf.name}</div>
          <div className="fs-preview-scroll"><div className="fs-preview-scale"><WireframePreview wireframe={selectedWf} highlightId={focusComp} /></div></div>
        </div>
      )}
      </div>
    </div>
  )
}

const idMod = (id) => String(id || '').split('.')[0] || ''
const idName = (id) => { const p = String(id || '').split('.'); return p.length > 1 ? p.slice(1).join('.') : (p[0] && !MODULE_CODES.includes(p[0]) ? p[0] : '') }
