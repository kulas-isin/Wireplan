import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import { loadState, saveState, emptyProject, rebuildArtifacts } from './store.js'
import { uid } from '../lib/id.js'
import { generateWireframe, regenerateComponents } from '../lib/wireframeTemplates.js'
import { generateFlow, generateFlowFromWireframes } from '../lib/flowGenerator.js'
import { buildFlowsGraph } from '../lib/flowPatterns.js'
import { detectCategory } from '../lib/categories.js'

const StoreContext = createContext(null)

function touch(project) {
  return { ...project, updatedAt: Date.now() }
}

// ── 樹狀元件工具（支援列容器巢狀 children）──
function treeUpdate(list, id, patch) {
  return list.map((c) => {
    if (c.id === id) return { ...c, ...patch }
    if (c.children) return { ...c, children: treeUpdate(c.children, id, patch) }
    return c
  })
}
function treeRemove(list, id) {
  return list.filter((c) => c.id !== id).map((c) => (c.children ? { ...c, children: treeRemove(c.children, id) } : c))
}
function treeFind(list, id) {
  for (const c of list) {
    if (c.id === id) return c
    if (c.children) { const f = treeFind(c.children, id); if (f) return f }
  }
  return null
}
function treeClone(c) {
  return { ...c, id: uid('cmp'), children: c.children ? c.children.map(treeClone) : undefined }
}
// 在 id 之後插入 node（同層）
function treeInsertAfter(list, id, node) {
  const out = []
  let done = false
  for (const c of list) {
    out.push(c.children ? { ...c, children: treeInsertAfter(c.children, id, node) } : c)
    if (c.id === id) { out.push(node); done = true }
  }
  return out
}
// 在 id 之前插入 node（同層）
function treeInsertBefore(list, id, node) {
  const out = []
  for (const c of list) {
    if (c.id === id) out.push(node)
    out.push(c.children ? { ...c, children: treeInsertBefore(c.children, id, node) } : c)
  }
  return out
}
// 將 node 加入指定父容器的 children（parentId 為 null 代表頂層）
function treeAddChild(list, parentId, node) {
  if (!parentId) return [...list, node]
  return list.map((c) => {
    if (c.id === parentId) return { ...c, children: [...(c.children || []), node] }
    if (c.children) return { ...c, children: treeAddChild(c.children, parentId, node) }
    return c
  })
}
// 依 orderedIds 重排某父容器的子層（parentId null = 頂層）
function treeReorder(list, parentId, orderedIds) {
  if (!parentId) {
    const byId = new Map(list.map((c) => [c.id, c]))
    const arr = orderedIds.map((id) => byId.get(id)).filter(Boolean)
    for (const c of list) if (!orderedIds.includes(c.id)) arr.push(c)
    return arr
  }
  return list.map((c) => {
    if (c.id === parentId && c.children) {
      const byId = new Map(c.children.map((x) => [x.id, x]))
      const arr = orderedIds.map((id) => byId.get(id)).filter(Boolean)
      for (const x of c.children) if (!orderedIds.includes(x.id)) arr.push(x)
      return { ...c, children: arr }
    }
    if (c.children) return { ...c, children: treeReorder(c.children, parentId, orderedIds) }
    return c
  })
}

