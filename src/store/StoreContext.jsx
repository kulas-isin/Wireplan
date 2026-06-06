import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import { loadState, saveState, emptyProject, rebuildArtifacts } from './store.js'
import { uid } from '../lib/id.js'
import { generateWireframe, regenerateComponents } from '../lib/wireframeTemplates.js'
import { generateFlow } from '../lib/flowGenerator.js'
import { detectCategory } from '../lib/categories.js'

const StoreContext = createContext(null)

function touch(project) {
  return { ...project, updatedAt: Date.now() }
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
      const wireframes = cur.wireframes.map((w) => {
        if (w.id !== action.wireframeId) return w
        return {
          ...w,
          components: w.components.map((cmp) =>
            cmp.id === action.componentId ? { ...cmp, ...action.patch } : cmp,
          ),
        }
      })
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'ADD_COMPONENT': {
      const wireframes = cur.wireframes.map((w) =>
        w.id === action.wireframeId ? { ...w, components: [...w.components, action.component] } : w,
      )
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'DELETE_COMPONENT': {
      const wireframes = cur.wireframes.map((w) =>
        w.id === action.wireframeId
          ? { ...w, components: w.components.filter((c) => c.id !== action.componentId) }
          : w,
      )
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'MOVE_COMPONENT': {
      const wireframes = cur.wireframes.map((w) => {
        if (w.id !== action.wireframeId) return w
        const arr = [...w.components]
        const idx = arr.findIndex((c) => c.id === action.componentId)
        const target = idx + action.dir
        if (idx < 0 || target < 0 || target >= arr.length) return w
        ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
        return { ...w, components: arr }
      })
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'REORDER_COMPONENTS': {
      const wireframes = cur.wireframes.map((w) => {
        if (w.id !== action.wireframeId) return w
        const byId = new Map(w.components.map((c) => [c.id, c]))
        const arr = action.orderedIds.map((id) => byId.get(id)).filter(Boolean)
        for (const c of w.components) if (!action.orderedIds.includes(c.id)) arr.push(c)
        return { ...w, components: arr }
      })
      return replaceCurrent(touch({ ...cur, wireframes }))
    }

    case 'DUPLICATE_COMPONENT': {
      const wireframes = cur.wireframes.map((w) => {
        if (w.id !== action.wireframeId) return w
        const idx = w.components.findIndex((c) => c.id === action.componentId)
        if (idx < 0) return w
        const copy = { ...w.components[idx], id: uid('cmp') }
        const arr = [...w.components]
        arr.splice(idx + 1, 0, copy)
        return { ...w, components: arr }
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
        components: src.components.map((c) => ({ ...c, id: uid('cmp') })),
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

    case 'UPDATE_FLOW':
      return replaceCurrent(touch({ ...cur, flow: action.flow }))

    case 'REGENERATE_FLOW':
      return replaceCurrent(touch({ ...cur, flow: generateFlow(cur) }))

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
const NO_HISTORY = new Set(['SET_CURRENT', 'UNDO', 'REDO', 'REPLACE_STATE'])

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
