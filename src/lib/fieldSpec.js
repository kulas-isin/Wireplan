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
  default: '', validations: [], visibility: '恆顯示', usage: '', mapping: { wf: '', api: '', db: '' }, status: '草稿', ref: null, dictRef: null, ...o,
})

// 字典項（單一真相源：enum / 共用實體只定義一次）
export const emptyDictEntry = () => ({ _k: uid('dic'), id: '', values: [], note: '', status: '草稿' })

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
// 自動猜英文欄名（PM 只要再選模組短碼即可湊成 ID）
const NAME_MAP = [
  [/帳號|email|信箱/i, 'account'], [/密碼|password|pin/i, 'password'], [/手機|電話|phone|mobile/i, 'phone'],
  [/驗證碼|otp/i, 'otp'], [/暱稱|nickname/i, 'nickname'], [/名稱|name/i, 'name'], [/標題|title/i, 'title'],
  [/狀態|status/i, 'status'], [/類型|type/i, 'type'], [/分類|類別|category/i, 'category'],
  [/說明|描述|desc/i, 'description'], [/封面|cover/i, 'cover'], [/圖片|image/i, 'image'], [/附件|檔案|file/i, 'file'],
  [/建立時間|建立日/i, 'createdAt'], [/更新時間|更新日/i, 'updatedAt'], [/日期|date/i, 'date'], [/時間|time/i, 'time'],
  [/搜尋|關鍵字|keyword/i, 'keyword'], [/金額|價格|price/i, 'price'], [/數量|count/i, 'count'],
  [/生日|出生/i, 'birthday'], [/備註|note/i, 'note'], [/排序|order/i, 'sortOrder'], [/發票/i, 'invoice'], [/付款/i, 'payment'],
]
function guessName(label) {
  const L = String(label || '').trim()
  if (/^[a-zA-Z0-9 _-]+$/.test(L)) return L.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '').replace(/^(.)/, (c) => c.toLowerCase())
  for (const [re, name] of NAME_MAP) if (re.test(L)) return name
  return ''
}

// 智慧預設：把常見的驗證/必填/使用情境/英文欄名先猜好，使用者少填
function enrichField(r, wfName) {
  const required = r.required === '否' && likelyRequired(r.label) ? '是' : r.required
  let validations = r.validations && r.validations.length ? r.validations : guessValidations(r.label, r.type)
  if (required === '是' && !validations.includes('必填')) validations = ['必填', ...validations]
  const usage = r.usage || (wfName ? `${pageShort(wfName)}` : '')
  const id = r.id || guessName(r.label) // 只有英文名，PM 再選模組短碼組成 module.name
  return { ...r, required, validations, usage, id }
}

// 匯入用：把 AI/外部產的 fields 正規化（補預設、_k、mapping、validations 陣列）
export function normalizeField(f) {
  return {
    _k: uid('fld'), id: '', label: '', i18n: '', type: 'text', required: '否', source: '使用者輸入',
    default: '', visibility: '恆顯示', usage: '', status: '草稿', ref: null, dictRef: null, ...f,
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

// ── 里程碑 3：即時提醒 + wireframe 綁定偵測 ──
function findComp(cs, id) {
  for (const c of cs || []) { if (c.id === id) return c; if (c.children) { const r = findComp(c.children, id); if (r) return r } }
  return null
}

// 單一欄位的提醒（白話、給 PM 看）
export function validateField(f, allFields) {
  const out = []
  if (!f.label) out.push('缺 Label（顯示字）')
  // 欄位 ID：草稿階段不催；狀態=已確認才要求敲定
  if (f.status === '已確認') {
    if (!f.id) out.push('已確認欄位需敲定 ID（選模組短碼）')
    else if (!/^[a-z][a-z0-9]*\.[A-Za-z0-9_]+$/.test(f.id)) out.push('欄位 ID 格式應為「模組.欄位」')
    else if ((allFields || []).filter((x) => x.id === f.id).length > 1) out.push('欄位 ID 重複')
  }
  if (f.type === 'enum' && !f.dictRef && !(f.validations || []).some((v) => /\[\[.+\]\]/.test(v))) out.push('enum 建議引用字典 [[..]]，不要就地列選項')
  if ((f.validations || []).some((v) => /\d\s*px|字級|font-|顏色|color|#[0-9a-fA-F]{3,6}/.test(v))) out.push('別寫視覺規格（px/顏色），那屬 wireframe')
  if (f.status === '待拍板') out.push('待拍板：記得註明決策 ID')
  return out
}

// 偵測：wireframe 有新欄位沒登錄 / 欄位來源畫面·元件已刪除
export function wireframeSync(project) {
  const wfs = project.wireframes || []
  const fields = project.fields || []
  const existById = new Set(fields.map((f) => (f.ref?.wfId || '') + '|' + f.label))
  const existByName = new Set(fields.map((f) => (f.mapping?.wf || '') + '|' + f.label))
  const byWf = []
  for (const wf of wfs) {
    const fresh = extractFields(wf).filter((g) => !existById.has(wf.id + '|' + g.label) && !existByName.has(wf.name + '|' + g.label))
    if (fresh.length) byWf.push({ wfId: wf.id, name: wf.name, labels: fresh.map((x) => x.label) })
  }
  const wfById = new Map(wfs.map((w) => [w.id, w]))
  const orphans = []
  for (const f of fields) {
    if (!f.ref?.wfId) continue
    const wf = wfById.get(f.ref.wfId)
    if (!wf) { orphans.push({ _k: f._k, reason: '來源畫面已刪除' }); continue }
    if (f.ref.compId && !findComp(wf.components, f.ref.compId)) orphans.push({ _k: f._k, reason: '來源元件已刪除/變更' })
  }
  return { byWf, orphans, newCount: byWf.reduce((n, x) => n + x.labels.length, 0) }
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
  const dict = project.dictionary || []
  if (dict.length) {
    lines.push('', '## 欄位字典（單一真相源）', '', '| ID | 值 | 說明 | 狀態 |', '|---|---|---|:-:|')
    for (const d of dict) lines.push(`| \`${esc(d.id)}\` | ${esc((d.values || []).join(' / '))} | ${esc(d.note)} | ${esc(d.status)} |`)
  }
  return lines.join('\n')
}
