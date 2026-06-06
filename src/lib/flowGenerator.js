// 流程設計文件產生器：依需求清單組出整體操作流程，
// 同時輸出可編輯的步驟結構與 Mermaid 流程圖文字。
import { uid } from './id.js'
import { categoryMeta } from './categories.js'

// 各分類在流程中對應的「主要動作步驟」
const FLOW_STEPS = {
  auth: ['開啟系統', '輸入帳密登入', '驗證身分'],
  dashboard: ['進入儀表板', '檢視關鍵指標'],
  list: ['開啟列表', '搜尋/篩選資料', '選擇項目'],
  form: ['開啟表單', '填寫欄位', '送出儲存'],
  detail: ['檢視詳細資料'],
  report: ['設定查詢條件', '產生報表', '匯出/列印'],
  workflow: ['填寫申請', '逐關審核', '完成流程'],
  payment: ['確認訂單', '填寫付款資訊', '完成付款'],
  setting: ['進入設定', '調整參數', '儲存設定'],
  generic: ['進入頁面', '執行操作'],
}

// 產生可編輯的流程步驟結構（陣列）
export function generateFlow(project) {
  const reqs = project.requirements || []
  const steps = []
  steps.push({ id: uid('step'), kind: 'start', label: '開始' })

  // 若有登入需求，放最前面
  const sorted = [...reqs].sort((a, b) => {
    const order = { auth: 0, dashboard: 1 }
    return (order[a.category] ?? 5) - (order[b.category] ?? 5)
  })

  for (const r of sorted) {
    const acts = FLOW_STEPS[r.category] || FLOW_STEPS.generic
    steps.push({
      id: uid('step'),
      kind: 'group',
      label: r.name || categoryMeta(r.category).label,
      category: r.category,
      requirementId: r.id,
      actions: acts.map((a) => ({ id: uid('act'), label: a })),
    })
  }
  steps.push({ id: uid('step'), kind: 'end', label: '結束' })
  return { steps }
}

// 將流程步驟結構轉成 Mermaid flowchart 文字
export function flowToMermaid(flow) {
  const lines = ['flowchart TD']
  const nodes = []
  nodes.push({ id: 'start', shape: `([開始])` })
  ;(flow.steps || []).forEach((s) => {
    if (s.kind === 'start' || s.kind === 'end') return
    if (s.kind === 'group') {
      const gid = s.id.replace(/[^a-zA-Z0-9_]/g, '')
      nodes.push({ id: gid, shape: `[${s.label}]`, sub: (s.actions || []).map((a) => a.label) })
    }
  })
  nodes.push({ id: 'end', shape: `([結束])` })

  // 節點宣告
  nodes.forEach((n) => {
    lines.push(`  ${n.id}${n.shape}`)
  })
  // 連線
  for (let i = 0; i < nodes.length - 1; i++) {
    lines.push(`  ${nodes[i].id} --> ${nodes[i + 1].id}`)
  }
  return lines.join('\n')
}

// 將流程轉成 Markdown 文件
export function flowToMarkdown(project, flow) {
  const lines = []
  lines.push(`# ${project.name || '專案'} — 流程設計文件`)
  lines.push('')
  lines.push('## 整體操作流程')
  lines.push('')
  ;(flow.steps || []).forEach((s) => {
    if (s.kind === 'start') lines.push('🟢 **開始**')
    else if (s.kind === 'end') lines.push('🔴 **結束**')
    else if (s.kind === 'group') {
      lines.push('')
      lines.push(`### ◆ ${s.label}（${categoryMeta(s.category).label}）`)
      ;(s.actions || []).forEach((a, i) => lines.push(`${i + 1}. ${a.label}`))
    }
  })
  lines.push('')
  lines.push('## 流程圖（Mermaid）')
  lines.push('')
  lines.push('```mermaid')
  lines.push(flowToMermaid(flow))
  lines.push('```')
  return lines.join('\n')
}
