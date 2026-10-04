// 頁面規格的文字版與 Excel 都從這裡長：規格清單（spec.sections）是唯一主檔。
// 每個條目除了 label，可帶 det（細節）：A 操作／B 預設／C 規則／D 狀態／E 選項／ERP 來源／Shopline 欄位／方向／備註。
// buildSpecData 把一頁整理成結構（給 md、xlsx 共用）；buildSpecText 轉成 Markdown。
import { SECTION_KINDS } from './specKinds.js'

export const DET_FIELDS = [
  ['op', 'A. 操作', '點、滑入、輸入後發生什麼'],
  ['def', 'B. 預設', '預設值、預設狀態'],
  ['rule', 'C. 規則', '限制、計算、權限'],
  ['state', 'D. 狀態', '停用、隱藏、載入中等各狀態'],
  ['opt', 'E. 選項', 'enum 值、下拉內容'],
  ['erp', 'ERP 來源', '哪個主檔、怎麼算'],
  ['sl', 'Shopline 欄位', 'API 欄位名'],
  ['dir', '方向', 'ERP→SL、SL→ERP、雙向、僅 ERP'],
  ['memo', '備註', '給工程師的提醒'],
]
export const DIR_OPTIONS = ['ERP→SL', 'SL→ERP', '雙向', '僅 ERP', '待定']
export const hasDet = (it) => !!it?.det && Object.values(it.det).some((v) => String(v || '').trim())
// 依據：這條規格從哪來。報價單原文／客戶確認（會議決議、補充）／現行系統／推測（我們補的，客戶還沒看過）
export const BASIS = [
  ['quote', '約', '報價單', '報價單原文寫的'],
  ['client', '確', '客戶確認', '會議決議或客戶補充'],
  ['current', '現', '現行系統', '照客戶現行系統的做法'],
  ['infer', '推', '推測', '我們補的合理規則，客戶尚未確認'],
]
export const BASIS_LABEL = Object.fromEntries(BASIS.map(([k, , l]) => [k, l]))
export const BASIS_SHORT = Object.fromEntries(BASIS.map(([k, s]) => [k, s]))
export const basisOf = (it) => it?.basis || ''
const basisTag = (it) => { const b = basisOf(it); return b && b !== 'quote' ? `〔${BASIS_LABEL[b]}〕` : '' }

const ELEMENT_KINDS = ['tabs', 'stats', 'searchbar', 'filter', 'toolbar', 'table', 'form', 'desc', 'actions', 'pagination']
const DATA_KINDS = ['table', 'form', 'stats', 'desc']
const IS_ACTION_COL = /^(操作|動作|同步|複製|刪除|編輯)$/
const IS_ACTION = /點|按|輸入|勾|拖|切換|選|跳出標籤|滑入/
const esc = (s) => String(s || '').replace(/\|/g, '｜').replace(/\r?\n/g, '<br>')
// 「關鍵字（商品編號／名稱）；輸入後按 Enter…」→ 元件名「關鍵字」、說明＝剩下的
export function splitLabel(label) {
  const t = String(label || '').trim()
  const m = /^([^（(：:；;→]{1,24})\s*(.*)$/s.exec(t)
  if (!m) return { name: t.slice(0, 24), rest: '' }
  let rest = m[2].trim()
  if (/^[（(]/.test(rest) && /[）)]$/.test(rest) && !/[）)].+[（(]/.test(rest)) rest = rest.slice(1, -1)
  rest = rest.replace(/^[：:；;]\s*/, '')
  return { name: m[1].trim(), rest }
}
const isJump = (label) => /→|跳至|跳轉|轉跳|另開|導向/.test(label || '')
const isTag = (label) => /^[（(][^）)]{1,8}[）)]/.test(String(label || '').trim()) // （版面）（共用機制）…
const g = (it, k) => String(it?.det?.[k] || '').trim()

