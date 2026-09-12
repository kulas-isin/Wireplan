// 單元層：單元 → 頁面（parentId 階層）→ 需求。
// 單元是字串標籤：專案存排序清單（project.units），卡與頁各帶 unit 欄位，牆是即時算的視圖。
import { linkedPages } from './elements.js'

export const statusOfReq = (r) => (r.pending ? 2 : (r.versions || []).length ? 1 : 0) // 0待確認 1已蓋章 2異動

// 專案的單元清單：已存排序在前，卡/頁上出現過但未入清單的補在後（不遺漏）
export function unitsOf(project) {
  const stored = project.units || []
  const seen = new Set(stored)
  const extra = []
  for (const x of [...(project.requirements || []), ...(project.wireframes || [])]) {
    const u = (x.unit || '').trim()
    if (u && !seen.has(u)) { seen.add(u); extra.push(u) }
  }
  return [...stored, ...extra]
}

export const reqsOfUnit = (project, unit) => (project.requirements || []).filter((r) => (r.unit || '').trim() === unit)
export const unassignedReqs = (project) => (project.requirements || []).filter((r) => !(r.unit || '').trim())

// 單元磁磚要的統計：卡數、狀態組成、缺頁數
export function unitStats(project, unit) {
  const reqs = reqsOfUnit(project, unit)
  const c = { draft: 0, ok: 0, chg: 0, miss: 0 }
  for (const r of reqs) {
    const st = statusOfReq(r)
    if (st === 2) c.chg++
    else if (st === 1) c.ok++
    else c.draft++
    if (linkedPages(r, project.wireframes || []).length === 0) c.miss++
  }
  return { ...c, total: reqs.length }
}

// 單元的頁面樹：unit 相符的 wireframe 依 parentId 組樹（parentId 失聯的視為頂層）
export function pageTree(project, unit) {
  const pages = (project.wireframes || []).filter((w) => (w.unit || '').trim() === unit)
  const ids = new Set(pages.map((w) => w.id))
  const kidsOf = new Map(pages.map((w) => [w.id, []]))
  const roots = []
  for (const w of pages) {
    if (w.parentId && ids.has(w.parentId)) kidsOf.get(w.parentId).push(w)
    else roots.push(w)
  }
  const build = (w) => ({ wf: w, kids: kidsOf.get(w.id).map(build) })
  return roots.map(build)
}

// 掛在某頁上的需求（requirementId 連結優先 + 名稱模糊比對，與卡片 chip 同邏輯）
export function reqsOfPage(project, wf) {
  return (project.requirements || []).filter((r) => linkedPages(r, [wf]).length > 0)
}

// 單元裡「還沒掛到任何頁」的需求（有卡沒畫面 → 牆上直接看到洞）
export function looseReqs(project, unit) {
  return reqsOfUnit(project, unit).filter((r) => linkedPages(r, project.wireframes || []).length === 0)
}
