import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { COMPONENT_TYPES, newComponent } from '../lib/wireframeTemplates.js'
import WireframeBlock, { ARRAY_PROP } from './WireframeBlock.jsx'
import { categoryMeta } from '../lib/categories.js'

// 常用元件的快速新增按鈕順序
const QUICK_ADD = ['header', 'field', 'buttonRow', 'table', 'text', 'searchbar', 'statcards', 'chart', 'tabs', 'list', 'steps', 'divider']

function ComponentEditor({ wireframe, cmp }) {
  const { dispatch } = useStore()
  const arrKey = ARRAY_PROP[cmp.type]
  const update = (patch) => dispatch({ type: 'UPDATE_COMPONENT', wireframeId: wireframe.id, componentId: cmp.id, patch })

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', background: '#fffbeb', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        編輯元件：{COMPONENT_TYPES[cmp.type]?.label || cmp.type}
      </div>
      <label className="field" style={{ marginBottom: 8 }}>
        <span>標籤 / 標題文字</span>
        <input value={cmp.label || ''} onChange={(e) => update({ label: e.target.value })} />
      </label>

      {cmp.type === 'field' && (
        <label className="field" style={{ marginBottom: 8 }}>
          <span>欄位型別</span>
          <select value={cmp.control || 'input'} onChange={(e) => update({ control: e.target.value })}>
            <option value="input">單行輸入</option>
            <option value="textarea">多行輸入</option>
            <option value="select">下拉選單</option>
            <option value="password">密碼</option>
            <option value="toggle">開關</option>
          </select>
        </label>
      )}

      {arrKey && (
        <label className="field" style={{ marginBottom: 0 }}>
          <span>{arrKey === 'columns' ? '欄位（逗號分隔）' : arrKey === 'buttons' ? '按鈕（逗號分隔）' : '項目（逗號分隔）'}</span>
          <input
            value={(cmp[arrKey] || []).join(', ')}
            onChange={(e) => update({ [arrKey]: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
          />
        </label>
      )}
    </div>
  )
}

function WireframeFrame({ wireframe, requirement }) {
  const { dispatch } = useStore()
  const [selectedCmp, setSelectedCmp] = useState(null)
  const cat = requirement ? categoryMeta(requirement.category) : null

  const addComponent = (type) => {
    const c = newComponent(type)
    dispatch({ type: 'ADD_COMPONENT', wireframeId: wireframe.id, component: c })
    setSelectedCmp(c.id)
  }

  return (
    <div className="wf-frame" onClick={() => setSelectedCmp(null)}>
      <div className="wf-titlebar">
        {cat && <span className="tag" style={{ background: cat.color }}>{cat.label}</span>}
        <input
          value={wireframe.name}
          onChange={(e) => dispatch({ type: 'UPDATE_WIREFRAME', id: wireframe.id, patch: { name: e.target.value } })}
        />
        <div className="device-toggle">
          <button
            className={wireframe.device === 'desktop' ? 'active' : ''}
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_WIREFRAME', id: wireframe.id, patch: { device: 'desktop' } }) }}
          >🖥</button>
          <button
            className={wireframe.device === 'mobile' ? 'active' : ''}
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPDATE_WIREFRAME', id: wireframe.id, patch: { device: 'mobile' } }) }}
          >📱</button>
        </div>
        {requirement && (
          <button
            className="ghost sm"
            title="依需求分類重新產生版面"
            onClick={(e) => { e.stopPropagation(); if (confirm('重新產生會覆蓋目前此畫面的調整，確定？')) dispatch({ type: 'REGENERATE_WIREFRAME', requirementId: requirement.id }) }}
          >↻</button>
        )}
      </div>

      <div className={'wf-canvas' + (wireframe.device === 'mobile' ? ' mobile' : '')}>
        {wireframe.components.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 20 }}>空白畫面，使用下方按鈕新增元件</div>}
        {wireframe.components.map((cmp) => (
          <WireframeBlock
            key={cmp.id}
            cmp={cmp}
            selected={selectedCmp === cmp.id}
            onSelect={() => setSelectedCmp(cmp.id)}
            onMove={(dir) => dispatch({ type: 'MOVE_COMPONENT', wireframeId: wireframe.id, componentId: cmp.id, dir })}
            onDelete={() => { dispatch({ type: 'DELETE_COMPONENT', wireframeId: wireframe.id, componentId: cmp.id }); setSelectedCmp(null) }}
          />
        ))}
      </div>

      {selectedCmp && wireframe.components.find((c) => c.id === selectedCmp) && (
        <div onClick={(e) => e.stopPropagation()}>
          <ComponentEditor wireframe={wireframe} cmp={wireframe.components.find((c) => c.id === selectedCmp)} />
        </div>
      )}

      <div className="add-cmp-bar" onClick={(e) => e.stopPropagation()}>
        {QUICK_ADD.map((t) => (
          <button key={t} title={`新增${COMPONENT_TYPES[t]?.label}`} onClick={() => addComponent(t)}>
            ＋{COMPONENT_TYPES[t]?.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function WireframeBoard() {
  const { current } = useStore()
  const wireframes = current.wireframes || []

  if (!wireframes.length) {
    return (
      <div className="empty">
        <div className="big">🖼</div>
        <div>尚無 wireframe</div>
        <div className="muted" style={{ marginTop: 8 }}>先在「匯入」或「需求」分頁建立需求，系統會自動產生對應畫面。</div>
      </div>
    )
  }

  const reqById = new Map(current.requirements.map((r) => [r.id, r]))

  return (
    <div>
      <div className="toolbar">
        <strong>畫面 Wireframe（{wireframes.length} 個）</strong>
        <div className="muted" style={{ fontSize: 12 }}>點元件可編輯文字、欄位、按鈕；hover 可上下移動／刪除。</div>
      </div>
      <div className="wf-board">
        {wireframes.map((wf) => (
          <WireframeFrame key={wf.id} wireframe={wf} requirement={reqById.get(wf.requirementId)} />
        ))}
      </div>
    </div>
  )
}
