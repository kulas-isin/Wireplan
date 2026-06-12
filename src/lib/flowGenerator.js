// 流程設計：以「節點清單」描述流程圖，支援判斷(是/否)與分支。
// node = {
//   id, type: 'start'|'end'|'screen'|'decision',
//   label, category?, requirementId?,
//   next?: nodeId|null,                      // start / screen 用
//   branches?: [{ id, label, target }]       // decision 用
// }
import { uid } from './id.js'
import { categoryMeta } from './categories.js'

export function newNode(type = 'screen', extra = {}) {
  const base = { id: uid('node'), type, label: type === 'decision' ? '判斷？' : '新節點', ...extra }
  if (type === 'decision') {
    base.branches = extra.branches || [
      { id: uid('br'), label: '是', target: null },
      { id: uid('br'), label: '否', target: null },
    ]
  } else if (type !== 'end') {
    base.next = extra.next ?? null
  }
  return base
}

// 依需求清單產生預設「直線」流程：開始 → 各畫面 → 結束
export function generateFlow(project) {
  const reqs = [...(project.requirements || [])].sort((a, b) => {
    const order = { auth: 0, dashboard: 1 }
    return (order[a.category] ?? 5) - (order[b.category] ?? 5)
  })

  const start = { id: uid('node'), type: 'start', label: '開始', next: null }
  const screens = reqs.map((r) => ({
    id: uid('node'),
    type: 'screen',
    label: r.name || categoryMeta(r.category).label,
    category: r.category,
    requirementId: r.id,
    next: null,
  }))
  const end = { id: uid('node'), type: 'end', label: '結束' }

  const chain = [start, ...screens]
  for (let i = 0; i < chain.length; i++) {
    chain[i].next = i + 1 < chain.length ? chain[i + 1].id : end.id
  }
  return { nodes: [start, ...screens, end] }
}

// 去掉頁名前綴編號與括號補充，取出「核心頁名」用於比對
function coreName(label) {
  return String(label || '')
    .replace(/^[wWＷ]?\s*[.\d]+[a-zA-Z]?\s*/, '') // 去 W.4.8a / 1.2 之類前綴
    .replace(/[（(【\[].*?[）)】\]]/g, '')          // 去括號補充
    .replace(/\s+/g, '')
    .trim()
}

// 從畫面元件樹收集「會導向其他頁」的動作文字（不含全域選單 nav/sidenav，避免全連在一起）
function collectActionTexts(components, out = []) {
  for (const c of components || []) {
    if (!c || typeof c !== 'object') continue
    if (c.type === 'buttonRow') out.push(...(c.buttons || []))
    else if (c.type === 'link') out.push(c.label)
    else if (c.type === 'breadcrumb') out.push(...(c.items || []))
    else if (c.type === 'tabs') out.push(...(c.tabs || []))
    else if (c.type === 'dropdown') out.push(...(c.items || []))
    else if (c.type === 'pageHeader') out.push(c.primaryText, c.secondaryText, ...(c.actions || []))
    if (Array.isArray(c.children)) collectActionTexts(c.children, out)
  }
  return out.filter(Boolean)
}

// 在候選頁中找出與動作文字最匹配的目標（雙向包含、取最長命中）
function matchTarget(text, targets, selfId) {
  const t = coreName(text)
  if (t.length < 2) return null
  let best = null
  for (const tg of targets) {
    if (tg.node.id === selfId || tg.key.length < 2) continue
    if (t.includes(tg.key) || tg.key.includes(t)) {
      if (!best || tg.key.length > best.key.length) best = tg
    }
  }
  return best ? best.node : null
}

