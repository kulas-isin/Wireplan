// 將匯入的原始資料（表格列 / 純文字）轉成結構化需求清單。
import { uid } from './id.js'
import { detectCategory } from './categories.js'

// 常見報價單欄位的別名對應，用來自動猜測欄位用途
const FIELD_ALIASES = {
  name: ['功能', '功能名稱', '項目', '需求', '需求名稱', '品項', '工作項目', 'item', 'feature', 'name', 'module', '模組', '功能項目'],
  description: ['說明', '描述', '需求說明', '功能說明', '備註說明', '內容', 'description', 'desc', 'detail', '規格'],
  estimate: ['工時', '人天', '人月', '估時', '工期', 'effort', 'mandays', 'estimate', 'hours', '天數'],
  price: ['報價', '金額', '單價', '小計', '價格', '費用', 'price', 'amount', 'cost', 'subtotal'],
  qty: ['數量', '單位', 'qty', 'quantity', 'unit'],
  priority: ['優先', '優先級', '優先順序', 'priority', '等級'],
  category: ['分類', '類別', '類型', 'category', 'type', '模組分類'],
  note: ['備註', '附註', 'remark', 'note', 'memo'],
}

function matchField(header) {
  const h = String(header).toLowerCase().trim()
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((a) => h.includes(a.toLowerCase()))) return field
  }
  return null
}

// 建立欄位對應表：{ name: '功能名稱', price: '報價', ... }
export function buildFieldMapping(headers = []) {
  const mapping = {}
  for (const h of headers) {
    const field = matchField(h)
    if (field && !mapping[field]) mapping[field] = h
  }
  // 若沒抓到名稱欄位，預設用第一欄
  if (!mapping.name && headers.length) mapping.name = headers[0]
  return mapping
}

function newRequirement(partial = {}) {
  return {
    id: uid('req'),
    name: '',
    description: '',
    category: 'generic',
    priority: '中',
    estimate: '',
    price: '',
    acceptance: '',
    note: '',
    screen: '',
    ...partial,
  }
}

// 由表格列建立需求
export function requirementsFromRows(rows, headers, mapping) {
  const map = mapping || buildFieldMapping(headers)
  const out = []
  for (const row of rows) {
    const name = (map.name && row[map.name]) || ''
    if (!String(name).trim()) continue
    const description = (map.description && row[map.description]) || ''
    const givenCategory = (map.category && row[map.category]) || ''
    out.push(
      newRequirement({
        name: String(name).trim(),
        description: String(description).trim(),
        category: givenCategory ? givenCategory : detectCategory(`${name} ${description}`),
        priority: (map.priority && row[map.priority]) || '中',
        estimate: (map.estimate && row[map.estimate]) || '',
        price: (map.price && row[map.price]) || '',
        note: (map.note && row[map.note]) || '',
        screen: String(name).trim(),
      }),
    )
  }
  return out
}

// 由純文字建立需求：每行一筆；可用「：」或「-」分隔名稱與描述
export function requirementsFromText(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s\-*•\d.、）)]+/, '').trim())
    .filter((l) => l.length > 0)
  const out = []
  for (const line of lines) {
    const m = line.split(/[:：]/)
    const name = (m[0] || line).trim()
    const description = m.length > 1 ? m.slice(1).join('：').trim() : ''
    if (!name) continue
    out.push(
      newRequirement({
        name,
        description,
        category: detectCategory(`${name} ${description}`),
        screen: name,
      }),
    )
  }
  return out
}

export { newRequirement }
