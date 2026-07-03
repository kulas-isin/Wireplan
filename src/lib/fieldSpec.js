// 欄位規格：從 wireframe 自動抽欄位 + 結構化選項（對應 SM 欄位規格 SOP 的 11 屬性）。
import { uid } from './id.js'

// 下拉選項（給結構化編輯用）
export const F_TYPES = ['text', 'number', 'enum', 'date', 'datetime', 'bool', 'file', 'ref', 'array']
export const F_REQUIRED = ['是', '否', '條件式']
export const F_SOURCE = ['使用者輸入', 'API 回傳', '系統計算', '常數', '前頁帶入', '後台設定']
export const F_STATUS = ['草稿', '已確認', '待拍板']
export const MODULE_CODES = ['auth', 'member', 'playlist', 'song', 'artist', 'mv', 'order', 'sub', 'giftcard', 'home', 'push', 'tag', 'device', 'search']

const mapControl = (c) => ({ password: 'text', textarea: 'text', toggle: 'bool', select: 'enum', number: 'number', date: 'date' }[c] || 'text')
const guessColType = (col) => {
  if (/狀態|status|類型|type/i.test(col)) return 'enum'
  if (/日期|時間|date|time|建立|更新/i.test(col)) return 'date'
  if (/數|量|價|金額|時長|占比|percent|%/i.test(col)) return 'number'
  return 'text'
}

const row = (o) => ({
  _k: uid('fld'), id: '', label: '', i18n: '', type: 'text', required: '否', source: '使用者輸入',
  default: '', validations: [], visibility: '恆顯示', usage: '', mapping: { wf: '', api: '', db: '' }, status: '草稿', ref: null, ...o,
})

// 解析 formgrid 欄名：後綴 * = 必填、:select/:date/:number/:textarea = 型別
function parseFormField(name) {
  let n = String(name || '').trim(), required = '否', kind = null
  const ci = n.indexOf(':')
  if (ci >= 0) { kind = n.slice(ci + 1).trim(); n = n.slice(0, ci) }
  if (n.endsWith('*')) { required = '是'; n = n.slice(0, -1) }
  const type = kind === 'select' ? 'enum' : kind === 'date' ? 'date' : kind === 'number' ? 'number' : 'text'
  return { label: n.trim(), required, type }
}

