import { Fragment, useEffect, useRef, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { COMPONENT_TYPES, COMPONENT_GROUPS, newComponent } from '../lib/wireframeTemplates.js'
import WireframeBlock, { ARRAY_PROP } from './WireframeBlock.jsx'
import { categoryMeta } from '../lib/categories.js'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { Monitor, Smartphone, RotateCw, Copy, Trash2, Plus, LayoutTemplate, Columns2, PanelLeft, PanelLeftClose } from 'lucide-react'
import { ConfigProvider } from 'antd'

// 套用品牌綠主題給 wireframe 內的 antd 元件
const WF_THEME = {
  token: { colorPrimary: '#2e9e5b', borderRadius: 8, fontFamily: 'inherit' },
}

const WIDTHS = [
  { key: 'full', label: '整列' },
  { key: 'half', label: '½' },
  { key: 'third', label: '⅓' },
  { key: 'quarter', label: '¼' },
]

const ALIGNS = [
  { key: 'left', label: '靠左' },
  { key: 'center', label: '置中' },
  { key: 'right', label: '靠右' },
]

function ComponentEditor({ wireframe, cmp, layout, onClose }) {
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

      <label className="field" style={{ marginBottom: 8 }}>
        <span>對齊</span>
        <div className="wseg">
          {ALIGNS.map((a) => (
            <button key={a.key} className={(cmp.align || 'left') === a.key ? 'active' : ''} onClick={() => update({ align: a.key })}>
              {a.label}
            </button>
          ))}
        </div>
      </label>

      {layout === 'sidebar' && (
        <label className="field" style={{ marginBottom: 8 }}>
          <span>所屬區域</span>
          <div className="wseg">
            <button className={(cmp.region || 'content') === 'content' ? 'active' : ''} onClick={() => update({ region: 'content' })}>內容區</button>
            <button className={cmp.region === 'sidebar' ? 'active' : ''} onClick={() => update({ region: 'sidebar' })}>側邊欄</button>
          </div>
        </label>
      )}

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

      <div className="row" style={{ marginTop: 12, gap: 6 }}>
        <button className="sm" onClick={() => dispatch({ type: 'DUPLICATE_COMPONENT', wireframeId: wireframe.id, componentId: cmp.id })}><Copy size={13} /> 複製</button>
        <button className="sm danger" onClick={() => { dispatch({ type: 'DELETE_COMPONENT', wireframeId: wireframe.id, componentId: cmp.id }); onClose?.() }}><Trash2 size={13} /> 刪除</button>
        <div className="spacer" />
        <button className="sm" onClick={() => onClose?.()}>完成</button>
      </div>
    </div>
  )
}

