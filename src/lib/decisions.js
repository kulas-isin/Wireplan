// 決議：跟報價原文對照後「改成怎樣」的正式記錄，掛在報價條目與頁面上，每筆有版本。
// project.decisions = [{ id, code:'D1', title, kind, quoteIds:[], pages:['P3-01'], createdAt,
//                        versions:[{ v, at, source:'第 2 場', text }] }]
// 用途：會議記錄的「本場決議」、v2 需求文件的異動清單、需評估項目的結算表，都從這裡長。
import { uid } from './id.js'

export const DECISION_KINDS = [
  ['present', '呈現方式', '版面或互動的調整，不影響範圍與工時'],
  ['clarify', '範圍內澄清', '報價原文有寫但不夠清楚，補定義'],
  ['assess', '需評估', '報價外或超出原文，要另外估工時或報價'],
  ['drop', '客戶放棄', '原文有寫但客戶決定不做'],
]
export const kindLabel = (k) => (DECISION_KINDS.find((x) => x[0] === k) || [])[1] || k || ''

export const latest = (d) => (d?.versions || [])[d.versions.length - 1] || { text: '', at: 0, source: '' }

export function normalizeDecision(d, list = []) {
  const versions = Array.isArray(d.versions) && d.versions.length
    ? d.versions.map((v, i) => ({ v: v.v || i + 1, at: v.at || Date.now(), source: v.source || '', text: String(v.text || '') }))
    : [{ v: 1, at: d.at || Date.now(), source: d.source || '', text: String(d.text || '') }]
  return {
    id: d.id || uid('dec'),
    code: d.code || nextCode(list),
    title: String(d.title || '').trim() || '未命名決議',
    kind: d.kind || 'present',
    quoteIds: Array.isArray(d.quoteIds) ? d.quoteIds : [],
    pages: Array.isArray(d.pages) ? d.pages : [],
    createdAt: d.createdAt || versions[0].at,
    versions,
  }
}

export function nextCode(list = []) {
  const n = Math.max(0, ...list.map((d) => Number(String(d.code || '').replace(/^D/i, '')) || 0))
  return 'D' + (n + 1)
}

// 同 code 取代（匯入時帶的比較新），其餘附加
export function mergeDecisions(existing = [], incoming = []) {
  const out = [...existing]
  for (const raw of incoming) {
    const d = normalizeDecision(raw, out)
    const i = out.findIndex((x) => x.code === d.code || x.id === d.id)
    if (i >= 0) out[i] = { ...out[i], ...d, id: out[i].id }
    else out.push(d)
  }
  return out
}

export const decisionsForQuote = (list, quoteId) => (list || []).filter((d) => (d.quoteIds || []).includes(quoteId))
export const decisionsForPage = (list, code) => code ? (list || []).filter((d) => (d.pages || []).includes(code)) : []

const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '')

// 匯出成 md：給會議記錄、v2 文件用。每筆列最新版，底下附歷史版本。
export function decisionsMarkdown(project) {
  const list = [...(project.decisions || [])].sort((a, b) => (Number(String(a.code).slice(1)) || 0) - (Number(String(b.code).slice(1)) || 0))
  const q = Object.fromEntries((project.quote?.items || []).map((it) => [it.id, it]))
  const lines = [`# ${project.name || '專案'}｜決議清單`, '', `共 ${list.length} 筆。類型：呈現方式（不影響範圍）／範圍內澄清／需評估／客戶放棄。`, '']
  for (const d of list) {
    const cur = latest(d)
    lines.push(`## ${d.code}. ${d.title}`, '')
    lines.push(`- 類型：${kindLabel(d.kind)}`)
    if (d.pages?.length) lines.push(`- 影響頁面：${d.pages.join('、')}`)
    if (d.quoteIds?.length) lines.push(`- 報價條目：${d.quoteIds.map((id) => q[id]?.section ? `${q[id].section}（${id}）` : id).join('、')}`)
    lines.push(`- 最新版：v${cur.v}，${fmtDate(cur.at)}${cur.source ? `，${cur.source}` : ''}`, '')
    lines.push(cur.text, '')
    if (d.versions.length > 1) {
      lines.push('<details><summary>歷史版本</summary>', '')
      for (const v of [...d.versions].reverse().slice(1)) lines.push(`- v${v.v}（${fmtDate(v.at)}${v.source ? `，${v.source}` : ''}）：${v.text}`)
      lines.push('', '</details>', '')
    }
  }
  return lines.join('\n')
}
