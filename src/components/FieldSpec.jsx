import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { downloadText } from '../lib/download.js'
import { extractFields, emptyField, emptyDictEntry, fieldsToMarkdown, normalizeField, validateField, wireframeSync, FIELD_TEMPLATES, F_TYPES, F_REQUIRED, F_SOURCE, F_STATUS, MODULE_CODES } from '../lib/fieldSpec.js'
import WireframePreview from './WireframePreview.jsx'
import { Plus, Download, X, Sparkles, PanelRight, BookOpen, TriangleAlert, Pencil, Check } from 'lucide-react'

const idMod = (id) => { const p = String(id || '').split('.'); return p.length > 1 && MODULE_CODES.includes(p[0]) ? p[0] : '' }
const idName = (id) => { const p = String(id || '').split('.'); return p.length > 1 ? p.slice(1).join('.') : (p[0] && !MODULE_CODES.includes(p[0]) ? p[0] : '') }

export default function FieldSpec() {
  const { current, dispatch } = useStore()
  const fields = current.fields || []
  const wireframes = current.wireframes || []
  const [wfId, setWfId] = useState(wireframes[0]?.id || '')
  const [showPreview, setShowPreview] = useState(true)
  const [showDict, setShowDict] = useState(false)
  const [editK, setEditK] = useState(null)
  const [focusComp, setFocusComp] = useState(null)
  const selectedWf = wireframes.find((w) => w.id === wfId)
  const dictionary = current.dictionary || []
  const dictIds = dictionary.map((d) => d.id).filter(Boolean)
  const editF = fields.find((f) => f._k === editK)

  const setFields = (next) => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'fields', value: next })
  const patch = (k, p) => setFields(fields.map((f) => (f._k === k ? { ...f, ...p } : f)))
  const patchMap = (k, p) => setFields(fields.map((f) => (f._k === k ? { ...f, mapping: { ...f.mapping, ...p } } : f)))
  const del = (k) => { setFields(fields.filter((f) => f._k !== k)); if (editK === k) setEditK(null) }

  const setDict = (next) => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'dictionary', value: next })
  const patchDict = (k, p) => setDict(dictionary.map((d) => (d._k === k ? { ...d, ...p } : d)))
  const delDict = (k) => setDict(dictionary.filter((d) => d._k !== k))
  const pickDict = (fk, val) => {
    if (val === '__new') {
      const id = window.prompt('新字典 ID（例 member.plan）：', '')
      if (!id) return
      if (!dictIds.includes(id)) setDict([...dictionary, { ...emptyDictEntry(), id }])
      patch(fk, { dictRef: id, validations: [`見字典 [[${id}]]`] }); setShowDict(true)
    } else if (val) patch(fk, { dictRef: val, validations: [`見字典 [[${val}]]`] })
    else patch(fk, { dictRef: null })
  }

  const sync = wireframeSync(current)
  const orphanK = new Map(sync.orphans.map((o) => [o._k, o.reason]))

  const openEdit = (f) => { setEditK(f._k); if (f.ref?.wfId) setWfId(f.ref.wfId); setFocusComp(f.ref?.compId || null) }
  const addBlank = () => { const f = emptyField(); setFields([...fields, f]); openEdit(f) }

  const doExtract = () => {
    const wf = wireframes.find((w) => w.id === wfId)
    if (!wf) return
    const have = new Set(fields.map((f) => f.label + '|' + (f.mapping?.wf || '')))
    const fresh = extractFields(wf).filter((g) => !have.has(g.label + '|' + (g.mapping?.wf || '')))
    setFields([...fields, ...fresh])
  }
  const registerAllNew = () => {
    const have = new Set(fields.map((f) => (f.ref?.wfId || '') + '|' + f.label))
    const add = []
    for (const wf of wireframes) extractFields(wf).forEach((g) => { const k = wf.id + '|' + g.label; if (!have.has(k)) { have.add(k); add.push(g) } })
    if (add.length) setFields([...fields, ...add])
  }

  const Sel = ({ v, opts, onChange, cls }) => (
    <select className={cls} value={v || ''} onChange={(e) => onChange(e.target.value)}>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>
  )

  return (
    <div className="fs-wrap">
      <div className="toolbar">
        <strong>欄位規格</strong>
        <span className="muted" style={{ fontSize: 12 }}>點一列 → 右側編輯。從 wireframe 自動抽欄位、範本帶入，只需審改</span>
        <div className="spacer" />
        <select className="fs-wf" value={wfId} onChange={(e) => setWfId(e.target.value)}>
          {wireframes.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <button className="primary" onClick={doExtract}><Sparkles size={15} /> 從此畫面抽欄位</button>
        <select className="fs-wf" value="" onChange={(e) => { const t = FIELD_TEMPLATES[e.target.value]; if (t) setFields([...fields, ...t.rows.map(normalizeField)]); e.target.value = '' }} title="一鍵帶入常見欄位">
          <option value="">＋ 範本…</option>
          {Object.entries(FIELD_TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
        </select>
        <button onClick={addBlank}><Plus size={15} /> 空白列</button>
        <button className={showDict ? 'active' : ''} onClick={() => setShowDict((v) => !v)}><BookOpen size={15} /> 字典（{dictionary.length}）</button>
        <button className={showPreview ? 'active' : ''} onClick={() => setShowPreview((v) => !v)}><PanelRight size={15} /> {showPreview ? '隱藏畫面' : '顯示畫面'}</button>
        <button onClick={() => downloadText(`${current.name}-欄位規格.md`, fieldsToMarkdown(current), 'text/markdown')}><Download size={15} /> 匯出</button>
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
          <div className="empty" style={{ flex: 1 }}><div className="muted">選一張畫面 → 按「從此畫面抽欄位」，或用「＋ 範本」。欄位會出現在清單，點任一列到右側編輯。</div></div>
        ) : (
          <div className="fs-listwrap">
            <table className="fs-list">
              <thead><tr><th>欄位</th><th>ID</th><th>型別</th><th>必填</th><th>來源</th><th>狀態</th><th></th></tr></thead>
              <tbody>
                {fields.map((f) => {
                  const issues = validateField(f, fields)
                  const orphan = orphanK.get(f._k)
                  return (
                    <tr key={f._k} className={(editK === f._k ? 'sel ' : '') + (orphan ? 'fs-row-orphan' : issues.length ? 'fs-row-warn' : '')} onClick={() => openEdit(f)}>
                      <td><div className="fs-l-label">{f.label || <span className="muted">（未命名）</span>}</div>{f.i18n && <div className="fs-sub">{f.i18n}</div>}</td>
                      <td>{f.id ? <code>{f.id}</code> : <span className="muted">未設 ID</span>}</td>
                      <td><span className="fs-chip">{f.type}</span></td>
                      <td>{f.required}</td>
                      <td>{f.source}</td>
                      <td><span className={'fs-st fs-st-' + f.status}>{f.status}</span></td>
                      <td className="fs-actcell">
                        {(issues.length > 0 || orphan) && <span className="fs-warn" title={[orphan, ...issues].filter(Boolean).join(' · ')}><TriangleAlert size={13} /></span>}
                        <Pencil size={13} className="fs-editicon" />
                        <button className="ghost sm danger" onClick={(e) => { e.stopPropagation(); del(f._k) }}><X size={14} /></button>
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

      {editF && (
        <>
          <div className="fe-backdrop" onClick={() => setEditK(null)} />
          <div className="fe-drawer">
            <div className="fe-head">
              <strong>{editF.label || '編輯欄位'}</strong>
              <button className="ghost sm" onClick={() => setEditK(null)}><X size={16} /></button>
            </div>
            {(() => { const iss = validateField(editF, fields); const orp = orphanK.get(editF._k); return (iss.length || orp) ? (
              <div className="fe-issues">{[orp, ...iss].filter(Boolean).map((m, i) => <div key={i}><TriangleAlert size={12} /> {m}</div>)}</div>
            ) : null })()}
            <div className="fe-body">
              <label className="fe-row"><span>欄位 ID</span>
                <div className="fe-id">
                  <select value={idMod(editF.id)} onChange={(e) => patch(editF._k, { id: (e.target.value || '') + '.' + idName(editF.id) })}>
                    <option value="">模組</option>{MODULE_CODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input value={idName(editF.id)} placeholder="欄位camelCase" onChange={(e) => patch(editF._k, { id: idMod(editF.id) + '.' + e.target.value })} />
                </div>
              </label>
              <label className="fe-row"><span>Label 顯示字</span><input value={editF.label} onChange={(e) => patch(editF._k, { label: e.target.value })} /></label>
              <label className="fe-row"><span>i18n key</span><input value={editF.i18n} placeholder="純後台可留空" onChange={(e) => patch(editF._k, { i18n: e.target.value })} /></label>
              <label className="fe-row"><span>型別</span>
                <div className="fe-type">
                  <Sel v={editF.type} opts={F_TYPES} onChange={(v) => patch(editF._k, { type: v })} />
                  {editF.type === 'enum' && (
                    <select className="fs-dictpick" value={editF.dictRef || ''} onChange={(e) => pickDict(editF._k, e.target.value)}>
                      <option value="">引用字典…</option>
                      {dictIds.map((id) => <option key={id} value={id}>[[{id}]]</option>)}
                      <option value="__new">＋ 新增字典</option>
                    </select>
                  )}
                </div>
              </label>
              <label className="fe-row"><span>必填</span><Sel v={editF.required} opts={F_REQUIRED} onChange={(v) => patch(editF._k, { required: v })} /></label>
              <label className="fe-row"><span>來源</span><Sel v={editF.source} opts={F_SOURCE} onChange={(v) => patch(editF._k, { source: v })} /></label>
              <label className="fe-row"><span>預設值</span><input value={editF.default} onChange={(e) => patch(editF._k, { default: e.target.value })} /></label>
              <label className="fe-row"><span>驗證規則<br /><small>一行一條</small></span>
                <textarea rows={3} value={(editF.validations || []).join('\n')} placeholder={'必填\n≤30 字元'} onChange={(e) => patch(editF._k, { validations: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} />
              </label>
              <label className="fe-row"><span>顯示/啟用條件</span><input value={editF.visibility} onChange={(e) => patch(editF._k, { visibility: e.target.value })} /></label>
              <label className="fe-row"><span>使用情境</span><input value={editF.usage} placeholder="7.1 建立(C)…" onChange={(e) => patch(editF._k, { usage: e.target.value })} /></label>
              <div className="fe-group">對應（WF 為必填，API/DB 待 RD）</div>
              <label className="fe-row"><span>WF</span><input value={editF.mapping?.wf || ''} onChange={(e) => patchMap(editF._k, { wf: e.target.value })} /></label>
              <label className="fe-row"><span>API</span><input value={editF.mapping?.api || ''} onChange={(e) => patchMap(editF._k, { api: e.target.value })} /></label>
              <label className="fe-row"><span>DB</span><input value={editF.mapping?.db || ''} onChange={(e) => patchMap(editF._k, { db: e.target.value })} /></label>
              <label className="fe-row"><span>狀態</span><Sel v={editF.status} opts={F_STATUS} onChange={(v) => patch(editF._k, { status: v })} /></label>
            </div>
            <div className="fe-foot">
              <button className="ghost sm danger" onClick={() => del(editF._k)}><X size={14} /> 刪除欄位</button>
              <div className="spacer" />
              <button className="primary" onClick={() => setEditK(null)}><Check size={15} /> 完成</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
