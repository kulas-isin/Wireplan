// 規格文件產生器：依需求清單組出 Markdown 規格文件。
import { categoryMeta } from './categories.js'

function fmtDate(ts) {
  const d = ts ? new Date(ts) : new Date()
  return d.toISOString().slice(0, 10)
}

// 產生功能需求總表
function requirementTable(requirements) {
  const head = '| # | 功能名稱 | 分類 | 優先級 | 工時 | 報價 |\n|---|---|---|---|---|---|'
  const rows = requirements.map((r, i) => {
    const cat = categoryMeta(r.category).label
    return `| ${i + 1} | ${r.name || '-'} | ${cat} | ${r.priority || '-'} | ${r.estimate || '-'} | ${r.price || '-'} |`
  })
  return [head, ...rows].join('\n')
}

// 單一功能的詳述區塊
function requirementSection(r, idx) {
  const cat = categoryMeta(r.category).label
  const lines = []
  lines.push(`### ${idx + 1}. ${r.name || '未命名功能'}`)
  lines.push('')
  lines.push(`- **分類**：${cat}`)
  lines.push(`- **優先級**：${r.priority || '中'}`)
  if (r.estimate) lines.push(`- **預估工時**：${r.estimate}`)
  if (r.price) lines.push(`- **報價**：${r.price}`)
  if (r.screen) lines.push(`- **對應畫面**：${r.screen}`)
  lines.push('')
  lines.push('**功能說明**')
  lines.push('')
  lines.push(r.description ? r.description : '_（待補充）_')
  lines.push('')
  lines.push('**驗收條件**')
  lines.push('')
  if (r.acceptance) {
    lines.push(r.acceptance)
  } else {
    lines.push('- [ ] 使用者可正常進入此功能畫面')
    lines.push('- [ ] 主要操作流程可順利完成並儲存')
    lines.push('- [ ] 異常情況有適當提示')
  }
  if (r.note) {
    lines.push('')
    lines.push(`> 備註：${r.note}`)
  }
  return lines.join('\n')
}

// 主函式：回傳 Markdown 字串
export function generateSpec(project) {
  const reqs = project.requirements || []
  const lines = []
  lines.push(`# ${project.name || '專案'} — 系統規格文件`)
  lines.push('')
  lines.push(`> 產生日期：${fmtDate(Date.now())}　|　需求項目：${reqs.length} 項`)
  lines.push('')
  lines.push('## 一、專案概述')
  lines.push('')
  lines.push(project.overview || '_（請填寫專案背景、目標與範圍）_')
  lines.push('')
  lines.push('## 二、功能需求總表')
  lines.push('')
  lines.push(requirementTable(reqs))
  lines.push('')
  lines.push('## 三、功能需求詳述')
  lines.push('')
  reqs.forEach((r, i) => {
    lines.push(requirementSection(r, i))
    lines.push('')
  })
  lines.push('## 四、非功能需求')
  lines.push('')
  lines.push('- **效能**：一般操作回應時間 < 2 秒。')
  lines.push('- **相容性**：支援主流瀏覽器最新版本（Chrome / Edge / Safari）。')
  lines.push('- **安全性**：登入需驗證，敏感資料傳輸加密（HTTPS）。')
  lines.push('- **可用性**：介面需符合 RWD，支援桌機與行動裝置。')
  lines.push('')
  lines.push('## 五、需求異動紀錄')
  lines.push('')
  lines.push('| 日期 | 版本 | 異動內容 | 異動人 |')
  lines.push('|---|---|---|---|')
  lines.push(`| ${fmtDate(Date.now())} | v0.1 | 初版產生 | - |`)
  return lines.join('\n')
}
