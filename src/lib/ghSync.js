// 自動同步的純邏輯與狀態燈。引擎本體在 components/GithubAutoSync.jsx。
import { useSyncExternalStore } from 'react'

// 狀態燈：一個很小的外部 store，目錄頁的圖示、工作區頂列、設定面板都讀這個
// status: off | idle | pending | syncing | conflict | error
let snap = { status: 'off', at: null, msg: '' }
const subs = new Set()
export function setSyncStatus(patch) {
  snap = { ...snap, ...patch }
  for (const fn of subs) fn()
}
export function useSyncStatus() {
  return useSyncExternalStore((fn) => { subs.add(fn); return () => subs.delete(fn) }, () => snap, () => snap)
}
export const SYNC_LABEL = {
  off: '未設定同步', idle: '已同步', pending: '有改動待同步', syncing: '同步中', conflict: '兩邊都改過，等你決定', error: '同步失敗',
}

// 本機有沒有「上次同步之後」的改動：靠 project.updatedAt（所有會動內容的 action 都會 touch）
export const localDirty = (state, lastSyncAt) =>
  (state.projects || []).some((p) => (p.updatedAt || 0) > (lastSyncAt || 0))

export const hasAnyData = (state) =>
  (state.projects || []).some((p) => (p.requirements?.length || 0) + (p.wireframes?.length || 0) + (p.unitFlows?.length || 0) + (p.todos?.length || 0) > 0)

export const payloadOf = (state) => ({ app: 'wireplan', savedAt: Date.now(), projects: state.projects, library: state.library })

// 衝突視窗用：每個專案兩邊各改到什麼時候、有多少東西
export function summarize(projects = []) {
  return projects.map((p) => ({
    id: p.id, name: p.name, updatedAt: p.updatedAt || 0,
    n: `${p.requirements?.length || 0} 需求 · ${p.wireframes?.length || 0} 頁 · ${p.unitFlows?.length || 0} 圖 · ${(p.todos || []).filter((t) => !t.done).length} 待辦`,
  }))
}
export const fmt = (ts) => (ts ? new Date(ts).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
