// SOP 儀表：需求覆蓋檢查 + 五階段進度統計
import { validateField, wireframeSync } from './fieldSpec.js'

const core = (l) => String(l || '')
  .replace(/^[wWＷ]?\s*[.\d]+[a-zA-Z]?\s*/, '').replace(/[（(【[].*?[）)】\]]/g, '').replace(/\s+/g, '').trim()

// 哪些需求還沒有對應頁面（用頁名模糊比對，與流程圖同邏輯）
export function requirementCoverage(project) {
  const wfNames = (project.wireframes || []).map((w) => core(w.name)).filter(Boolean)
  const missing = []
  for (const r of project.requirements || []) {
    const k = core(r.screen || r.name)
    if (!k) continue
    if (!wfNames.some((n) => n.includes(k) || k.includes(n))) missing.push(r)
  }
  return missing
}

// SOP 進度列統計：每站數字 + 缺漏
export function sopStats(project) {
  const reqs = (project.requirements || []).length
  const flowNodes = (project.flow?.graph?.nodes || project.flow?.nodes || []).filter((n) => ['page', 'screen', 'decision', 'process'].includes(n.type)).length
  const wfs = (project.wireframes || []).length
  const fields = project.fields || []
  const missingPages = requirementCoverage(project).length
  const fieldWarns = fields.filter((f) => validateField(f, fields).length > 0).length + wireframeSync(project).orphans.length
  const unregistered = wireframeSync(project).newCount
  return { reqs, flowNodes, wfs, fields: fields.length, missingPages, fieldWarns, unregistered }
}
