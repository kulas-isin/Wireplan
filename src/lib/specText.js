// 頁面規格的「文字版」：從規格清單（spec.sections）長出一份可複製、可編輯的 Markdown，
// 段落照客戶習慣看的規格書：製作說明 → 跳轉規則 → 畫面元件清單（A–E）→ 邊界情境。
// 文字版存在 wf.specText；規格清單之後再改，會提示「比文字版新」，由人決定要不要重新產生。
import { SECTION_KINDS } from './specKinds.js'

const ELEMENT_KINDS = ['tabs', 'stats', 'searchbar', 'filter', 'toolbar', 'table', 'form', 'desc', 'actions', 'pagination']
const esc = (s) => String(s || '').replace(/\|/g, '｜').replace(/\r?\n/g, '<br>')
// 「關鍵字（商品編號／名稱）；輸入後按 Enter…」→ 元件名「關鍵字」、說明＝剩下的
function splitLabel(label) {
  const t = String(label || '').trim()
  const m = /^([^（(：:；;→]{1,24})\s*(.*)$/s.exec(t)
  if (!m) return { name: t.slice(0, 24), rest: '' }
  let rest = m[2].trim()
  if (/^[（(]/.test(rest) && /[）)]$/.test(rest) && !/[）)].+[（(]/.test(rest)) rest = rest.slice(1, -1) // 只有一組括號就拆掉
  rest = rest.replace(/^[：:；;]\s*/, '')
  return { name: m[1].trim(), rest }
}
const isJump = (label) => /→|跳至|跳轉|轉跳|另開|導向/.test(label || '')
// 說明裡有操作動詞（含「跳出標籤」＝滑入／點擊的原地提示）就放 A. 操作，否則放 C. 規則
const IS_ACTION = /點|按|輸入|勾|拖|切換|選|跳出標籤|滑入/

export function buildSpecText(project, wf) {
  const sections = wf?.spec?.sections || []
  const req = (project.requirements || []).find((r) => r.id === wf.requirementId)
  const notes = sections.filter((s) => s.kind === 'note').flatMap((s) => (s.items || []).map((i) => i.label))
  const flows = (project.unitFlows || []).filter((f) => req && (f.covers || []).includes(req.id)).map((f) => f.name)
  const L = []
  L.push(`# ${wf.code ? wf.code + ' ' : ''}${wf.name}`, '')
  L.push('## 製作說明', '')
  const intro = (wf.description || req?.description || '').trim()
  if (intro) L.push(intro, '')
  const useNotes = notes.filter((n) => !/^(空狀態|錯誤狀態|邊界)/.test(n) && n.trim() !== intro)
  for (const n of useNotes) L.push(n, '')
  if (flows.length) L.push(`相關流程：${flows.join('、')}`, '')
  if (!intro && !useNotes.length) L.push('（這頁做什麼、給誰用、進入方式）', '')

  // 跳轉規則：label 裡有「→」的按鈕／連結
  const jumps = []
  for (const s of sections) if (ELEMENT_KINDS.includes(s.kind)) for (const it of s.items || []) if (isJump(it.label)) jumps.push(it.label)
  L.push('## 跳轉規則', '', '| 元素 | 點擊行為 |', '|---|---|')
  if (jumps.length) for (const j of jumps) {
    if (j.includes('→')) { const [a, ...b] = j.split('→'); L.push(`| ${esc(a.trim())} | → ${esc(b.join('→').trim())} |`) }
    else { const { name, rest } = splitLabel(j); L.push(`| ${esc(name)} | ${esc(rest || j)} |`) }
  }
  else L.push('| （無） | |')
  L.push('')

  // 畫面元件清單
  L.push('## 畫面元件清單', '', '| # | 元件 | 說明（A. 操作／B. 預設／C. 規則／D. 狀態／E. 選項） |', '|---|---|---|')
  let n = 0
  for (const s of sections) {
    if (!ELEMENT_KINDS.includes(s.kind)) continue
    const cap = SECTION_KINDS[s.kind] || s.kind
    for (const it of s.items || []) {
      const { name, rest } = splitLabel(it.label)
      n++
      const act = rest && IS_ACTION.test(rest)
      const lines = [
        `A. 操作：${act ? esc(rest) : ''}`,
        'B. 預設：',
        `C. 規則：${rest && !act ? esc(rest) : ''}`,
        'D. 狀態：',
        'E. 選項：',
      ]
      L.push(`| ${n} | ${esc(name)}<br><small>${cap}</small> | ${lines.join('<br>')} |`)
    }
  }
  if (!n) L.push('| 1 | （尚無元件） | A. 操作：<br>B. 預設：<br>C. 規則：<br>D. 狀態：<br>E. 選項： |')
  L.push('')

  // 邊界情境：空狀態、錯誤狀態、邊界 開頭的備註
  L.push('## 邊界情境', '')
  const edges = notes.filter((x) => /^(空狀態|錯誤狀態|邊界)/.test(x))
  if (edges.length) for (const e of edges) L.push(`- ${e}`)
  else L.push('- （無資料／失敗／權限不足時怎麼呈現）')
  L.push('')
  return L.join('\n')
}
