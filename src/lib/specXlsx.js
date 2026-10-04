// 頁面規格 Excel：一本一專案、一頁一工作表，從規格清單直接產（不經文字版）。
// 工作表「目錄」列全部頁面（可點跳到該頁）；每頁由上往下：頁面資訊 → 跳轉規則 → 畫面元件清單（A–E 各一欄）→ 資料來源（可不含）→ 邊界情境。
// 樣式用 exceljs（Nuviq 配色：橄欖標題列、檸檬表頭、資訊類用藍）。
import { buildSpecData, BASIS_LABEL } from './specText.js'
const bl = (b) => BASIS_LABEL[b] || ''
const tag = (i) => (i.basis && i.basis !== 'quote' ? `〔${bl(i.basis)}〕` : '') + i.label

const sheetName = (s, used) => {
  let n = String(s || '頁面').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || '頁面'
  let out = n, i = 2
  while (used.has(out)) out = `${n} (${i++})`
  used.add(out)
  return out
}

// 每列帶型別，給樣式用：title／kv（標籤＋值）／section（段落標題）／head（表頭）／row（資料列）／bullet（整列一句）／blank
export function specWorkbookRows(project, { withSource = true } = {}) {
  const wfs = (project.wireframes || []).filter((w) => w.spec?.sections)
  const index = []
  const sheets = []
  const used = new Set(['目錄'])
  for (const wf of wfs) {
    const d = buildSpecData(project, wf)
    const name = sheetName(d.code || d.name, used)
    index.push({ code: d.code, name: d.name, unit: d.unit, n: d.elements.length, at: wf.updatedAt ? new Date(wf.updatedAt).toLocaleDateString('zh-TW') : '', sheet: name })
    const R = []
    R.push({ t: 'title', cells: [`${d.code ? d.code + '　' : ''}${d.name}`] })
    if (d.unit) R.push({ t: 'kv', cells: ['單元', d.unit] })
    if (d.intro || !d.groups.length) R.push({ t: 'kv', cells: ['製作說明', d.intro || '（這頁做什麼、給誰用、進入方式）'] })
    for (const g of d.groups) R.push({ t: 'kv', cells: [g.title, g.items.map((n) => '• ' + tag(n)).join('\n')] })
    R.push({ t: 'kv', cells: ['依據標記', '未標＝報價單原文；〔客戶確認〕＝會議決議或客戶補充；〔現行系統〕＝照現行做法；〔推測〕＝我們補的合理規則，客戶尚未確認'] })
    if (d.flows.length) R.push({ t: 'kv', cells: ['相關流程', d.flows.join('、')] })
    R.push({ t: 'blank' })
    R.push({ t: 'section', cells: ['跳轉規則'] })
    R.push({ t: 'head', cells: ['元素', '點擊行為', '依據'], span: [2, 6, 1] })
    if (d.jumps.length) for (const [a, b, bs] of d.jumps) R.push({ t: 'row', cells: [a, b, bl(bs)], span: [2, 6, 1], name: 0 })
    else R.push({ t: 'row', cells: ['（無）', '', ''], span: [2, 6, 1] })
    R.push({ t: 'blank' })
    R.push({ t: 'section', cells: ['畫面元件清單'] })
    R.push({ t: 'head', cells: ['#', '元件', '區', '依據', 'A. 操作', 'B. 預設', 'C. 規則', 'D. 狀態', 'E. 選項'] })
    for (const e of d.elements) R.push({ t: 'row', cells: [e.n, e.name, e.kind, bl(e.basis), e.op, e.def, e.rule, e.state, e.opt], name: 1 })
    if (!d.elements.length) R.push({ t: 'row', cells: ['', '（尚無元件）'] })
    if (withSource) {
      R.push({ t: 'blank' })
      R.push({ t: 'section', cells: ['資料來源', '方向：ERP→SL（推送 Shopline）、SL→ERP（從 Shopline 回寫）、雙向、僅 ERP（不同步）'], tone: 'info' })
      R.push({ t: 'head', cells: ['欄位', 'ERP 來源', 'Shopline 欄位', '方向', '備註', '依據'], span: [2, 2, 2, 1, 1, 1], tone: 'info' })
      for (const s of d.sources) R.push({ t: 'row', cells: [s.name, s.erp, s.sl, s.dir, s.memo, bl(s.basis)], span: [2, 2, 2, 1, 1, 1], name: 0 })
      if (!d.sources.length) R.push({ t: 'row', cells: ['（無資料欄位）'], span: [9] })
    }
    R.push({ t: 'blank' })
    R.push({ t: 'section', cells: ['邊界情境'] })
    if (d.edges.length) for (const e of d.edges) R.push({ t: 'bullet', cells: [tag(e)] })
    else R.push({ t: 'bullet', cells: ['（無資料／失敗／權限不足時怎麼呈現）'] })
    if (d.accept.length) {
      R.push({ t: 'blank' })
      R.push({ t: 'section', cells: ['驗收條件'] })
      for (const a of d.accept) R.push({ t: 'bullet', cells: [tag(a)] })
    }
    sheets.push({ name, rows: R })
  }
  return { index, sheets }
}

