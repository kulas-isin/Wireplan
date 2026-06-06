import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { COMPONENT_TYPES, COMPONENT_GROUPS, newComponent } from '../lib/wireframeTemplates.js'
import WireframeBlock, { ARRAY_PROP } from './WireframeBlock.jsx'
import { categoryMeta } from '../lib/categories.js'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { Monitor, Smartphone, RotateCw, Copy, LayoutTemplate } from 'lucide-react'

const WIDTHS = [
  { key: 'full', label: '整列' },
  { key: 'half', label: '½' },
  { key: 'third', label: '⅓' },
  { key: 'quarter', label: '¼' },
]

function ComponentEditor({ wireframe, cmp }) {
  const { dispatch } = useStore()
  const arrKey = ARRAY_PROP[cmp.type]
  const update = (patch) => dispatch({ type: 'UPDATE_COMPONENT', wireframeId: wireframe.id, componentId: cmp.id, patch })

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '12px', background: '#fffdf5', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        編輯元件：{COMPONENT_TYPES[cmp.type]?.label || cmp.type}
      </div>

      <label className="field" style={{ marginBottom: 8 }}>
        <span>標籤 / 標題文字</span>
        <input value={cmp.label || ''} onChange={(e) => update({ label: e.target.value })} />
      </label>

      <label className="field" style={{ marginBottom: 8 }}>
        <span>寬度</span>
        <div className="wseg">
          {WIDTHS.map((w) => (
            <button key={w.key} className={(cmp.width || 'full') === w.key ? 'active' : ''} onClick={() => update({ width: w.key })}>
              {w.label}
            </button>
          ))}
        </div>
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const addComponent = (type) => {
    const c = newComponent(type)
    dispatch({ type: 'ADD_COMPONENT', wireframeId: wireframe.id, component: c })
    setSelectedCmp(c.id)
  }

  const onDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = wireframe.components.map((c) => c.id)
    const oldIdx = ids.indexOf(active.id)
    const newIdx = ids.indexOf(over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const reordered = [...ids]
    reordered.splice(oldIdx, 1)
    reordered.splice(newIdx, 0, active.id)
    dispatch({ type: 'REORDER_COMPONENTS', wireframeId: wireframe.id, orderedIds: reordered })
  }

  const setDevice = (device) => dispatch({ type: 'UPDATE_WIREFRAME', id: wireframe.id, patch: { device } })

  return (
    <div className="wf-frame" onClick={() => setSelectedCmp(null)}>
      <div className="wf-titlebar">
        {cat && <span className="tag" style={{ background: cat.color }}>{cat.label}</span>}
        <input
          value={wireframe.name}
          onChange={(e) => dispatch({ type: 'UPDATE_WIREFRAME', id: wireframe.id, patch: { name: e.target.value } })}
        />
        <div className="device-toggle">
          <button title="桌機版面" className={wireframe.device === 'desktop' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setDevice('desktop') }}><Monitor size={15} /></button>
          <button title="行動版面" className={wireframe.device === 'mobile' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setDevice('mobile') }}><Smartphone size={15} /></button>
        </div>
        <button className="ghost sm" title="複製整頁" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DUPLICATE_WIREFRAME', id: wireframe.id }) }}><Copy size={14} /></button>
        {requirement && (
          <button className="ghost sm" title="依需求分類重新產生版面"
            onClick={(e) => { e.stopPropagation(); if (confirm('重新產生會覆蓋目前此畫面的調整，確定？')) dispatch({ type: 'REGENERATE_WIREFRAME', requirementId: requirement.id }) }}
          ><RotateCw size={14} /></button>
        )}
      </div>

      <div className={'wf-canvas' + (wireframe.device === 'mobile' ? ' mobile' : '')}>
        {wireframe.components.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 20, width: '100%' }}>空白畫面，使用下方元件庫新增</div>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={wireframe.components.map((c) => c.id)} strategy={rectSortingStrategy}>
            {wireframe.components.map((cmp) => (
              <WireframeBlock
                key={cmp.id}
                cmp={cmp}
                selected={selectedCmp === cmp.id}
                onSelect={() => setSelectedCmp(cmp.id)}
                onDuplicate={() => dispatch({ type: 'DUPLICATE_COMPONENT', wireframeId: wireframe.id, componentId: cmp.id })}
                onDelete={() => { dispatch({ type: 'DELETE_COMPONENT', wireframeId: wireframe.id, componentId: cmp.id }); setSelectedCmp(null) }}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {selectedCmp && wireframe.components.find((c) => c.id === selectedCmp) && (
        <div onClick={(e) => e.stopPropagation()}>
          <ComponentEditor wireframe={wireframe} cmp={wireframe.components.find((c) => c.id === selectedCmp)} />
        </div>
      )}

      <div className="add-cmp-bar" onClick={(e) => e.stopPropagation()}>
        {COMPONENT_GROUPS.map((g) => (
          <div className="palette-group" key={g.group}>
            <div className="pg-title">{g.group}</div>
            <div className="pg-items">
              {g.types.map((t) => (
                <button key={t} onClick={() => addComponent(t)}>＋{COMPONENT_TYPES[t]?.label}</button>
              ))}
            </div>
          </div>
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
        <div className="big"><LayoutTemplate size={40} /></div>
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
        <div className="muted" style={{ fontSize: 12 }}>拖曳左上把手排序、點元件可設寬度與內容、可複製元件或整頁。</div>
      </div>
      <div className="wf-board">
        {wireframes.map((wf) => (
          <WireframeFrame key={wf.id} wireframe={wf} requirement={reqById.get(wf.requirementId)} />
        ))}
      </div>
    </div>
  )
}
