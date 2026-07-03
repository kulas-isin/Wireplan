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
  return out.filter((r) => { const k = r.label; if (seen.has(k)) return false; seen.add(k); return true })
}

export const emptyField = () => row({})

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