// ── 樣式 ──
const C = { olive: '3A5D25', ink: '22301F', lemon1: 'F7FAEC', lemon2: 'EAF2D8', lemon3: 'DCEBC7', lime: 'C6DC6A', blue: '2E5F96', blue2: 'E1EDF9', grey: '7A8A70', white: 'FFFFFF', line: 'D5E1C3', warn: 'B0691F', warn2: 'FBF0DC' }
const NCOL = 9
const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } })
const font = (o = {}) => ({ name: 'Microsoft JhengHei', size: 10, color: { argb: 'FF' + C.ink }, ...o })
const thin = (hex = C.line) => ({ style: 'thin', color: { argb: 'FF' + hex } })
const box = (hex) => ({ top: thin(hex), left: thin(hex), bottom: thin(hex), right: thin(hex) })
const WRAP = { wrapText: true, vertical: 'top' }

function styleSheet(ws, rows) {
  ws.columns = [{ width: 6 }, { width: 22 }, { width: 9 }, { width: 9 }, { width: 38 }, { width: 22 }, { width: 38 }, { width: 22 }, { width: 26 }]
  ws.views = [{ showGridLines: false }]
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
  let r = 0
  let zebra = 0
  for (const row of rows) {
    r++
    const xr = ws.getRow(r)
    if (row.t === 'blank') { xr.height = 8; continue }
    const cells = row.cells || []
    const info = row.tone === 'info'
    if (row.t === 'title') {
      ws.mergeCells(r, 1, r, NCOL)
      const c = xr.getCell(1); c.value = cells[0]
      c.font = font({ size: 16, bold: true, color: { argb: 'FF' + C.olive } }); c.fill = fill(C.lemon1)
      c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      c.border = { bottom: { style: 'medium', color: { argb: 'FF' + C.olive } } }
      xr.height = 34
      continue
    }
    if (row.t === 'kv') {
      const k = xr.getCell(1); ws.mergeCells(r, 1, r, 2); k.value = cells[0]
      k.font = font({ bold: true, color: { argb: 'FF' + C.olive } }); k.fill = fill(C.lemon2); k.alignment = { ...WRAP, indent: 1 }; k.border = box()
      const v = xr.getCell(3); ws.mergeCells(r, 3, r, NCOL); v.value = cells[1]
      v.font = font(); v.alignment = WRAP; v.border = box()
      const lines = String(cells[1] || '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 86)), 0)
      xr.height = Math.min(300, Math.max(20, lines * 14 + 6))
      continue
    }
    if (row.t === 'section') {
      ws.mergeCells(r, 1, r, cells.length > 1 ? 2 : NCOL)
      const c = xr.getCell(1); c.value = cells[0]
      c.font = font({ size: 11, bold: true, color: { argb: 'FF' + C.white } }); c.fill = fill(info ? C.blue : C.olive)
      c.alignment = { vertical: 'middle', indent: 1 }
      if (cells.length > 1) {
        ws.mergeCells(r, 3, r, NCOL)
        const h = xr.getCell(3); h.value = cells[1]
        h.font = font({ size: 9, color: { argb: 'FF' + (info ? C.blue : C.olive) } }); h.fill = fill(info ? C.blue2 : C.lemon2); h.alignment = { vertical: 'middle', indent: 1 }
      }
      xr.height = 22; zebra = 0
      continue
    }
    // head／row／bullet：依 span 把 8 欄分配給各格
    const span = row.t === 'bullet' ? [NCOL] : (row.span || cells.map(() => 1))
    let col = 1
    const isHead = row.t === 'head'
    const z = row.t === 'row' ? zebra++ : 0
    for (let i = 0; i < span.length; i++) {
      const w = span[i]
      if (w > 1) ws.mergeCells(r, col, r, col + w - 1)
      const c = xr.getCell(col)
      c.value = cells[i] ?? ''
      if (isHead) {
        c.font = font({ bold: true, color: { argb: 'FF' + (info ? C.blue : C.olive) } }); c.fill = fill(info ? C.blue2 : C.lemon3)
        c.alignment = { vertical: 'middle', horizontal: i === 0 && cells[0] === '#' ? 'center' : 'left', wrapText: true }
        c.border = box(info ? 'B9D0EA' : C.lime)
      } else {
        c.font = font({ color: { argb: 'FF' + (row.t === 'bullet' ? C.ink : C.ink) } })
        c.alignment = { ...WRAP, horizontal: i === 0 && span.length > 2 && typeof cells[0] === 'number' ? 'center' : 'left' }
        if (row.t === 'row' && z % 2 === 1) c.fill = fill(C.lemon1)
        c.border = box()
        if (row.t === 'row' && row.name === i) c.font = font({ bold: true })
        if (cells[i] === '推測') { c.font = font({ bold: true, color: { argb: 'FF' + C.warn } }); c.fill = fill(C.warn2) } // 推測用提醒色，一眼看出哪些客戶還沒確認
      }
      col += w
    }
    if (isHead) xr.height = 20
    else {
      // 依最長格估列高（字數 ÷ 欄寬）
      let maxLines = 1
      let cc = 1
      for (let i = 0; i < span.length; i++) {
        const width = ws.columns.slice(cc - 1, cc - 1 + span[i]).reduce((a, x) => a + (x.width || 10), 0)
        const txt = String(cells[i] ?? '')
        const lines = txt.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil((l.length * 1.75) / width)), 0)
        maxLines = Math.max(maxLines, lines); cc += span[i]
      }
      xr.height = Math.min(260, Math.max(18, maxLines * 13.5 + 5))
    }
  }
}

