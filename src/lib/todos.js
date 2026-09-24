// 專案待辦。刻意做得很薄：一行字是必填，負責與期限都選填，
// 因為手機上多一個必填欄位就少一次被記下來的機會。
import { uid } from './id.js'

export const OWNERS = [
  { key: 'us', label: '我方' },
  { key: 'client', label: '客戶' },
]
export const ownerLabel = (k) => OWNERS.find((o) => o.key === k)?.label || ''

export const normalizeTodo = (t) => ({
  id: t.id || uid('td'),
  text: String(t.text || '').trim(),
  done: !!t.done,
  owner: t.owner === 'us' || t.owner === 'client' ? t.owner : null,
  due: String(t.due || '').trim(),   // 自由文字：「第 2 場會議前」「10 月內」比日期好用
  at: t.at || Date.now(),
  doneAt: t.doneAt || null,
})

export const listTodos = (project) => (project?.todos || []).map(normalizeTodo)

// 未完成在前；同組內新的在前。已完成沉底、依完成時間新到舊
export function sortTodos(todos) {
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.done) return (b.doneAt || 0) - (a.doneAt || 0)
    return (b.at || 0) - (a.at || 0)
  })
}

export const openCount = (project) => listTodos(project).filter((t) => !t.done).length

// 貼多行文字 → 多筆待辦。一行一條，格式很鬆：
//   評估 E1 工時 | 我方 | 第 2 場會議
//   跟 Sarah 要匯出檔｜客戶
//   - 寄預讀資料          ← 開頭的清單符號、勾選框會剝掉
// 用「|」或「｜」分段；「我方／客戶」那段在哪個位置都認得，剩下的當期限。
const OWNER_WORDS = { 我方: 'us', 我們: 'us', 哲煜: 'us', us: 'us', 客戶: 'client', 貴司: 'client', 鼎笠安: 'client', client: 'client' }
const LIST_MARK = /^\s*(?:[-*•‧●▪]|\d+[.)、]|[☐☑☒□■]|\[[ xX]\])\s*/

export function parseTodoLines(raw) {
  const out = []
  for (const line of String(raw || '').split(/\r?\n/)) {
    const cleaned = line.replace(LIST_MARK, '').trim()
    if (!cleaned) continue
    const parts = cleaned.split(/\s*[|｜]\s*/).map((s) => s.trim()).filter(Boolean)
    const text = parts.shift()
    if (!text) continue
    let owner = null
    const rest = []
    for (const p of parts) {
      const k = OWNER_WORDS[p] || OWNER_WORDS[p.toLowerCase?.()]
      if (k && !owner) owner = k
      else rest.push(p)
    }
    out.push(normalizeTodo({ text, owner, due: rest.join('、') }))
  }
  return out
}
