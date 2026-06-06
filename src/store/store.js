// 全域狀態 + localStorage 持久化。
// 一個 project 包含：需求清單、wireframes、規格文字、流程結構。
import { uid } from '../lib/id.js'
import { generateWireframe } from '../lib/wireframeTemplates.js'
import { generateFlow } from '../lib/flowGenerator.js'

const STORAGE_KEY = 'wireplan.v1'

export function emptyProject(name = '新專案') {
  return {
    id: uid('proj'),
    name,
    overview: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    requirements: [],
    wireframes: [],
    flow: { steps: [] },
    specOverride: null, // 若使用者手動編輯規格，存於此
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    if (!parsed.projects || !parsed.projects.length) return defaultState()
    return parsed
  } catch {
    return defaultState()
  }
}

function defaultState() {
  const p = emptyProject('範例專案')
  return { projects: [p], currentId: p.id }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('儲存失敗', e)
  }
}

// 依需求清單同步產生 wireframe 與 flow（用於匯入後或重新生成）
export function rebuildArtifacts(project, { keepWireframeEdits = true } = {}) {
  const existingByReq = new Map((project.wireframes || []).map((w) => [w.requirementId, w]))
  const wireframes = project.requirements.map((r) => {
    if (keepWireframeEdits && existingByReq.has(r.id)) {
      return existingByReq.get(r.id)
    }
    return generateWireframe(r)
  })
  const flow = generateFlow(project)
  return { ...project, wireframes, flow, updatedAt: Date.now() }
}
