// 匯入解析：將 Excel / CSV / PDF 轉成「原始列資料」或「原始文字」，
// 後續再交給 requirementExtractor 轉成結構化需求。
import * as XLSX from 'xlsx'

// 解析 Excel / CSV。回傳 { headers: string[], rows: object[] }
export async function parseSpreadsheet(file) {
  const data = await file.arrayBuffer()
  const wb = XLSX.read(data, { type: 'array' })
  const firstSheet = wb.SheetNames[0]
  const ws = wb.Sheets[firstSheet]
  // 先取成二維陣列，找出表頭列（第一個非空白列）
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false })
  if (!aoa.length) return { headers: [], rows: [] }

  const headerIdx = aoa.findIndex((r) => r.some((c) => String(c).trim() !== ''))
  const headers = (aoa[headerIdx] || []).map((h, i) => String(h).trim() || `欄位${i + 1}`)
  const rows = []
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const arr = aoa[i]
    if (!arr || !arr.some((c) => String(c).trim() !== '')) continue
    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = arr[idx] != null ? String(arr[idx]).trim() : ''
    })
    rows.push(obj)
  }
  return { headers, rows }
}

// 解析 PDF：抽取每頁文字。回傳純文字字串（保留換行）。
export async function parsePdf(file) {
  // 動態載入 pdfjs，避免 worker 在 SSR / 初次載入造成問題
  const pdfjsLib = await import('pdfjs-dist')
  const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc

  const data = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const lines = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    // 依 y 座標分行，重組成可讀文字
    let lastY = null
    let line = ''
    for (const item of content.items) {
      const y = item.transform[5]
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        if (line.trim()) lines.push(line.trim())
        line = ''
      }
      line += item.str
      lastY = y
    }
    if (line.trim()) lines.push(line.trim())
  }
  return lines.join('\n')
}

// 解析純文字貼上的內容（一行一需求，或含分隔符）
export function parsePlainText(text) {
  return String(text || '')
}

export async function parseFile(file) {
  const name = (file.name || '').toLowerCase()
  if (name.endsWith('.pdf')) {
    const text = await parsePdf(file)
    return { kind: 'text', text }
  }
  if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const { headers, rows } = await parseSpreadsheet(file)
    return { kind: 'table', headers, rows }
  }
  // 其他當作純文字
  const text = await file.text()
  return { kind: 'text', text }
}
