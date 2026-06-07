import { Fragment, useEffect, useRef, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { uid } from '../lib/id.js'
import { COMPONENT_TYPES, COMPONENT_GROUPS, PROP_SCHEMA, newComponent } from '../lib/wireframeTemplates.js'
import WireframeBlock, { ARRAY_PROP, styleFromCmp } from './WireframeBlock.jsx'
import { categoryMeta } from '../lib/categories.js'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Monitor, Smartphone, Tablet, RotateCw, Copy, Trash2, Plus, LayoutTemplate, Columns2, PanelLeft, PanelLeftClose, ChevronUp, ChevronDown, ChevronRight, X, GripVertical, Save, Layers, Menu } from 'lucide-react'
import { ConfigProvider } from 'antd'

// wireframe 配色主題（和諧自然的成套色票）
export const WF_PALETTES = [
  { key: 'forest', name: '森林綠', primary: '#103d2e', sage: '#9fb6ab' },
  { key: 'slate', name: '石板灰', primary: '#334155', sage: '#aab4c2' },
  { key: 'indigo', name: '靛藍', primary: '#3730a3', sage: '#aaa9d4' },
  { key: 'ocean', name: '海洋藍', primary: '#155e75', sage: '#9cc0c9' },
  { key: 'terracotta', name: '暖陶', primary: '#9a3412', sage: '#d6b1a0' },
  { key: 'plum', name: '葡萄紫', primary: '#6b2160', sage: '#c6a9c4' },
  { key: 'mono', name: '墨黑', primary: '#1f2937', sage: '#b4b9c0' },
]
const paletteOf = (key) => WF_PALETTES.find((p) => p.key === key) || WF_PALETTES[0]

// 依主色產生 wireframe 的 antd 主題
const makeWfTheme = (primary) => ({
  token: {
    colorPrimary: primary,
    colorText: '#16241d',
    colorTextHeading: primary,
    colorBorder: '#dbe3de',
    borderRadius: 8,
    fontSize: 13,
    fontFamily: 'inherit',
  },
  components: {
    Button: { borderRadius: 999, controlHeight: 32, fontWeight: 600, defaultColor: primary, defaultBorderColor: primary, primaryShadow: 'none', defaultShadow: 'none' },
    Card: { boxShadowTertiary: 'none' },
    Input: { activeShadow: 'none' },
    Segmented: { itemSelectedBg: primary, itemSelectedColor: '#fff' },
  },
})

const ALIGNS = [
  { key: 'left', label: '靠左' },
  { key: 'center', label: '置中' },
  { key: 'right', label: '靠右' },
]

// 有「作用中/選取項」概念的元件
const ACTIVE_TYPES = new Set(['tabs', 'steps', 'nav', 'sidenav', 'segmented', 'radio'])
const ARR_LABEL = { columns: '欄位', buttons: '按鈕', items: '項目', options: '選項', fields: '欄位', cards: '卡片', steps: '步驟', tabs: '頁籤' }

// 逐項編輯清單（新增/刪除/排序）
function ItemsEditor({ values, onChange }) {
  const set = (i, v) => onChange(values.map((x, j) => (j === i ? v : x)))
  const move = (i, d) => { const a = [...values]; const t = i + d; if (t < 0 || t >= a.length) return;[a[i], a[t]] = [a[t], a[i]]; onChange(a) }
  return (
    <div className="items-ed">
      {values.map((v, i) => (
        <div className="item-row" key={i}>
          <input value={v} onChange={(e) => set(i, e.target.value)} />
          <button className="ghost sm" title="上移" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={13} /></button>
          <button className="ghost sm" title="下移" disabled={i === values.length - 1} onClick={() => move(i, 1)}><ChevronDown size={13} /></button>
          <button className="ghost sm danger" title="刪除" onClick={() => onChange(values.filter((_, j) => j !== i))}><X size={13} /></button>
        </div>
      ))}
      <button className="sm" onClick={() => onChange([...values, '新項目'])}><Plus size={13} /> 新增項目</button>
    </div>
  )
}

