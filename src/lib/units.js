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

// 頁面編號的自然排序鍵：P3-01 → ['P',3,1]、M3-01-2 → ['M',3,1,2]；頁面（P）排在彈窗（M）前面
const CODE_RANK = { P: 0, M: 1 }
export function codeKey(code) {
  const s = String(code || '').trim().toUpperCase()
  if (!s) return null
  const parts = s.match(/[A-Z]+|\d+/g) || []
  return parts.map((p) => (/^\d+$/.test(p) ? Number(p) : (p in CODE_RANK ? CODE_RANK[p] : 2 + p.charCodeAt(0) / 1000)))
}
export function compareCode(a, b) {
  const ka = codeKey(a), kb = codeKey(b)
  if (!ka && !kb) return 0
  if (!ka) return 1
  if (!kb) return -1
  for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
    const x = ka[i] ?? -1, y = kb[i] ?? -1
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}
// 把某單元（不給 unit 則每個單元各自）的頁面依編號排好，沒編號的維持原相對順序、排在有編號的後面；
// 其他單元的頁面位置不動
export function sortWireframesByCode(wireframes, unit) {
  const list = wireframes || []
  const units = unit != null ? [unit] : [...new Set(list.map((w) => (w.unit || '').trim()))]
  let out = list
  for (const u of units) {
    const idx = []
    out.forEach((w, i) => { if ((w.unit || '').trim() === u) idx.push(i) })
    if (idx.length < 2) continue
    const pages = idx.map((i) => out[i])
    const coded = pages.filter((w) => w.code).sort((a, b) => compareCode(a.code, b.code))
    const rest = pages.filter((w) => !w.code)
    const sorted = [...coded, ...rest]
    const next = [...out]
    idx.forEach((i, k) => { next[i] = sorted[k] })
    out = next
  }
  return out
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