function WireframeFrame({ wireframe, requirement }) {
  const { dispatch } = useStore()
  const [selectedCmp, setSelectedCmp] = useState(null)
  const [paletteOpen, setPaletteOpen] = useState(null) // null | 'content' | 'sidebar'
  const cat = requirement ? categoryMeta(requirement.category) : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const addComponent = (type, region = 'content') => {
    const c = newComponent(type)
    if (region === 'sidebar') c.region = 'sidebar'
    dispatch({ type: 'ADD_COMPONENT', wireframeId: wireframe.id, component: c })
    setSelectedCmp(c.id)
    setPaletteOpen(null)
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

  const layout = wireframe.layout || 'stack'
  const toggleLayout = () => {
    const next = layout === 'sidebar' ? 'stack' : 'sidebar'
    dispatch({ type: 'UPDATE_WIREFRAME', id: wireframe.id, patch: { layout: next } })
    if (next === 'sidebar' && !wireframe.components.some((c) => c.region === 'sidebar')) {
      dispatch({ type: 'ADD_COMPONENT', wireframeId: wireframe.id, component: { ...newComponent('image'), label: 'Logo', region: 'sidebar', align: 'center' } })
      dispatch({ type: 'ADD_COMPONENT', wireframeId: wireframe.id, component: { ...newComponent('sidenav'), region: 'sidebar' } })
    }
  }

  const sidebarItems = wireframe.components.filter((c) => c.region === 'sidebar')
  const contentItems = wireframe.components.filter((c) => c.region !== 'sidebar')

  const blockNode = (cmp) => (
    <Fragment key={cmp.id}>
      <WireframeBlock
        cmp={cmp}
        selected={selectedCmp === cmp.id}
        onSelect={() => setSelectedCmp(cmp.id)}
        onDuplicate={() => dispatch({ type: 'DUPLICATE_COMPONENT', wireframeId: wireframe.id, componentId: cmp.id })}
        onDelete={() => { dispatch({ type: 'DELETE_COMPONENT', wireframeId: wireframe.id, componentId: cmp.id }); setSelectedCmp(null) }}
      />
      {selectedCmp === cmp.id && (
        <div className="wf-item w-full" onClick={(e) => e.stopPropagation()}>
          <ComponentEditor wireframe={wireframe} cmp={cmp} layout={layout} onClose={() => setSelectedCmp(null)} />
        </div>
      )}
    </Fragment>
  )

  const column = (items, region, mobile) => (
    <div className="wf-colwrap">
      <div className={'wf-canvas' + (mobile ? ' mobile' : '')}>
        {items.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 16, width: '100%' }}>{region === 'sidebar' ? '側邊欄為空' : '空白，點下方新增'}</div>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((c) => c.id)} strategy={rectSortingStrategy}>
            {items.map(blockNode)}
          </SortableContext>
        </DndContext>
      </div>
      <div className="add-cmp-bar" onClick={(e) => e.stopPropagation()}>
        <button className="primary sm" onClick={() => setPaletteOpen((o) => (o === region ? null : region))}><Plus size={14} /> 新增{region === 'sidebar' ? '側欄' : ''}元件</button>
        {paletteOpen === region && (
          <div className="palette-pop">
            {COMPONENT_GROUPS.map((g) => (
              <div className="palette-group" key={g.group}>
                <div className="pg-title">{g.group}</div>
                <div className="pg-items">
                  {g.types.map((t) => (
                    <button key={t} onClick={() => addComponent(t, region)}>＋{COMPONENT_TYPES[t]?.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="wf-frame" id={`wf-${wireframe.id}`} onClick={() => { setSelectedCmp(null); setPaletteOpen(null) }}>
      <div className="wf-titlebar">
        <span className="wf-dots"><i /><i /><i /></span>
        {cat && <span className="tag" style={{ background: cat.color }}>{cat.label}</span>}
        <input
          value={wireframe.name}
          onChange={(e) => dispatch({ type: 'UPDATE_WIREFRAME', id: wireframe.id, patch: { name: e.target.value } })}
        />
        <button className="ghost sm" title={layout === 'sidebar' ? '切換為堆疊版面' : '切換為兩欄版面(側邊欄+內容)'} onClick={(e) => { e.stopPropagation(); toggleLayout() }}>
          {layout === 'sidebar' ? <Columns2 size={15} /> : <PanelLeft size={15} />}
        </button>
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
        <button className="ghost sm danger" title="刪除畫面"
          onClick={(e) => { e.stopPropagation(); if (confirm(`刪除畫面「${wireframe.name}」？`)) dispatch({ type: 'DELETE_WIREFRAME', id: wireframe.id }) }}
        ><Trash2 size={14} /></button>
      </div>

      {layout === 'sidebar' ? (
        <div className="wf-admin">
          <div className="wf-side">{column(sidebarItems, 'sidebar', false)}</div>
          <div className="wf-content-col">{column(contentItems, 'content', false)}</div>
        </div>
      ) : (
        column(wireframe.components, 'content', wireframe.device === 'mobile')
      )}
    </div>
  )
}

export default function WireframeBoard() {
  const { current, dispatch } = useStore()
  const wireframes = current.wireframes || []
  const [selectedId, setSelectedId] = useState(null)
  const [navOpen, setNavOpen] = useState(true)

  // 新增 / 複製畫面後自動選取最新的那一個
  const prevLen = useRef(wireframes.length)
  useEffect(() => {
    if (wireframes.length > prevLen.current) setSelectedId(wireframes[wireframes.length - 1].id)
    prevLen.current = wireframes.length
  }, [wireframes])

  if (!wireframes.length) {
    return (
      <div className="empty">
        <div className="big"><LayoutTemplate size={40} /></div>
        <div>尚無 wireframe</div>
        <div className="muted" style={{ marginTop: 8 }}>先在「匯入」或「需求」分頁建立需求，系統會自動產生對應畫面。</div>
        <div style={{ marginTop: 12 }}>
          <button className="primary" onClick={() => dispatch({ type: 'ADD_BLANK_WIREFRAME', name: '新畫面 1' })}><Plus size={15} /> 新增空白畫面</button>
        </div>
      </div>
    )
  }

  const reqById = new Map(current.requirements.map((r) => [r.id, r]))
  const selected = wireframes.find((w) => w.id === selectedId) || wireframes[0]

  return (
    <ConfigProvider theme={WF_THEME}>
      <div className="wf-studio">
        {!navOpen && (
          <div className="wf-screens-toggle" title="展開畫面清單" onClick={() => setNavOpen(true)}>
            <PanelLeft size={18} />
          </div>
        )}
        {navOpen && (
        <aside className="wf-screens">
          <div className="ws-head">
            <strong style={{ fontSize: 13 }}>畫面（{wireframes.length}）</strong>
            <span className="ws-actions">
              <button className="sm" title="新增空白畫面" onClick={() => dispatch({ type: 'ADD_BLANK_WIREFRAME', name: `新畫面 ${wireframes.length + 1}` })}><Plus size={14} /></button>
              <button className="ghost sm" title="收合清單" onClick={() => setNavOpen(false)}><PanelLeftClose size={15} /></button>
            </span>
          </div>
          <div className="ws-list">
            {wireframes.map((wf) => {
              const r = reqById.get(wf.requirementId)
              const cat = r ? categoryMeta(r.category) : null
              return (
                <div
                  key={wf.id}
                  className={'wf-screen-item' + (wf.id === selected.id ? ' active' : '')}
                  onClick={() => setSelectedId(wf.id)}
                >
                  <span className="dot" style={{ background: cat ? cat.color : '#cbd2cd' }} />
                  <span className="nm">{wf.name || '未命名'}</span>
                </div>
              )
            })}
          </div>
        </aside>
        )}
        <main className="wf-stage">
          <WireframeFrame key={selected.id} wireframe={selected} requirement={reqById.get(selected.requirementId)} />
        </main>
      </div>
    </ConfigProvider>
  )
}
