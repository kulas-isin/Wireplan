import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
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
      const wireframes = cur.wireframes.map((w) =>
        w.requirementId === action.requirementId
          ? { ...w, name: req.screen || req.name, template: req.category, components: regenerateComponents(req) }
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

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  const current = useMemo(
    () => state.projects.find((p) => p.id === state.currentId) || state.projects[0],
    [state],
  )

  const value = useMemo(() => ({ state, current, dispatch }), [state, current])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore 必須在 StoreProvider 內使用')
  return ctx
}
