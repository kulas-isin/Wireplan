// 元件清單：需求確定後列出「這條需求需要哪些元件」，
// 並自動比對已對應頁面上實際畫了什麼 — 畫好的打勾、沒畫的亮出來。
import { COMPONENT_TYPES, regenerateComponents } from './wireframeTemplates.js'

// 正規化：去括號註記、空白分隔符、尾綴「鈕/按鈕/按鍵」，忽略大小寫
const norm = (s) => String(s || '')
  .replace(/[（(【[].*?[）)】\]]/g, '')
  .replace(/[\s·・,，、/｜|]/g, '')
  .replace(/(按鈕|按鍵|鈕)$/, '')
  .toLowerCase()

function* walk(components = []) {
  for (const c of components) {
    yield c
    if (Array.isArray(c.children)) yield* walk(c.children)
  }
}

// 元件在頁面上的落點：比對元件 label、型別中文名，以及按鈕/頁籤/欄位等字串屬性
const STR_PROPS = ['buttons', 'tabs', 'steps', 'fields', 'columns', 'options', 'items', 'cards']
export function findElementOnPages(label, pages = []) {
  const k = norm(label)
  if (!k) return null
  for (const w of pages) {
    for (const c of walk(w.components || [])) {
      const cands = [c.label, COMPONENT_TYPES[c.type]?.label]
      for (const p of STR_PROPS) if (Array.isArray(c[p])) cands.push(...c[p])
      for (const cand of cands) {
        const n = norm(cand)
        if (n && (n.includes(k) || k.includes(n))) return { page: w }
      }
    }
  }
  return null
}

// 頁面清單：依名稱在全部 wireframe 中找已建的頁（模糊比對，與卡片「N 頁」chip 同邏輯）
export function findPageByName(name, wireframes = []) {
  const k = norm(name)
  if (!k) return null
  return wireframes.find((w) => { const n = norm(w.name); return n && (n.includes(k) || k.includes(n)) }) || null
}

// 依需求分類建議「這條需求通常涵蓋哪幾頁」（含常見情境分支）
const PAGE_SUGGEST = {
  auth: ['登入頁', '註冊頁', '忘記密碼頁'],
  list: ['列表頁', '新增／編輯頁', '詳情頁'],
  form: ['表單頁', '送出完成頁'],
  detail: ['詳情頁'],
  dashboard: ['儀表板'],
  report: ['報表頁'],
  workflow: ['申請頁', '審核頁', '完成頁'],
  setting: ['設定頁'],
  payment: ['購物車頁', '結帳頁', '付款完成頁', '付款失敗頁'],
}
export function suggestPages(req) {
  return PAGE_SUGGEST[req.category] || [req.screen || req.name || '頁面'].filter(Boolean)
}

// 依需求分類範本建議元件：略過版面雜訊（頂列/側欄/標題…），按鈕逐顆展開
const SKIP = new Set(['topbar', 'sidenav', 'header', 'pageHeader', 'breadcrumb', 'divider', 'image', 'text', 'link', 'row', 'card'])
export function suggestElements(req) {
  const { components } = regenerateComponents(req)
  const out = []
  for (const c of walk(components)) {
    if (c.type === 'buttonRow') { for (const b of c.buttons || []) out.push(`${b}鈕`); continue }
    if (SKIP.has(c.type)) continue
    out.push(c.label || COMPONENT_TYPES[c.type]?.label || '元件')
  }
  const seen = new Set()
  return out.filter((l) => { const k = norm(l); if (!k || seen.has(k)) return false; seen.add(k); return true })
}
