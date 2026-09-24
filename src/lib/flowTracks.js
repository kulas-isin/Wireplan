// 流程圖分兩軌：「流程」講先後（主流程／例外／狀態機／邊界／排程），
// 「規則圖」講關係（資料模型、欄位層級、計算規則）。
// 兩軌各自計數、各自定稿；缺口盤點只看流程那一軌——
// 一條需求有規則圖不代表它有流程，畫線稿前要的是流程定稿。
export const isRule = (f) => (f?.kind || 'main') === 'rule'
export const procFlows = (list) => (list || []).filter((f) => !isRule(f))
export const ruleFlows = (list) => (list || []).filter(isRule)

// 需求被哪些「流程」涵蓋（規則圖不算）
export const coveredBy = (list, reqId) => procFlows(list).filter((f) => (f.covers || []).includes(reqId))
