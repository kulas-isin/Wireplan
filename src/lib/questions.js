// 待釐清問題：掛在單元（與流程圖）上，答覆每改一次加一版，不覆蓋舊的。
// project.questions = [{ id, code:'S5', unit:'商品管理', flowId:'uf_…'|null, title, detail,
//                        basis, owner, createdAt,
//                        versions:[{ v, at, source:'第 2 場', status, answer }] }]
// 目前狀態看最新一版；還沒答覆過的問題 versions 是空陣列（狀態＝待釐清）。
import { uid } from './id.js'

export const Q_STATUS = [
  ['open', '待釐清'],
  ['answered', '已答覆'],   // 有結論但還要我方消化（改圖、改頁）
  ['closed', '已結案'],     // 結論已反映，不用再看
  ['dropped', '不處理'],    // 不問了／併到別題
]
export const Q_BASIS = [
  ['quote', '報價'],
  ['api', 'API'],
  ['current', '現行'],
  ['guess', '推測'],
]
export const Q_OWNER = [
  ['client', '問客戶'],
  ['us', '我方決定'],
  ['test', '待實測'],
]
const label = (list, k) => (list.find((x) => x[0] === k) || [])[1] || ''
export const statusLabel = (k) => label(Q_STATUS, k)
export const basisLabel = (k) => label(Q_BASIS, k)
export const ownerLabel = (k) => label(Q_OWNER, k)

export const latest = (q) => (q?.versions || [])[(q?.versions || []).length - 1] || null
export const statusOf = (q) => latest(q)?.status || 'open'
export const isOpen = (q) => statusOf(q) === 'open'

const pick = (list, k) => (list.some((x) => x[0] === k) ? k : '')

function normVersion(v, i) {
  return {
    v: v.v || i + 1,
    at: v.at || Date.now(),
    source: String(v.source || ''),
    status: pick(Q_STATUS, v.status) || 'answered',
    answer: String(v.answer ?? v.text ?? ''),
  }
}

export function normalizeQuestion(q, list = []) {
  const versions = Array.isArray(q.versions) ? q.versions.map(normVersion) : []
  // 匯入檔可以直接寫 answer／status（沒有 versions）→ 當成第一版
  if (!versions.length && (q.answer || (q.status && q.status !== 'open'))) {
    versions.push(normVersion({ answer: q.answer, status: q.status || 'answered', source: q.source, at: q.answeredAt }, 0))
  }
  return {
    id: q.id || uid('qs'),
    code: String(q.code || '').trim() || nextCode(list),
    unit: String(q.unit || '').trim(),
    flowId: q.flowId || null,
    title: String(q.title || '').trim() || '未命名問題',
    detail: String(q.detail || ''),
    basis: pick(Q_BASIS, q.basis),
    owner: pick(Q_OWNER, q.owner),
    createdAt: q.createdAt || Date.now(),
    versions,
  }
}

export function nextCode(list = []) {
  const n = Math.max(0, ...list.map((q) => (/^Q(\d+)$/i.exec(q.code || '') || [])[1] | 0))
  return 'Q' + (n + 1)
}

// 匯入：同 id 或同 code 視為同一題 → 題目欄位用匯入檔的，答覆版本合併（同時間同內容去重、依時間排）；
// 其餘附加。本機已答的版本不會被匯入檔蓋掉。
export function mergeQuestions(existing = [], incoming = []) {
  const out = [...existing]
  let added = 0, updated = 0
  for (const raw of incoming) {
    if (!raw || typeof raw !== 'object') continue
    const q = normalizeQuestion(raw, out)
    const i = out.findIndex((x) => x.id === q.id || (q.code && x.code === q.code))
    if (i < 0) { out.push(q); added++; continue }
    const old = out[i]
    const seen = new Set(old.versions.map((v) => `${v.at}|${v.answer}`))
    const versions = [...old.versions, ...q.versions.filter((v) => !seen.has(`${v.at}|${v.answer}`))]
      .sort((a, b) => a.at - b.at).map((v, k) => ({ ...v, v: k + 1 }))
    out[i] = { ...old, ...q, id: old.id, createdAt: old.createdAt, versions }
    updated++
  }
  return { list: out, added, updated }
}

// 依單元、流程分組（給「哪個流程還有問題」用）
export function groupByFlow(questions, flows) {
  const name = Object.fromEntries((flows || []).map((f) => [f.id, f.name]))
  const groups = new Map()
  for (const q of questions) {
    const key = q.flowId && name[q.flowId] ? q.flowId : ''
    if (!groups.has(key)) groups.set(key, { flowId: key, name: key ? name[key] : '未掛流程', items: [] })
    groups.get(key).items.push(q)
  }
  return [...groups.values()].sort((a, b) => (a.flowId ? 0 : 1) - (b.flowId ? 0 : 1))
}

const codeNum = (c) => { const m = /(\d+)/.exec(c || ''); return m ? +m[1] : 1e9 }
export const sortQuestions = (list) => [...list].sort((a, b) =>
  (isOpen(a) ? 0 : 1) - (isOpen(b) ? 0 : 1) || codeNum(a.code) - codeNum(b.code) || a.createdAt - b.createdAt)

const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '')

export function questionsMarkdown(project, list) {
  const flows = project.unitFlows || []
  const fname = Object.fromEntries(flows.map((f) => [f.id, f.name]))
  const units = [...new Set(list.map((q) => q.unit || ''))]
  const lines = [`# ${project.name || '專案'}｜待釐清問題`, '', `共 ${list.length} 題，待釐清 ${list.filter(isOpen).length} 題。`, '']
  for (const u of units) {
    lines.push(`## ${u || '未分單元'}`, '')
    for (const q of sortQuestions(list.filter((x) => (x.unit || '') === u))) {
      const cur = latest(q)
      const tags = [statusLabel(statusOf(q)), q.flowId && fname[q.flowId], basisLabel(q.basis), ownerLabel(q.owner)].filter(Boolean)
      lines.push(`### ${q.code}. ${q.title}`, '', `- ${tags.join('・')}`)
      if (q.detail) lines.push(`- 說明：${q.detail.replace(/\n+/g, ' ')}`)
      if (cur) lines.push(`- 結論（v${cur.v}，${fmtDate(cur.at)}${cur.source ? `，${cur.source}` : ''}）：${cur.answer.replace(/\n+/g, ' ')}`)
      for (const v of [...q.versions].reverse().slice(1)) lines.push(`  - v${v.v}（${fmtDate(v.at)}${v.source ? `，${v.source}` : ''}）${statusLabel(v.status)}：${v.answer.replace(/\n+/g, ' ')}`)
      lines.push('')
    }
  }
  return lines.join('\n')
}