function styleIndex(ws, index, title) {
  ws.columns = [{ width: 12 }, { width: 30 }, { width: 14 }, { width: 8 }, { width: 12 }]
  ws.views = [{ showGridLines: false, state: 'frozen', ySplit: 3 }]
  ws.mergeCells(1, 1, 1, 5)
  const t = ws.getCell(1, 1); t.value = `${title}　頁面規格`
  t.font = font({ size: 16, bold: true, color: { argb: 'FF' + C.olive } }); t.fill = fill(C.lemon1); t.alignment = { vertical: 'middle', indent: 1 }
  t.border = { bottom: { style: 'medium', color: { argb: 'FF' + C.olive } } }
  ws.getRow(1).height = 34
  ws.mergeCells(2, 1, 2, 5)
  const s = ws.getCell(2, 1); s.value = `共 ${index.length} 頁，一頁一工作表。點頁面編號可跳到該頁。`
  s.font = font({ size: 9, color: { argb: 'FF' + C.grey } }); s.alignment = { vertical: 'middle', indent: 1 }
  ws.getRow(2).height = 18
  const h = ws.getRow(3)
  ;['頁面編號', '頁面名稱', '單元', '元件數', '最後更新'].forEach((v, i) => {
    const c = h.getCell(i + 1); c.value = v
    c.font = font({ bold: true, color: { argb: 'FF' + C.white } }); c.fill = fill(C.olive); c.alignment = { vertical: 'middle', horizontal: i === 3 ? 'center' : 'left', indent: i === 3 ? 0 : 1 }
  })
  h.height = 22
  index.forEach((it, i) => {
    const r = ws.getRow(4 + i)
    const a = r.getCell(1); a.value = { text: it.code || it.name, hyperlink: `#'${it.sheet.replace(/'/g, "''")}'!A1` }
    a.font = font({ bold: true, color: { argb: 'FF' + C.blue }, underline: true }); a.alignment = { vertical: 'middle', indent: 1 }
    const vals = [null, it.name, it.unit, it.n, it.at]
    for (let c = 2; c <= 5; c++) { const x = r.getCell(c); x.value = vals[c - 1]; x.font = font(); x.alignment = { vertical: 'middle', horizontal: c === 4 ? 'center' : 'left', indent: c === 4 ? 0 : 1 } }
    for (let c = 1; c <= 5; c++) { r.getCell(c).border = box(); if (i % 2 === 1) r.getCell(c).fill = fill(C.lemon1) }
    r.height = 19
  })
}

export async function buildSpecWorkbook(project, opts = {}) {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'))
  const { index, sheets } = specWorkbookRows(project, opts)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Wireplan'
  const idx = wb.addWorksheet('目錄')
  styleIndex(idx, index, project.name || '專案')
  for (const s of sheets) { const ws = wb.addWorksheet(s.name); styleSheet(ws, s.rows) }
  return { wb, pages: sheets.length }
}

export async function exportSpecXlsx(project, opts = {}) {
  const { wb, pages } = await buildSpecWorkbook(project, opts)
  const name = `${project.name || '專案'}-頁面規格.xlsx`
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  return { pages, name }
}
