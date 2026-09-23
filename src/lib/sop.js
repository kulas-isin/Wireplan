// SOP 儀表：需求覆蓋檢查 + 五階段進度統計
import { validateField, wireframeSync } from './fieldSpec.js'
import { linkedPages } from './elements.js'

// 哪些需求還沒有對應頁面
// 用 linkedPages 判定（requirementId 綁定優先、其次頁名模糊比對），
// 與單元磁磚的「缺頁」同一套邏輯 —— 兩邊數字必須一致
export function requirementCoverage(project) {
  const wfs = project.wireframes || []
  return (project.requirements || []).filter((r) => linkedPages(r, wfs).length === 0)
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