// 外觀樣式面板（間距 / 字級 / 顏色 / 邊框）
function StyleEditor({ cmp, update }) {
  const [open, setOpen] = useState(false)
  const st = cmp.style || {}
  const set = (k, v) => update({ style: { ...st, [k]: v } })
  const num = (k, ph) => (
    <input type="number" placeholder={ph} value={st[k] ?? ''} onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value))} />
  )
  const color = (k, def) => (
    <span className="wf-color">
      <input type="color" value={st[k] || def} onChange={(e) => set(k, e.target.value)} />
      {st[k] && <button className="wf-color-clr" title="清除" onClick={() => set(k, '')}><X size={11} /></button>}
    </span>
  )
  const hasAny = Object.values(st).some((v) => v !== '' && v != null)
  return (
    <div className={'wf-style' + (open ? ' open' : '')}>
      <button className="wf-style-head" onClick={() => setOpen((o) => !o)}>
        <ChevronRight size={13} className="cc" /> 外觀樣式{hasAny && !open ? ' •' : ''}
      </button>
      {open && (
        <div className="wf-style-body">
          <div className="wf-grid2">
            <label className="field sm"><span>上間距</span>{num('mt', '0')}</label>
            <label className="field sm"><span>下間距</span>{num('mb', '0')}</label>
            <label className="field sm"><span>內距</span>{num('p', '0')}</label>
            <label className="field sm"><span>圓角</span>{num('radius', '8')}</label>
            <label className="field sm"><span>字級</span>{num('fontSize', '13')}</label>
            <label className="field sm"><span>字重</span>
              <select value={st.fontWeight || ''} onChange={(e) => set('fontWeight', e.target.value)}>
                <option value="">一般</option>
                <option value="600">中粗</option>
                <option value="700">粗體</option>
              </select>
            </label>
            <label className="field sm"><span>文字色</span>{color('color', '#16241d')}</label>
            <label className="field sm"><span>背景</span>{color('bg', '#ffffff')}</label>
            <label className="field sm"><span>邊框寬</span>{num('borderW', '0')}</label>
            <label className="field sm"><span>邊框色</span>{color('borderColor', '#d9d9d9')}</label>
          </div>
          {hasAny && <button className="ghost sm" style={{ width: '100%', marginTop: 6 }} onClick={() => update({ style: {} })}>清除全部樣式</button>}
        </div>
      )}
    </div>
  )
}

// 圖層 / 結構樹：完整顯示巢狀元件，可點選、收合、上下排序、刪除
function LayerRow({ cmp, depth, ed, collapsed, toggle }) {
  const kids = cmp.children || []
  const hasKids = kids.length > 0
  const sel = ed.selectedCmp === cmp.id
  const name = (cmp.label || '').trim() || COMPONENT_TYPES[cmp.type]?.label || cmp.type
  const isCol = collapsed.has(cmp.id)
  return (
    <>
      <div className={'lt-row' + (sel ? ' active' : '')} style={{ paddingLeft: 6 + depth * 13 }} onClick={() => ed.select(cmp.id)}>
        {hasKids
          ? <button className="lt-caret" onClick={(e) => { e.stopPropagation(); toggle(cmp.id) }}>{isCol ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</button>
          : <span className="lt-caret sp" />}
        <span className="lt-name">{name}</span>
        {cmp.type === 'row' && <span className="lt-tag">列</span>}
        <span className="lt-ops" onClick={(e) => e.stopPropagation()}>
          <button title="上移" onClick={() => ed.move(cmp.id, -1)}><ChevronUp size={12} /></button>
          <button title="下移" onClick={() => ed.move(cmp.id, 1)}><ChevronDown size={12} /></button>
          <button title="刪除" className="danger" onClick={() => ed.del(cmp.id)}><X size={12} /></button>
        </span>
      </div>
      {hasKids && !isCol && kids.map((ch) => <LayerRow key={ch.id} cmp={ch} depth={depth + 1} ed={ed} collapsed={collapsed} toggle={toggle} />)}
    </>
  )
}

function LayerTree({ components, ed }) {
  const [collapsed, setCollapsed] = useState(() => new Set())
  const toggle = (id) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  return (
    <div className="wf-layers-body">
      {components.length === 0 && <div className="muted" style={{ padding: 10, fontSize: 12 }}>尚無元件</div>}
      {components.map((c) => <LayerRow key={c.id} cmp={c} depth={0} ed={ed} collapsed={collapsed} toggle={toggle} />)}
    </div>
  )
}

// 3×3 對齊網格（依方向把視覺位置對映到主軸/交叉軸，類似 Figma）
function AlignGrid({ cmp, update }) {
  const isCol = cmp.direction === 'column'
  const main = toMain(cmp)
  const cross = toCross(cmp)
  const order = ['start', 'center', 'end']
  const hVal = isCol ? cross : main
  const vVal = isCol ? main : cross
  const selCol = order.indexOf(hVal)
  const selRow = order.indexOf(vVal)
  const setCell = (r, c) => {
    const h = order[c], v = order[r]
    if (isCol) update({ alignCross: h, alignMain: v })
    else update({ alignMain: h, alignCross: v })
  }
  return (
    <div className="align-grid">
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
        <button key={`${r}-${c}`} type="button" className={'ag-cell' + (r === selRow && c === selCol ? ' on' : '')} onClick={() => setCell(r, c)}><i /></button>
      )))}
    </div>
  )
}

