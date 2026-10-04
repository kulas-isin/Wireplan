// 頁面規格 Excel：一本一專案、一頁一工作表，從規格清單直接產（不經文字版）。
// 工作表「目錄」列全部頁面；每頁由上往下：頁面資訊 → 跳轉規則 → 畫面元件清單（A–E 各一欄）→ 資料來源（可不含）→ 邊界情境。
import { buildSpecData } from './specText.js'

const sheetName = (s, used) => {
  let n = String(s || '頁面').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || '頁面'
  let out = n, i = 2
  while (used.has(out)) out = `${n} (${i++})`
  used.add(out)
  return out
}

export function specWorkbookRows(project, { withSource = true } = {}) {
  const wfs = (project.wireframes || []).filter((w) => w.spec?.sections)
  const index = [['頁面編號', '頁面名稱', '單元', '元件數', '最後更新']]
  const sheets = []
  const used = new Set(['目錄'])
  for (const wf of wfs) {
    const d = buildSpecData(project, wf)
    index.push([d.code, d.name, d.unit, d.elements.length, wf.updatedAt ? new Date(wf.updatedAt).toLocaleDateString('zh-TW') : ''])
    const rows = []
    rows.push(['頁面', `${d.code ? d.code + ' ' : ''}${d.name}`])
    if (d.unit) rows.push(['單元', d.unit])
    rows.push(['製作說明', [d.intro, ...d.notes].filter(Boolean).join('\n')])
    if (d.flows.length) rows.push(['相關流程', d.flows.join('、')])
    rows.push([])
    rows.push(['跳轉規則'])
    rows.push(['元素', '點擊行為'])
    if (d.jumps.length) for (const [a, b] of d.jumps) rows.push([a, b])
    else rows.push(['（無）'])
    rows.push([])
    rows.push(['畫面元件清單'])
    rows.push(['#', '元件', '區', 'A. 操作', 'B. 預設', 'C. 規則', 'D. 狀態', 'E. 選項'])
    for (const e of d.elements) rows.push([e.n, e.name, e.kind, e.op, e.def, e.rule, e.state, e.opt])
    if (!d.elements.length) rows.push(['', '（尚無元件）'])
    if (withSource) {
      rows.push([])
      rows.push(['資料來源', '方向：ERP→SL（推送 Shopline）、SL→ERP（從 Shopline 回寫）、雙向、僅 ERP（不同步）'])
      rows.push(['欄位', 'ERP 來源', 'Shopline 欄位', '方向', '備註'])
      for (const s of d.sources) rows.push([s.name, s.erp, s.sl, s.dir, s.memo])
      if (!d.sources.length) rows.push(['（無資料欄位）'])
    }
    rows.push([])
    rows.push(['邊界情境'])
    if (d.edges.length) for (const e of d.edges) rows.push([e])
    else rows.push(['（無資料／失敗／權限不足時怎麼呈現）'])
    sheets.push({ name: sheetName(d.code || d.name, used), rows })
  }
  return { index, sheets }
}

export async function exportSpecXlsx(project, opts = {}) {
  const XLSX = await import('xlsx')
  const { index, sheets } = specWorkbookRows(project, opts)
  const wb = XLSX.utils.book_new()
  const idx = XLSX.utils.aoa_to_sheet(index)
  idx['!cols'] = [{ wch: 10 }, { wch: 28 }, { wch: 14 }, { wch: 8 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, idx, '目錄')
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows)
    ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 10 }, { wch: 40 }, { wch: 22 }, { wch: 40 }, { wch: 22 }, { wch: 26 }]
    XLSX.utils.book_append_sheet(wb, ws, s.name)
  }
  const name = `${project.name || '專案'}-頁面規格${opts.withSource === false ? '（客戶版）' : ''}.xlsx`
  // 自己做下載（不用 XLSX.writeFile）：iOS Safari 才會帶正確檔名
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return { pages: sheets.length, name }
}
