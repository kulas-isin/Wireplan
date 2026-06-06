import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { newRequirement } from '../lib/requirementExtractor.js'
import { CATEGORY_LIST, categoryMeta } from '../lib/categories.js'

function RequirementRow({ req, index, total }) {
  const { dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const cat = categoryMeta(req.category)

  const patch = (p) => dispatch({ type: 'UPDATE_REQUIREMENT', id: req.id, patch: p })

  return (
    <>
      <tr>
        <td>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button className="ghost sm" disabled={index === 0} onClick={() => dispatch({ type: 'MOVE_REQUIREMENT', id: req.id, dir: -1 })}>▲</button>
            <button className="ghost sm" disabled={index === total - 1} onClick={() => dispatch({ type: 'MOVE_REQUIREMENT', id: req.id, dir: 1 })}>▼</button>
          </div>
        </td>
        <td style={{ width: '24%' }}>
          <input value={req.name} onChange={(e) => patch({ name: e.target.value })} />
        </td>
        <td>
          <select
            value={req.category}
            onChange={(e) => patch({ category: e.target.value })}
            style={{ borderLeft: `4px solid ${cat.color}` }}
          >
            {CATEGORY_LIST.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </td>
        <td style={{ width: 70 }}>
          <select value={req.priority} onChange={(e) => patch({ priority: e.target.value })}>
            <option>高</option><option>中</option><option>低</option>
          </select>
        </td>
        <td style={{ width: 80 }}><input value={req.estimate} onChange={(e) => patch({ estimate: e.target.value })} placeholder="工時" /></td>
        <td style={{ width: 90 }}><input value={req.price} onChange={(e) => patch({ price: e.target.value })} placeholder="報價" /></td>
        <td>
          <div className="req-actions">
            <button className="sm" onClick={() => setOpen((o) => !o)}>{open ? '收合' : '詳細'}</button>
            <button className="sm" title="依分類重新產生 wireframe" onClick={() => dispatch({ type: 'REGENERATE_WIREFRAME', requirementId: req.id })}>↻ 版面</button>
            <button className="sm danger" onClick={() => { if (confirm('刪除此需求？')) dispatch({ type: 'DELETE_REQUIREMENT', id: req.id }) }}>✕</button>
          </div>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} style={{ background: '#f8fafc' }}>
            <div className="grid2" style={{ padding: '6px 2px' }}>
              <label className="field">
                <span>功能說明</span>
                <textarea value={req.description} onChange={(e) => patch({ description: e.target.value })} />
              </label>
              <label className="field">
                <span>驗收條件（每行一條）</span>
                <textarea value={req.acceptance} onChange={(e) => patch({ acceptance: e.target.value })} placeholder="留空則使用預設驗收條件" />
              </label>
              <label className="field">
                <span>對應畫面名稱</span>
                <input value={req.screen} onChange={(e) => patch({ screen: e.target.value })} />
              </label>
              <label className="field">
                <span>備註</span>
                <input value={req.note} onChange={(e) => patch({ note: e.target.value })} />
              </label>
            </div>
            <div className="row" style={{ paddingBottom: 8 }}>
              <button className="sm" onClick={() => dispatch({ type: 'REDETECT_CATEGORY', id: req.id })}>🔍 重新自動判斷分類</button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function RequirementsEditor() {
  const { current, dispatch } = useStore()
  const reqs = current.requirements

  function addBlank() {
    dispatch({ type: 'ADD_REQUIREMENT', requirement: newRequirement({ name: '新功能', screen: '新功能' }) })
  }

  if (!reqs.length) {
    return (
      <div className="empty">
        <div className="big">📋</div>
        <div>尚無需求項目</div>
        <div style={{ marginTop: 12 }}>
          <button className="primary" onClick={addBlank}>＋ 手動新增需求</button>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>或切換到「匯入」分頁匯入報價單。</div>
      </div>
    )
  }

  return (
    <div>
      <div className="toolbar">
        <strong>需求清單（{reqs.length} 項）</strong>
        <div className="spacer" />
        <button onClick={addBlank}>＋ 新增需求</button>
        <button onClick={() => dispatch({ type: 'REGENERATE_FLOW' })}>↻ 重新產生流程</button>
      </div>
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="req">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th>功能名稱</th>
              <th>分類（決定版面）</th>
              <th>優先</th>
              <th>工時</th>
              <th>報價</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {reqs.map((r, i) => (
              <RequirementRow key={r.id} req={r} index={i} total={reqs.length} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        💡 變更「分類」後，按該列的「↻ 版面」可依新分類重新產生 wireframe；修改名稱／順序會即時反映到流程文件。
      </div>
    </div>
  )
}