function ComponentEditor({ wireframe, cmp, layout, onClose, labelRef }) {
  const { dispatch } = useStore()
  const arrKey = ARRAY_PROP[cmp.type]
  const items = arrKey ? (cmp[arrKey] || []) : []
  const update = (patch) => dispatch({ type: 'UPDATE_COMPONENT', wireframeId: wireframe.id, componentId: cmp.id, patch })

  return (
    <div className="props-body">
      <div className="props-title">{COMPONENT_TYPES[cmp.type]?.label || cmp.type}</div>

      <label className="field">
        <span>標籤 / 標題文字</span>
        <input ref={labelRef} value={cmp.label || ''} onChange={(e) => update({ label: e.target.value })} />
      </label>

      <label className="field">
        <span>寬度</span>
        <div className="wseg" style={{ marginBottom: 4 }}>
          {[['fill', '填滿'], ['hug', '隨內容'], ['fixed', '固定']].map(([k, t]) => (
            <button key={k} className={(cmp.width || 'full') === k ? 'active' : ''} onClick={() => update({ width: k })}>{t}</button>
          ))}
        </div>
        <div className="wseg">
          {[['full', '整列'], ['half', '½'], ['third', '⅓'], ['quarter', '¼']].map(([k, t]) => (
            <button key={k} className={(cmp.width || 'full') === k ? 'active' : ''} onClick={() => update({ width: k })}>{t}</button>
          ))}
        </div>
        {cmp.width === 'fixed' && (
          <input type="number" min={20} style={{ marginTop: 4 }} placeholder="寬度 px" value={cmp.widthPx ?? 200} onChange={(e) => update({ widthPx: Number(e.target.value) })} />
        )}
      </label>

      <label className="field">
        <span>對齊／位置{(cmp.width || 'full') !== 'full' ? '（半/分欄時決定靠左右）' : ''}</span>
        <div className="wseg">
          {ALIGNS.map((a) => (
            <button key={a.key} className={(cmp.align || 'left') === a.key ? 'active' : ''} onClick={() => update({ align: a.key })}>{a.label}</button>
          ))}
        </div>
      </label>

      {cmp.type === 'row' && (
        <>
          <label className="field">
            <span>排列方向 (Flow)</span>
            <div className="wseg">
              <button className={(cmp.direction || 'row') === 'row' ? 'active' : ''} onClick={() => update({ direction: 'row' })}>橫向 →</button>
              <button className={cmp.direction === 'column' ? 'active' : ''} onClick={() => update({ direction: 'column' })}>縱向 ↓</button>
              <button className={cmp.wrap ? 'active' : ''} title="超出時換行" onClick={() => update({ wrap: !cmp.wrap })}>↵ 換行</button>
            </div>
          </label>

          <div className="field">
            <span>對齊 (Alignment)</span>
            <div className="align-row">
              <AlignGrid cmp={cmp} update={update} />
              <div className="align-opts">
                <button type="button" className={toMain(cmp) === 'between' ? 'sm active' : 'sm'} onClick={() => update({ alignMain: toMain(cmp) === 'between' ? 'start' : 'between' })}>平均分佈</button>
                <button type="button" className={toCross(cmp) === 'stretch' ? 'sm active' : 'sm'} onClick={() => update({ alignCross: toCross(cmp) === 'stretch' ? 'start' : 'stretch' })}>拉伸填滿</button>
              </div>
            </div>
          </div>

          <div className="field">
            <span>間距 (Gap)</span>
            <div className="wf-grid2">
              <label className="field sm" style={{ marginBottom: 0 }}><span>{cmp.wrap ? '欄間距' : '間距'}</span>
                <input type="number" min={0} value={gapPx(cmp.gap)} onChange={(e) => update({ gap: Number(e.target.value) })} />
              </label>
              {cmp.wrap && (
                <label className="field sm" style={{ marginBottom: 0 }}><span>列間距</span>
                  <input type="number" min={0} value={gapPx(cmp.gapCross ?? cmp.gap)} onChange={(e) => update({ gapCross: Number(e.target.value) })} />
                </label>
              )}
            </div>
          </div>

          <div className="field">
            <span>內距 (Padding)</span>
            <div className="wf-grid2">
              <label className="field sm" style={{ marginBottom: 0 }}><span>水平</span>
                <input type="number" min={0} value={padPx(cmp.padX ?? cmp.pad)} onChange={(e) => update({ padX: Number(e.target.value) })} />
              </label>
              <label className="field sm" style={{ marginBottom: 0 }}><span>垂直</span>
                <input type="number" min={0} value={padPx(cmp.padY ?? cmp.pad)} onChange={(e) => update({ padY: Number(e.target.value) })} />
              </label>
            </div>
          </div>

          <label className="field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ marginBottom: 0 }}>裁切溢出內容</span>
            <div className="wseg">
              <button className={cmp.clip ? 'active' : ''} onClick={() => update({ clip: true })}>開</button>
              <button className={!cmp.clip ? 'active' : ''} onClick={() => update({ clip: false })}>關</button>
            </div>
          </label>
        </>
      )}

      {layout === 'sidebar' && (
        <label className="field">
          <span>所屬區域</span>
          <div className="wseg">
            <button className={(cmp.region || 'content') === 'content' ? 'active' : ''} onClick={() => update({ region: 'content' })}>內容區</button>
            <button className={cmp.region === 'sidebar' ? 'active' : ''} onClick={() => update({ region: 'sidebar' })}>側邊欄</button>
          </div>
        </label>
      )}

      {cmp.type === 'field' && (
        <>
          <label className="field">
            <span>欄位型別</span>
            <select value={cmp.control || 'input'} onChange={(e) => update({ control: e.target.value })}>
              <option value="input">單行輸入</option>
              <option value="textarea">多行輸入</option>
              <option value="select">下拉選單</option>
              <option value="password">密碼</option>
              <option value="toggle">開關</option>
            </select>
          </label>
          <label className="field">
            <span>狀態</span>
            <div className="wseg">
              {[['', '一般'], ['disabled', '停用'], ['error', '錯誤']].map(([k, t]) => (
                <button key={k || 'n'} className={(cmp.status || '') === k ? 'active' : ''} onClick={() => update({ status: k })}>{t}</button>
              ))}
            </div>
          </label>
        </>
      )}

      {cmp.type === 'table' && (
        <label className="field">
          <span>列數（資料筆數）</span>
          <input type="number" min={0} max={12} value={cmp.rows ?? 3} onChange={(e) => update({ rows: Number(e.target.value) })} />
        </label>
      )}

      {arrKey && (
        <div className="field">
          <span>{ARR_LABEL[arrKey] || '項目'}</span>
          <ItemsEditor values={items} onChange={(v) => update({ [arrKey]: v })} />
        </div>
      )}

      {ACTIVE_TYPES.has(cmp.type) && items.length > 0 && (
        <label className="field">
          <span>{cmp.type === 'steps' ? '目前步驟' : '作用中項目'}</span>
          <select value={cmp.active ?? 0} onChange={(e) => update({ active: Number(e.target.value) })}>
            {items.map((it, i) => <option key={i} value={i}>{it || `項目 ${i + 1}`}</option>)}
          </select>
        </label>
      )}

      {(PROP_SCHEMA[cmp.type] || []).map((p) => {
        const val = cmp[p.key] ?? p.default
        return (
          <label className="field" key={p.key}>
            <span>{p.label}</span>
            {p.control === 'text' && <input value={val ?? ''} onChange={(e) => update({ [p.key]: e.target.value })} />}
            {p.control === 'number' && <input type="number" value={val ?? 0} onChange={(e) => update({ [p.key]: Number(e.target.value) })} />}
            {p.control === 'select' && (
              <select value={val} onChange={(e) => update({ [p.key]: e.target.value })}>
                {p.options.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
              </select>
            )}
            {p.control === 'toggle' && (
              <div className="wseg">
                <button className={val ? 'active' : ''} onClick={() => update({ [p.key]: true })}>開</button>
                <button className={!val ? 'active' : ''} onClick={() => update({ [p.key]: false })}>關</button>
              </div>
            )}
          </label>
        )
      })}

      <StyleEditor cmp={cmp} update={update} />

      {cmp.type !== 'row' && (
        <button className="sm" style={{ marginTop: 10, width: '100%' }} onClick={() => dispatch({ type: 'WRAP_IN_ROW', wireframeId: wireframe.id, componentId: cmp.id })}><Columns2 size={13} /> 包成列容器（可並排）</button>
      )}
      <button className="sm" style={{ marginTop: 8, width: '100%' }} onClick={() => { const n = window.prompt('區塊名稱', COMPONENT_TYPES[cmp.type]?.label || '區塊'); if (n) dispatch({ type: 'SAVE_BLOCK', name: n, node: cmp }) }}><Save size={13} /> 存成可重用區塊</button>

      <div className="row" style={{ marginTop: 10, gap: 6 }}>
        <button className="sm" onClick={() => dispatch({ type: 'DUPLICATE_COMPONENT', wireframeId: wireframe.id, componentId: cmp.id })}><Copy size={13} /> 複製</button>
        <button className="sm danger" onClick={() => { dispatch({ type: 'DELETE_COMPONENT', wireframeId: wireframe.id, componentId: cmp.id }); onClose?.() }}><Trash2 size={13} /> 刪除</button>
      </div>
    </div>
  )
}

const DEV_W = { tablet: 860, mobile: 420 }
const GAP = { sm: 8, md: 16, lg: 28 }
const PAD = { none: 0, sm: 8, md: 16, lg: 24 }
// 數值化 gap / padding（相容舊的字串預設）
const gapPx = (v) => (typeof v === 'number' ? v : GAP[v ?? 'md'] ?? 16)
const padPx = (v) => (typeof v === 'number' ? v : PAD[v ?? 'none'] ?? 0)
// 對齊：新版以 alignMain / alignCross（start/center/end/between/stretch）為準，相容舊 justify/valign
const toMain = (cmp) => cmp.alignMain ?? ({ left: 'start', center: 'center', right: 'end', between: 'between' }[cmp.justify] ?? 'start')
const toCross = (cmp) => cmp.alignCross ?? ({ top: 'start', center: 'center', bottom: 'end', stretch: 'stretch' }[cmp.valign] ?? 'start')
const MAIN_CSS = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' }
const CROSS_CSS = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' }
const JUSTIFY = { left: 'flex-start', center: 'center', right: 'flex-end', between: 'space-between' }
const VALIGN = { top: 'flex-start', center: 'center', bottom: 'flex-end', stretch: 'stretch' }
const WCLASS = { full: 'w-full', half: 'w-half', third: 'w-third', quarter: 'w-quarter', fill: 'w-fill', hug: 'w-hug', fixed: 'w-fixed' }

function itemMargin(cmp) {
  const s = {}
  const nf = (cmp.width || 'full') !== 'full'
  const a = cmp.align || 'left'
  if (nf && a === 'right') s.marginLeft = 'auto'
  if (nf && a === 'center') { s.marginLeft = 'auto'; s.marginRight = 'auto' }
  return s
}
function findById(list, id) {
  for (const c of list) { if (c.id === id) return c; if (c.children) { const f = findById(c.children, id); if (f) return f } }
  return null
}
function cloneTree(node) {
  return { ...node, id: uid('cmp'), children: node.children ? node.children.map(cloneTree) : undefined }
}
function siblingsOf(list, id, parentId = null) {
  if (list.some((c) => c.id === id)) return { parentId, ids: list.map((c) => c.id) }
  for (const c of list) { if (c.children) { const r = siblingsOf(c.children, id, c.id); if (r) return r } }
  return null
}

function Palette({ onPick, blocks = [], onPickBlock, onDeleteBlock }) {
  return (
    <div className="palette-pop" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      {blocks.length > 0 && (
        <div className="palette-group">
          <div className="pg-title">我的區塊</div>
          <div className="pg-items">
            {blocks.map((bk) => (
              <span key={bk.id} className="blk-chip">
                <button onClick={() => onPickBlock(bk)}>＋{bk.name}</button>
                <button className="blk-del" title="刪除區塊" onClick={() => onDeleteBlock(bk.id)}><X size={11} /></button>
              </span>
            ))}
          </div>
        </div>
      )}
      {COMPONENT_GROUPS.map((g) => (
        <div className="palette-group" key={g.group}>
          <div className="pg-title">{g.group}</div>
          <div className="pg-items">
            {g.types.map((t) => (
              <button key={t} onClick={() => onPick(t)}>＋{COMPONENT_TYPES[t]?.label}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function RowItem({ cmp, ed }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cmp.id })
  const style = { transform: CSS.Transform.toString(transform), transition, borderRadius: 8, ...itemMargin(cmp), ...styleFromCmp(cmp) }
  if (cmp.width === 'fixed' && cmp.widthPx) style.width = Number(cmp.widthPx)
  const children = cmp.children || []
  const sel = ed.selectedCmp === cmp.id
  const isCol = cmp.direction === 'column'
  const g = gapPx(cmp.gap)
  const gCross = cmp.wrap ? gapPx(cmp.gapCross ?? cmp.gap) : g
  const px = padPx(cmp.padX ?? cmp.pad)
  const py = padPx(cmp.padY ?? cmp.pad)
  const rowStyle = {
    flexDirection: isCol ? 'column' : 'row',
    flexWrap: cmp.wrap ? 'wrap' : 'nowrap',
    gap: `${gCross}px ${g}px`,
    '--col-gap': `${g}px`,
    padding: `${py}px ${px}px`,
    justifyContent: MAIN_CSS[toMain(cmp)],
    alignItems: CROSS_CSS[toCross(cmp)],
    overflow: cmp.clip ? 'hidden' : undefined,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`wf-item wf-rowwrap ${WCLASS[cmp.width] || 'w-full'}${isDragging ? ' dragging' : ''}${sel ? ' selected' : ''}`}
      onClick={(e) => { e.stopPropagation(); ed.select(cmp.id) }}
    >
      <div className={'wf-row' + (isCol ? ' wf-row-col' : '')} style={rowStyle}>
        <SortableContext items={children.map((c) => c.id)} strategy={rectSortingStrategy}>
          {children.map((ch) => <Node key={ch.id} cmp={ch} ed={ed} />)}
        </SortableContext>
        {children.length === 0 && <div className="wf-row-empty">空列容器 — 點右上「＋」加入並排元件</div>}
      </div>
      <span className="wf-rowhandle" title="拖曳此列" {...attributes} {...listeners}><GripVertical size={14} /></span>
      {sel && <span className="wf-badge">列容器</span>}
      <div className="wb-tools" onPointerDown={(e) => e.stopPropagation()}>
        <button title="加入並排元件" onClick={(e) => { e.stopPropagation(); ed.openPalette(cmp.id) }}><Plus size={13} /></button>
        <button title="複製" onClick={(e) => { e.stopPropagation(); ed.dup(cmp.id) }}><Copy size={13} /></button>
        <button title="刪除" onClick={(e) => { e.stopPropagation(); ed.del(cmp.id) }}><X size={14} /></button>
      </div>
      {ed.paletteOpen === cmp.id && <Palette onPick={(t) => ed.addComponent(t, cmp.region, cmp.id)} blocks={ed.blocks} onPickBlock={(bk) => ed.addBlock(bk, cmp.region, cmp.id)} onDeleteBlock={ed.deleteBlock} />}
    </div>
  )
}

function Node({ cmp, ed }) {
  if (cmp.type === 'row') return <RowItem cmp={cmp} ed={ed} />
  return (
    <WireframeBlock
      cmp={cmp}
      selected={ed.selectedCmp === cmp.id}
      onSelect={() => ed.select(cmp.id)}
      onDoubleClick={() => ed.rename(cmp.id)}
      onDuplicate={() => ed.dup(cmp.id)}
      onDelete={() => ed.del(cmp.id)}
      onResize={(w) => ed.setWidth(cmp.id, w)}
    />
  )
}

function WireframeFrame({ wireframe, requirement }) {
  const { current, dispatch } = useStore()
  const [selectedCmp, setSelectedCmp] = useState(null)
  const [paletteOpen, setPaletteOpen] = useState(null) // null | 'content' | 'sidebar'
  const [layersOpen, setLayersOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 1180 : true))
  const [mobileNav, setMobileNav] = useState(false) // 手機模式側欄抽屜（demo 用）
  const labelRef = useRef(null)
  const cat = requirement ? categoryMeta(requirement.category) : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const addComponent = (type, region = 'content', parentId = null) => {
    const c = newComponent(type)
    if (!parentId && region === 'sidebar') c.region = 'sidebar'
    dispatch({ type: 'ADD_COMPONENT', wireframeId: wireframe.id, component: c, parentId })
    setSelectedCmp(c.id)
    setPaletteOpen(null)
  }

  const regionOf = (id) => (findById(wireframe.components, id)?.region) || 'content'

  const onDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const sa = siblingsOf(wireframe.components, active.id)
    const so = siblingsOf(wireframe.components, over.id)
    if (!sa || !so) return

    // 跨容器 → 移動到 over 之前；同為頂層但跨區域（內容↔側欄）也視為移動
    const crossContainer = sa.parentId !== so.parentId
    const crossRegion = sa.parentId === null && so.parentId === null && regionOf(active.id) !== regionOf(over.id)
    if (crossContainer || crossRegion) {
      const region = so.parentId === null ? regionOf(over.id) : undefined
      dispatch({ type: 'MOVE_COMPONENT', wireframeId: wireframe.id, activeId: active.id, overId: over.id, region })
      return
    }

    // 同層重排
    const ids = [...sa.ids]
    const oi = ids.indexOf(active.id)
    const ni = ids.indexOf(over.id)
    ids.splice(oi, 1)
    ids.splice(ni, 0, active.id)
    dispatch({ type: 'REORDER_COMPONENTS', wireframeId: wireframe.id, parentId: sa.parentId, orderedIds: ids })
  }

  const addBlock = (block, region = 'content', parentId = null) => {
    const node = cloneTree(block.node)
    dispatch({ type: 'ADD_COMPONENT', wireframeId: wireframe.id, component: node, parentId })
    setSelectedCmp(node.id)
    setPaletteOpen(null)
  }

  const ed = {
    selectedCmp,
    paletteOpen,
    blocks: current.blocks || [],
    select: (id) => setSelectedCmp(id),
    rename: (id) => { setSelectedCmp(id); setTimeout(() => labelRef.current?.focus(), 30) },
    dup: (id) => dispatch({ type: 'DUPLICATE_COMPONENT', wireframeId: wireframe.id, componentId: id }),
    del: (id) => { dispatch({ type: 'DELETE_COMPONENT', wireframeId: wireframe.id, componentId: id }); setSelectedCmp(null) },
    move: (id, dir) => {
      const sib = siblingsOf(wireframe.components, id)
      if (!sib) return
      const ids = [...sib.ids]
      const i = ids.indexOf(id)
      const t = i + dir
      if (t < 0 || t >= ids.length) return
      ;[ids[i], ids[t]] = [ids[t], ids[i]]
      dispatch({ type: 'REORDER_COMPONENTS', wireframeId: wireframe.id, parentId: sib.parentId, orderedIds: ids })
    },
    setWidth: (id, width) => dispatch({ type: 'UPDATE_COMPONENT', wireframeId: wireframe.id, componentId: id, patch: { width } }),
    openPalette: (id) => setPaletteOpen((o) => (o === id ? null : id)),
    addComponent,
    addBlock,
    deleteBlock: (id) => dispatch({ type: 'DELETE_BLOCK', id }),
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
  const mobileSidebar = layout === 'sidebar' && wireframe.device === 'mobile'

  const column = (items, region, mobile) => (
    <div className="wf-colwrap">
      <div className={'wf-canvas' + (mobile ? ' mobile' : '')}>
        {items.length === 0 && <div className="muted" style={{ textAlign: 'center', padding: 16, width: '100%' }}>{region === 'sidebar' ? '側邊欄為空' : '空白，點下方新增'}</div>}
        <SortableContext items={items.map((c) => c.id)} strategy={rectSortingStrategy}>
          {items.map((c) => <Node key={c.id} cmp={c} ed={ed} />)}
        </SortableContext>
      </div>
      <div className="add-cmp-bar" onClick={(e) => e.stopPropagation()}>
        <button className="primary sm" onClick={() => setPaletteOpen((o) => (o === region ? null : region))}><Plus size={14} /> 新增{region === 'sidebar' ? '側欄' : ''}元件</button>
        {paletteOpen === region && <Palette onPick={(t) => addComponent(t, region)} blocks={ed.blocks} onPickBlock={(bk) => addBlock(bk, region, null)} onDeleteBlock={ed.deleteBlock} />}
      </div>
    </div>
  )

  // 鍵盤快捷鍵：Delete 刪除、⌘/Ctrl+D 複製、Esc 取消選取（編輯文字時不觸發）
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return
      if (!selectedCmp) return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); dispatch({ type: 'DELETE_COMPONENT', wireframeId: wireframe.id, componentId: selectedCmp }); setSelectedCmp(null) }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); dispatch({ type: 'DUPLICATE_COMPONENT', wireframeId: wireframe.id, componentId: selectedCmp }) }
      else if (e.key === 'Escape') { setSelectedCmp(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedCmp, wireframe.id])

  const selectedComp = findById(wireframe.components, selectedCmp)

  return (
    <div className="wf-edit-row">
    <aside className={'wf-layers' + (layersOpen ? ' open' : '')} onClick={(e) => e.stopPropagation()}>
      <button className="wf-layers-toggle" title={layersOpen ? '收合圖層' : '展開圖層'} onClick={() => setLayersOpen((o) => !o)}>
        <Layers size={15} />{layersOpen && <span>圖層</span>}
      </button>
      {layersOpen && <LayerTree components={wireframe.components} ed={ed} />}
    </aside>
    <div className={`wf-frame dev-${wireframe.device || 'desktop'}`} id={`wf-${wireframe.id}`}
      style={DEV_W[wireframe.device] ? { maxWidth: DEV_W[wireframe.device], margin: '0 auto' } : undefined}
      onClick={() => { setSelectedCmp(null); setPaletteOpen(null) }}>
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
          <button title="桌機（全寬）" className={(wireframe.device || 'desktop') === 'desktop' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setDevice('desktop') }}><Monitor size={15} /></button>
          <button title="平板（860px）" className={wireframe.device === 'tablet' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setDevice('tablet') }}><Tablet size={15} /></button>
          <button title="手機（420px）" className={wireframe.device === 'mobile' ? 'active' : ''} onClick={(e) => { e.stopPropagation(); setDevice('mobile') }}><Smartphone size={15} /></button>
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        {layout === 'sidebar' ? (
          mobileSidebar ? (
            <div className="wf-admin wf-admin-m">
              <div className="wf-content-col">
                <div className="wf-mbar">
                  <button className="wf-burger" title="開啟選單" onClick={(e) => { e.stopPropagation(); setMobileNav(true) }}><Menu size={20} /></button>
                  <span className="wf-mbar-title">{wireframe.name}</span>
                </div>
                {column(contentItems, 'content', false)}
              </div>
              {mobileNav && <div className="wf-drawer-backdrop" onClick={(e) => { e.stopPropagation(); setMobileNav(false) }} />}
              <div className={'wf-side wf-drawer' + (mobileNav ? ' open' : '')}>
                <div className="wf-drawer-head">
                  <span>選單</span>
                  <button className="ghost sm" title="關閉選單" onClick={(e) => { e.stopPropagation(); setMobileNav(false) }}><X size={15} /></button>
                </div>
                {column(sidebarItems, 'sidebar', false)}
              </div>
            </div>
          ) : (
            <div className="wf-admin">
              <div className="wf-side">{column(sidebarItems, 'sidebar', false)}</div>
              <div className="wf-content-col">{column(contentItems, 'content', false)}</div>
            </div>
          )
        ) : (
          column(wireframe.components, 'content', wireframe.device === 'mobile')
        )}
      </DndContext>
    </div>
    {selectedComp && (
      <aside className="wf-props" onClick={(e) => e.stopPropagation()}>
        <div className="wf-props-head">
          <span>元件設定</span>
          <button className="ghost sm" title="關閉" onClick={() => setSelectedCmp(null)}><X size={15} /></button>
        </div>
        <ComponentEditor wireframe={wireframe} cmp={selectedComp} layout={layout} labelRef={labelRef} onClose={() => setSelectedCmp(null)} />
      </aside>
    )}
    </div>
  )
}