// 依「畫面清單」產生流程：每張 wireframe 一個節點，依序串接，
// 再從畫面內的按鈕/連結/頁籤文字推斷額外跳轉（extraEdges，虛線）。
export function generateFlowFromWireframes(project) {
  const wfs = project.wireframes || []
  if (!wfs.length) return generateFlow(project)

  const start = { id: uid('node'), type: 'start', label: '開始', next: null }
  const screens = wfs.map((w) => ({
    id: uid('node'), type: 'screen', label: w.name || '畫面', wireframeId: w.id, next: null,
  }))
  const end = { id: uid('node'), type: 'end', label: '結束' }

  // 入口：優先比對 登入 / 入口 / 首頁 / home，否則第一張
  const entryIdx = Math.max(0, screens.findIndex((s) => /登入|入口|首頁|home/i.test(s.label)))
  const ordered = [screens[entryIdx], ...screens.filter((_, i) => i !== entryIdx)]
  const chain = [start, ...ordered]
  for (let i = 0; i < chain.length; i++) chain[i].next = i + 1 < chain.length ? chain[i + 1].id : end.id

  // 推斷跳轉
  const targets = screens.map((s) => ({ node: s, key: coreName(s.label) }))
  const extraEdges = []
  const seen = new Set()
  wfs.forEach((w, i) => {
    const from = screens[i]
    for (const text of collectActionTexts(w.components)) {
      const tgt = matchTarget(text, targets, from.id)
      if (!tgt) continue
      const k = from.id + '>' + tgt.id
      if (seen.has(k)) continue
      seen.add(k)
      extraEdges.push({ from: from.id, to: tgt.id, label: coreName(text).slice(0, 8) })
    }
  })

  return { nodes: [start, ...screens, end], extraEdges }
}

// 確保流程為新版格式（有 nodes）；舊資料或空的就重新產生
export function ensureFlow(project) {
  const f = project.flow
  if (f && Array.isArray(f.nodes) && f.nodes.length) return f
  return generateFlow(project)
}

function esc(s) {
  return String(s || '').replace(/"/g, "'").replace(/\n/g, ' ')
}

// 轉成 Mermaid flowchart 文字
export function flowToMermaid(flow) {
  const nodes = flow.nodes || []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const lines = ['flowchart TD']

  // 節點宣告
  for (const n of nodes) {
    const t = esc(n.label)
    if (n.type === 'start' || n.type === 'end') lines.push(`  ${n.id}(["${t}"])`)
    else if (n.type === 'decision') lines.push(`  ${n.id}{"${t}"}`)
    else lines.push(`  ${n.id}["${t}"]`)
  }

  // 連線
  for (const n of nodes) {
    if (n.type === 'decision') {
      for (const b of n.branches || []) {
        if (b.target && byId.has(b.target)) lines.push(`  ${n.id} -->|"${esc(b.label)}"| ${b.target}`)
      }
    } else if (n.next && byId.has(n.next)) {
      lines.push(`  ${n.id} --> ${n.next}`)
    }
  }

  // 推斷出的跳轉（虛線，附動作標籤）
  for (const e of flow.extraEdges || []) {
    if (byId.has(e.from) && byId.has(e.to)) lines.push(`  ${e.from} -.->|"${esc(e.label)}"| ${e.to}`)
  }

  // 依分類上色
  for (const n of nodes) {
    if (n.type === 'screen' && n.category) {
      const c = categoryMeta(n.category).color
      lines.push(`  style ${n.id} fill:${c}22,stroke:${c},color:#14271c`)
    }
  }
  return lines.join('\n')
}

// 轉成 Markdown 文件
export function flowToMarkdown(project, flow) {
  const nodes = flow.nodes || []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const label = (id) => (byId.get(id) ? byId.get(id).label : '—')
  const lines = []
  lines.push(`# ${project.name || '專案'} — 流程設計文件`)
  lines.push('')
  lines.push('## 節點與流向')
  lines.push('')
  for (const n of nodes) {
    if (n.type === 'start') lines.push(`- 🟢 **開始** → ${label(n.next)}`)
    else if (n.type === 'end') lines.push(`- 🔴 **結束**`)
    else if (n.type === 'decision') {
      lines.push(`- 🔶 **${n.label}**（判斷）`)
      for (const b of n.branches || []) lines.push(`  - ${b.label} → ${label(b.target)}`)
    } else {
      const cat = n.category ? `（${categoryMeta(n.category).label}）` : ''
      lines.push(`- ◻️ **${n.label}**${cat} → ${label(n.next)}`)
    }
  }
  lines.push('')
  lines.push('## 流程圖（Mermaid）')
  lines.push('')
  lines.push('```mermaid')
  lines.push(flowToMermaid(flow))
  lines.push('```')
  return lines.join('\n')
}