function reducer(state, action) {
  const cur = state.projects.find((p) => p.id === state.currentId)
  const replaceCurrent = (next) => ({
    ...state,
    projects: state.projects.map((p) => (p.id === next.id ? next : p)),
  })

  switch (action.type) {
    case 'SET_CURRENT':
      return { ...state, currentId: action.id }

    case 'NEW_PROJECT': {
      const p = emptyProject(action.name || '新專案')
      return { ...state, projects: [...state.projects, p], currentId: p.id }
    }

    case 'DELETE_PROJECT': {
      const projects = state.projects.filter((p) => p.id !== action.id)
      const safe = projects.length ? projects : [emptyProject('新專案')]
      const currentId = action.id === state.currentId ? safe[0].id : state.currentId
      return { ...state, projects: safe, currentId }
    }

    case 'RENAME_PROJECT':
      return replaceCurrent(touch({ ...cur, name: action.name }))

    case 'UPDATE_PROJECT_FIELD':
      return replaceCurrent(touch({ ...cur, [action.field]: action.value }))

    case 'IMPORT_REQUIREMENTS': {
      // 合併或取代需求，並重建 wireframe / flow
      const requirements = action.mode === 'replace'
        ? action.requirements
        : [...cur.requirements, ...action.requirements]
      const next = rebuildArtifacts({ ...cur, requirements }, { keepWireframeEdits: action.mode !== 'replace' })
      return replaceCurrent(touch(next))
    }

    case 'ADD_REQUIREMENT': {
      const req = action.requirement
      const requirements = [...cur.requirements, req]
      const wireframes = [...cur.wireframes, generateWireframe(req)]
      const next = { ...cur, requirements, wireframes }
      next.flow = generateFlow(next)
      return replaceCurrent(touch(next))
    }

    case 'UPDATE_REQUIREMENT': {
      const requirements = cur.requirements.map((r) =>
        r.id === action.id ? { ...r, ...action.patch } : r,
      )
      // 若分類有變，重新偵測也允許手動指定
      const next = { ...cur, requirements }
      return replaceCurrent(touch(next))
    }

    case 'REDETECT_CATEGORY': {
      const requirements = cur.requirements.map((r) =>
        r.id === action.id ? { ...r, category: detectCategory(`${r.name} ${r.description}`) } : r,
      )
      return replaceCurrent(touch({ ...cur, requirements }))
    }

    case 'DELETE_REQUIREMENT': {
      const requirements = cur.requirements.filter((r) => r.id !== action.id)
      const wireframes = cur.wireframes.filter((w) => w.requirementId !== action.id)
      const next = { ...cur, requirements, wireframes }
      next.flow = generateFlow(next)
      return replaceCurrent(touch(next))
    }

    case 'MOVE_REQUIREMENT': {
      const arr = [...cur.requirements]
      const idx = arr.findIndex((r) => r.id === action.id)
      const target = idx + action.dir
      if (idx < 0 || target < 0 || target >= arr.length) return state
      ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
      const next = { ...cur, requirements: arr }
      next.flow = generateFlow(next)
      return replaceCurrent(touch(next))
    }

    case 'REGENERATE_WIREFRAME': {
      const req = cur.requirements.find((r) => r.id === action.requirementId)
      if (!req) return state
      const { layout, components } = regenerateComponents(req)
      const wireframes = cur.wireframes.map((w) =>
        w.requirementId === action.requirementId
          ? { ...w, name: req.screen || req.name, template: req.category, layout, components }
          : w,
      )
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'UPDATE_WIREFRAME': {
      const wireframes = cur.wireframes.map((w) =>
        w.id === action.id ? { ...w, ...action.patch } : w,
      )
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'UPDATE_COMPONENT': {
      const wireframes = cur.wireframes.map((w) =>
        w.id === action.wireframeId ? { ...w, components: treeUpdate(w.components, action.componentId, action.patch) } : w,
      )
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'ADD_COMPONENT': {
      const wireframes = cur.wireframes.map((w) =>
        w.id === action.wireframeId ? { ...w, components: treeAddChild(w.components, action.parentId || null, action.component) } : w,
      )
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'DELETE_COMPONENT': {
      const wireframes = cur.wireframes.map((w) =>
        w.id === action.wireframeId ? { ...w, components: treeRemove(w.components, action.componentId) } : w,
      )
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'REORDER_COMPONENTS': {
      const wireframes = cur.wireframes.map((w) =>
        w.id === action.wireframeId ? { ...w, components: treeReorder(w.components, action.parentId || null, action.orderedIds) } : w,
      )
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'MOVE_COMPONENT': {
      // 跨容器移動：把 activeId 移到 overId 之前，並套用目標 region
      const wireframes = cur.wireframes.map((w) => {
        if (w.id !== action.wireframeId) return w
        const node = treeFind(w.components, action.activeId)
        if (!node) return w
        const removed = treeRemove(w.components, action.activeId)
        const moved = { ...node, region: action.region }
        return { ...w, components: treeInsertBefore(removed, action.overId, moved) }
      })
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'DUPLICATE_COMPONENT': {
      const wireframes = cur.wireframes.map((w) => {
        if (w.id !== action.wireframeId) return w
        const src = treeFind(w.components, action.componentId)
        if (!src) return w
        return { ...w, components: treeInsertAfter(w.components, action.componentId, treeClone(src)) }
      })
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'WRAP_IN_ROW': {
      // 把某元件包進新的列容器（之後可加入並排元件）
      const wireframes = cur.wireframes.map((w) => {
        if (w.id !== action.wireframeId) return w
        const src = treeFind(w.components, action.componentId)
        if (!src) return w
        const row = { id: uid('cmp'), type: 'row', label: '', width: src.width || 'full', region: src.region, gap: 'md', justify: 'left', valign: 'top', children: [{ ...src, width: 'full', region: undefined }] }
        const replaced = treeInsertAfter(w.components, action.componentId, row)
        return { ...w, components: treeRemove(replaced, action.componentId) }
      })
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'DUPLICATE_WIREFRAME': {
      const src = cur.wireframes.find((w) => w.id === action.id)
      if (!src) return state
      const copy = {
        ...src,
        id: uid('wf'),
        requirementId: null,
        name: `${src.name} (複本)`,
        components: src.components.map(treeClone),
      }
      const idx = cur.wireframes.findIndex((w) => w.id === action.id)
      const wireframes = [...cur.wireframes]
      wireframes.splice(idx + 1, 0, copy)
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'DELETE_WIREFRAME': {
      const wireframes = cur.wireframes.filter((w) => w.id !== action.id)
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'ADD_BLANK_WIREFRAME': {
      const wf = {
        id: uid('wf'),
        requirementId: null,
        name: action.name || '新畫面',
        device: 'desktop',
        template: 'generic',
        components: [{ id: uid('cmp'), type: 'header', label: '頁面標題', width: 'full' }],
      }
      return replaceCurrent(touch({ ...cur, wireframes: [...cur.wireframes, wf] }))
    }

    case 'INSERT_COMPONENT': {
      // 從元件面板拖曳新增：beforeId 給定則插在該元件之前，否則加進 parentId 容器（或最外層）
      const wireframes = cur.wireframes.map((w) => {
        if (w.id !== action.wireframeId) return w
        if (action.beforeId) return { ...w, components: treeInsertBefore(w.components, action.beforeId, action.component) }
        return { ...w, components: treeAddChild(w.components, action.parentId || null, action.component) }
      })
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'PASTE_COMPONENT': {
      // 貼上：node 已在 client 端配好新 id；afterId 給定則插在其後，否則加到最外層
      const node = action.region ? { ...action.component, region: action.region } : action.component
      const wireframes = cur.wireframes.map((w) => {
        if (w.id !== action.wireframeId) return w
        if (action.afterId) return { ...w, components: treeInsertAfter(w.components, action.afterId, node) }
        return { ...w, components: treeAddChild(w.components, null, node) }
      })
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'ADD_WIREFRAME': {
      const incoming = action.wireframes || (action.wireframe ? [action.wireframe] : [])
      return replaceCurrent(touch({ ...cur, wireframes: [...cur.wireframes, ...incoming] }))
    }

    case 'SAVE_BLOCK': {
      const block = { id: uid('blk'), name: action.name || '未命名區塊', node: treeClone(action.node) }
      return replaceCurrent(touch({ ...cur, blocks: [...(cur.blocks || []), block] }))
    }

    case 'DELETE_BLOCK': {
      return replaceCurrent(touch({ ...cur, blocks: (cur.blocks || []).filter((b) => b.id !== action.id) }))
    }

    case 'UPDATE_FLOW':
    case 'UPDATE_FLOW_SILENT':
      return replaceCurrent(touch({ ...cur, flow: action.flow }))

    case 'REGENERATE_FLOW':
      return replaceCurrent(touch({ ...cur, flow: generateFlow(cur) }))

    case 'REGENERATE_FLOW_FROM_WIREFRAMES':
      return replaceCurrent(touch({ ...cur, flow: generateFlowFromWireframes(cur) }))

    case 'IMPORT_FLOWS': {
      // 匯入 JSON 帶的 flows：組成圖、綁定既有頁面，併入現有流程（往右排開）
      const g = buildFlowsGraph(action.flows, cur.wireframes)
      if (!g.nodes.length) return state
      const existing = cur.flow?.graph
      let merged = g
      if (existing?.nodes?.length) {
        const maxX = existing.nodes.reduce((m, n) => Math.max(m, n.x || 0), -Infinity)
        const off = isFinite(maxX) ? maxX + 520 : 0
        merged = {
          nodes: [...existing.nodes, ...g.nodes.map((n) => ({ ...n, x: (n.x || 0) + off }))],
          edges: [...(existing.edges || []), ...g.edges],
        }
      }
      return replaceCurrent(touch({ ...cur, flow: { graph: merged } }))
    }

    case 'SET_SPEC_OVERRIDE':
      return replaceCurrent(touch({ ...cur, specOverride: action.value }))

    case 'LOAD_PROJECT': {
      // 匯入專案 JSON
      const proj = { ...action.project, id: uid('proj') }
      return { ...state, projects: [...state.projects, proj], currentId: proj.id }
    }

    case 'REPLACE_STATE':
      return action.state

    default:
      return state
  }
}

// ── Undo/Redo 歷史包裝 ──
const HISTORY_LIMIT = 60
const NO_HISTORY = new Set(['SET_CURRENT', 'UNDO', 'REDO', 'REPLACE_STATE', 'UPDATE_FLOW_SILENT'])

function withHistory(baseReducer) {
  return (h, action) => {
    if (action.type === 'UNDO') {
      if (!h.past.length) return h
      const previous = h.past[h.past.length - 1]
      return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] }
    }
    if (action.type === 'REDO') {
      if (!h.future.length) return h
      const next = h.future[0]
      return { past: [...h.past, h.present], present: next, future: h.future.slice(1) }
    }
    const present = baseReducer(h.present, action)
    if (present === h.present) return h
    if (NO_HISTORY.has(action.type)) return { ...h, present }
    return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present, future: [] }
  }
}

export function StoreProvider({ children }) {
  const [hist, dispatch] = useReducer(withHistory(reducer), undefined, () => ({
    past: [], present: loadState(), future: [],
  }))
  const state = hist.present

  useEffect(() => {
    saveState(state)
  }, [state])

  const current = useMemo(
    () => state.projects.find((p) => p.id === state.currentId) || state.projects[0],
    [state],
  )

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
  const redo = useCallback(() => dispatch({ type: 'REDO' }), [])

  const value = useMemo(
    () => ({ state, current, dispatch, undo, redo, canUndo: hist.past.length > 0, canRedo: hist.future.length > 0 }),
    [state, current, hist.past.length, hist.future.length],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore 必須在 StoreProvider 內使用')
  return ctx
}