export default function WireframeBoard() {
  const { current, dispatch } = useStore()
  const wireframes = current.wireframes || []
  const [selectedId, setSelectedId] = useState(null)
  const [navOpen, setNavOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth > 820 : true))
  const isMobile = () => typeof window !== 'undefined' && window.innerWidth <= 820

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
  const pal = paletteOf(current.wfTheme)

  return (
    <ConfigProvider theme={makeWfTheme(pal.primary)} componentSize="small">
      <div className="wf-studio" style={{ '--wf-ink': pal.primary, '--wf-sage': pal.sage }}>
        {navOpen && <div className="wf-nav-backdrop" onClick={() => setNavOpen(false)} />}
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
          <div className="wf-theme">
            <div className="wf-theme-label">配色主題</div>
            <div className="wf-swatches">
              {WF_PALETTES.map((pt) => (
                <button
                  key={pt.key}
                  className={'wf-swatch' + ((current.wfTheme || 'forest') === pt.key ? ' active' : '')}
                  title={pt.name}
                  style={{ background: pt.primary }}
                  onClick={() => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'wfTheme', value: pt.key })}
                />
              ))}
            </div>
          </div>
          <div className="ws-list">
            {wireframes.map((wf) => {
              const r = reqById.get(wf.requirementId)
              const cat = r ? categoryMeta(r.category) : null
              return (
                <div
                  key={wf.id}
                  className={'wf-screen-item' + (wf.id === selected.id ? ' active' : '')}
                  onClick={() => { setSelectedId(wf.id); if (isMobile()) setNavOpen(false) }}
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