// 從一張 wireframe 抽出欄位（走訪 field / formgrid / table columns / filter / searchbar / 選擇類）
export function extractFields(wireframe) {
  const out = []
  const wf = wireframe?.name || ''
  const wfId = wireframe?.id || ''
  let curRef = null
  const push = (o) => { if (o.label) out.push(row({ ...o, ref: o.ref || curRef, mapping: { wf, api: '', db: '', ...(o.mapping || {}) } })) }
  const walk = (cs) => {
    for (const c of cs || []) {
      if (!c || typeof c !== 'object') continue
      curRef = { wfId, compId: c.id }
      switch (c.type) {
        case 'field':
          push({ label: c.label, type: mapControl(c.control), required: c.required ? '是' : '否', source: '使用者輸入' }); break
        case 'formgrid':
          (c.fields || []).forEach((f) => { const p = parseFormField(f); push({ label: p.label, type: p.type, required: p.required, source: '使用者輸入' }) }); break
        case 'table':
          (c.columns || []).forEach((col) => { if (/^#$|操作|action/i.test(col)) return; push({ label: col, type: guessColType(col), source: 'API 回傳' }) }); break
        case 'filter':
          (c.fields || []).forEach((f) => push({ label: f, type: 'enum', source: '後台設定' })); break
        case 'searchbar':
          push({ label: '搜尋關鍵字', type: 'text', source: '使用者輸入', usage: '搜尋' }); break
        case 'checkbox': case 'radio': case 'segmented':
          push({ label: c.label || (c.type === 'segmented' ? '切換' : '選項'), type: 'enum', source: '使用者輸入' }); break
        case 'datepicker': case 'daterange':
          push({ label: c.label || '日期', type: 'date', source: '使用者輸入' }); break
        case 'number':
          push({ label: c.label || '數字', type: 'number', source: '使用者輸入' }); break
        case 'upload':
          push({ label: c.label || '附件', type: 'file', source: '使用者輸入' }); break
        case 'rate': case 'slider':
          push({ label: c.label || (c.type === 'rate' ? '評分' : '數值'), type: 'number', source: '使用者輸入' }); break
        default: break
      }
      if (Array.isArray(c.children)) walk(c.children)
    }
  }
  walk(wireframe?.components)
  // 去重（同畫面同 label）
  const seen = new Set()
  const dedup = out.filter((r) => { if (seen.has(r.label)) return false; seen.add(r.label); return true })
  return dedup.map((r) => enrichField(r, wf))
}

const pageShort = (n) => String(n || '').replace(/^[wWＷ]?\s*[.\d]+[a-zA-Z]?\s*/, '').replace(/[（(【[].*?[）)】\]]/g, '').trim()
const likelyRequired = (l) => /帳號|密碼|email|信箱|手機|電話|名稱|標題|title|name/i.test(l)
function guessValidations(label, type) {
  const L = String(label || '')
  if (/email|信箱/i.test(L)) return ['Email 格式']
  if (/手機|電話|phone|mobile/i.test(L)) return ['手機號碼格式']
  if (/密碼|password/i.test(L)) return ['≥8 字元']
  if (/名稱|標題|name|title/i.test(L)) return ['≤30 字元', '不可全空白']
  if (type === 'enum') return ['見字典 [[待補]]']
  if (type === 'number') return ['數值範圍：待補']
  return []
}
// 智慧預設：把常見的驗證/必填/使用情境先猜好，使用者少填
function enrichField(r, wfName) {
  const required = r.required === '否' && likelyRequired(r.label) ? '是' : r.required
  let validations = r.validations && r.validations.length ? r.validations : guessValidations(r.label, r.type)
  if (required === '是' && !validations.includes('必填')) validations = ['必填', ...validations]
  const usage = r.usage || (wfName ? `${pageShort(wfName)}` : '')
  return { ...r, required, validations, usage }
}

// 匯入用：把 AI/外部產的 fields 正規化（補預設、_k、mapping、validations 陣列）
export function normalizeField(f) {
  return {
    _k: uid('fld'), id: '', label: '', i18n: '', type: 'text', required: '否', source: '使用者輸入',
    default: '', visibility: '恆顯示', usage: '', status: '草稿', ref: null, ...f,
    mapping: { wf: '', api: '', db: '', ...(f.mapping || {}) },
    validations: Array.isArray(f.validations) ? f.validations : (f.validations ? String(f.validations).split(/[；;]/).map((s) => s.trim()).filter(Boolean) : []),
  }
}

export const emptyField = () => row({})

// 模組範本：一鍵帶入該類常見欄位（含常見驗證），不用每格自己想
export const FIELD_TEMPLATES = {
  form: { name: '表單（新增/編輯）', rows: [
    { label: '名稱', type: 'text', required: '是', validations: ['必填', '≤30 字元'], usage: '建立(C)、編輯(U)' },
    { label: '分類', type: 'enum', validations: ['見字典 [[待補]]'], usage: '建立(C)、編輯(U)' },
    { label: '狀態', type: 'enum', source: '系統計算', default: '草稿', validations: ['見字典 [[待補]]'] },
    { label: '說明', type: 'text', required: '否', validations: ['≤500 字元'] },
    { label: '建立時間', type: 'datetime', source: 'API 回傳', usage: '詳情(R)' },
  ] },
  list: { name: '清單 / 表格', rows: [
    { label: '名稱', type: 'text', source: 'API 回傳' },
    { label: '狀態', type: 'enum', source: 'API 回傳', validations: ['見字典 [[待補]]'] },
    { label: '建立時間', type: 'datetime', source: 'API 回傳' },
    { label: '操作', type: 'text', source: '系統計算', usage: '列表(R)' },
  ] },
  detail: { name: '詳情頁', rows: [
    { label: 'ID', type: 'ref', source: 'API 回傳', required: '是' },
    { label: '名稱', type: 'text', source: 'API 回傳' },
    { label: '狀態', type: 'enum', source: 'API 回傳', validations: ['見字典 [[待補]]'] },
    { label: '建立時間', type: 'datetime', source: 'API 回傳' },
    { label: '更新時間', type: 'datetime', source: 'API 回傳' },
  ] },
  auth: { name: '登入 / 註冊', rows: [
    { label: '帳號 / Email', type: 'text', required: '是', validations: ['必填', 'Email 格式'] },
    { label: '密碼', type: 'text', required: '是', validations: ['必填', '≥8 字元'] },
    { label: '手機號碼', type: 'text', required: '否', validations: ['手機號碼格式'] },
    { label: '驗證碼', type: 'text', required: '條件式', validations: ['6 碼數字'] },
  ] },
}

// 匯出成 SOP 的 11 欄 markdown 表格
export function fieldsToMarkdown(project) {
  const fs = project.fields || []
  const esc = (s) => String(s || '—').replace(/\|/g, '∣').replace(/\n/g, ' ')
  const lines = [`## 欄位規格 — ${project.name || '專案'}`, '']
  lines.push('| 欄位 ID | Label / i18n | 型別 | 必填 | 來源 | 預設值 | 驗證規則 | 顯示/啟用條件 | 使用情境 | 對應 | 狀態 |')
  lines.push('|---|---|---|:-:|---|---|---|---|---|---|:-:|')
  for (const f of fs) {
    const label = f.i18n ? `${f.label} / \`${f.i18n}\`` : f.label
    const valid = (f.validations || []).join('；')
    const map = [f.mapping?.wf && `WF: ${f.mapping.wf}`, f.mapping?.api && `API: ${f.mapping.api}`, f.mapping?.db && `DB: ${f.mapping.db}`].filter(Boolean).join('；')
    lines.push(`| \`${esc(f.id)}\` | ${esc(label)} | ${esc(f.type)} | ${esc(f.required)} | ${esc(f.source)} | ${esc(f.default)} | ${esc(valid)} | ${esc(f.visibility)} | ${esc(f.usage)} | ${esc(map)} | ${esc(f.status)} |`)
  }
  return lines.join('\n')
}