export function buildSpecData(project, wf) {
  const sections = wf?.spec?.sections || []
  const req = (project.requirements || []).find((r) => r.id === wf.requirementId)
  const flows = (project.unitFlows || []).filter((f) => req && (f.covers || []).includes(req.id)).map((f) => f.name)
  const intro = (wf.description || req?.description || '').trim()
  // 備註區依標題分組：用途／規則／進入方式…各自一組；空狀態、錯誤、邊界 → 邊界情境；驗收 → 驗收條件
  const groups = [] // [{ title, items }]
  const edges = []
  const accept = []
  for (const s of sections) {
    if (s.kind !== 'note') continue
    const title = (s.title || '').trim()
    const items = (s.items || []).filter((i) => i.label.trim() && i.label.trim() !== intro).map((i) => ({ label: i.label, basis: basisOf(i) }))
    if (!items.length) continue
    if (/空狀態|錯誤|邊界/.test(title)) { edges.push(...items); continue }
    if (/驗收/.test(title)) { accept.push(...items); continue }
    const g = { title: title || '說明', items: [] }
    for (const n of items) (/^(空狀態|錯誤狀態|邊界)/.test(n.label) ? edges : g.items).push(n)
    if (g.items.length) groups.push(g)
  }
  const layoutNotes = []
  for (const s of sections) if (ELEMENT_KINDS.includes(s.kind)) for (const it of s.items || []) if (isTag(it.label)) layoutNotes.push({ label: `${SECTION_KINDS[s.kind] || s.kind}${it.label}`, basis: basisOf(it) })
  if (layoutNotes.length) groups.push({ title: '版面', items: layoutNotes })
  const notes = groups.flatMap((g) => g.items.map((i) => i.label))
  const jumps = []
  for (const s of sections) if (ELEMENT_KINDS.includes(s.kind)) for (const it of s.items || []) {
    if (!isJump(it.label) || isTag(it.label)) continue
    if (it.label.includes('→')) { const [a, ...b] = it.label.split('→'); jumps.push([a.trim(), '→ ' + b.join('→').trim(), basisOf(it)]) }
    else { const { name, rest } = splitLabel(it.label); jumps.push([name, rest || it.label, basisOf(it)]) }
  }
  const elements = []
  const sources = []
  for (const s of sections) {
    if (!ELEMENT_KINDS.includes(s.kind)) continue
    const kind = SECTION_KINDS[s.kind] || s.kind
    for (const it of s.items || []) {
      if (isTag(it.label)) continue
      const { name, rest } = splitLabel(it.label)
      const act = rest && IS_ACTION.test(rest)
      elements.push({
        n: elements.length + 1, name, kind, label: it.label, basis: basisOf(it),
        op: g(it, 'op') || (act ? rest : ''), def: g(it, 'def'), rule: g(it, 'rule') || (!act ? rest : ''), state: g(it, 'state'), opt: g(it, 'opt'),
      })
      if (DATA_KINDS.includes(s.kind) && name && !IS_ACTION_COL.test(name)) sources.push({ name, erp: g(it, 'erp'), sl: g(it, 'sl'), dir: g(it, 'dir'), memo: g(it, 'memo'), basis: basisOf(it) })
    }
  }
  return { code: wf.code || '', name: wf.name || '', unit: wf.unit || req?.unit || '', intro, notes, groups, accept, flows, jumps, elements, sources, edges }
}

export function buildSpecText(project, wf, { withSource = true } = {}) {
  const d = buildSpecData(project, wf)
  const L = []
  L.push(`# ${d.code ? d.code + ' ' : ''}${d.name}`, '')
  L.push('## 製作說明', '')
  if (d.intro) L.push(d.intro, '')
  const bl = (b) => BASIS_LABEL[b] || ''
  const bullet = (i) => `- ${i.basis && i.basis !== 'quote' ? `〔${bl(i.basis)}〕` : ''}${i.label}`
  for (const g of d.groups) {
    L.push(`### ${g.title}`, '')
    for (const n of g.items) L.push(bullet(n))
    L.push('')
  }
  if (d.flows.length) L.push(`相關流程：${d.flows.join('、')}`, '')
  if (!d.intro && !d.groups.length) L.push('（這頁做什麼、給誰用、進入方式）', '')
  L.push('依據標記：未標＝報價單原文；〔客戶確認〕＝會議決議或客戶補充；〔現行系統〕＝照現行做法；〔推測〕＝我們補的合理規則，客戶尚未確認。', '')

  L.push('## 跳轉規則', '', '| 元素 | 點擊行為 | 依據 |', '|---|---|---|')
  if (d.jumps.length) for (const [a, b, bs] of d.jumps) L.push(`| ${esc(a)} | ${esc(b)} | ${bl(bs)} |`)
  else L.push('| （無） | | |')
  L.push('')

  L.push('## 畫面元件清單', '', '| # | 元件 | 依據 | 說明（A. 操作／B. 預設／C. 規則／D. 狀態／E. 選項） |', '|---|---|---|---|')
  for (const e of d.elements) {
    const lines = [`A. 操作：${esc(e.op)}`, `B. 預設：${esc(e.def)}`, `C. 規則：${esc(e.rule)}`, `D. 狀態：${esc(e.state)}`, `E. 選項：${esc(e.opt)}`]
    L.push(`| ${e.n} | ${esc(e.name)}<br><small>${e.kind}</small> | ${bl(e.basis)} | ${lines.join('<br>')} |`)
  }
  if (!d.elements.length) L.push('| 1 | （尚無元件） | | A. 操作：<br>B. 預設：<br>C. 規則：<br>D. 狀態：<br>E. 選項： |')
  L.push('')

  if (withSource) {
    L.push('## 資料來源', '', '方向：ERP→SL（推送 Shopline）、SL→ERP（從 Shopline 回寫）、雙向、僅 ERP（不同步）', '')
    L.push('| 欄位 | ERP 來源 | Shopline 欄位 | 方向 | 備註 | 依據 |', '|---|---|---|---|---|---|')
    for (const s of d.sources) L.push(`| ${esc(s.name)} | ${esc(s.erp)} | ${esc(s.sl)} | ${esc(s.dir)} | ${esc(s.memo)} | ${bl(s.basis)} |`)
    if (!d.sources.length) L.push('| （無資料欄位） | | | | | |')
    L.push('')
  }

  L.push('## 邊界情境', '')
  if (d.edges.length) for (const e of d.edges) L.push(bullet(e))
  else L.push('- （無資料／失敗／權限不足時怎麼呈現）')
  L.push('')
  if (d.accept.length) {
    L.push('## 驗收條件', '')
    for (const a of d.accept) L.push(bullet(a))
    L.push('')
  }
  return L.join('\n')
}
