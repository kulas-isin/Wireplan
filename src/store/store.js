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
    parsed.library = { ...DEFAULT_LIBRARY, ...(parsed.library || {}) }
    return parsed
  } catch {
    return defaultState()
  }
}


// 訪談常用庫（全域、可在 UI 編輯）：快捷需求 chips + 引導問題
export const DEFAULT_LIBRARY = {
  chips: ['會員系統', '登入 / 註冊', '後台管理', '推播通知', '報表統計', '金流付款', '搜尋功能', '上傳檔案', '權限角色', '多語系'],
  guide: [
    '有哪些角色 / 身分？',
    '怎麼登入？（帳密 / 手機 / 第三方）',
    '前台給誰看？後台誰管理？',
    '需要通知嗎？（推播 / Email / 簡訊）',
    '有金流嗎？怎麼收費？',
    '要報表 / 匯出嗎？',
    '資料從哪來？（手動建 / 匯入 / 串接）',
    '需要多語系嗎？',
    '有現有系統要串接嗎？',
    '上線時間 / 預算範圍？',
  ],
}

function defaultState() {
  const p = emptyProject('範例專案')
  return { projects: [p], currentId: p.id, library: DEFAULT_LIBRARY }
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
