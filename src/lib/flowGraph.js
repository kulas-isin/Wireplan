// 流程圖的「圖」資料模型（給互動畫布用）：nodes 帶座標、edges 為一等公民。
// 與舊版 { nodes:[{next/branches}], extraEdges } 相容：toGraph 會自動轉換 + 排版。
import { uid } from './id.js'

const mapType = (t) => (t === 'screen' ? 'page' : t) // start | end | decision | page

// 簡易分層排版（從起點 BFS 取深度，同層水平展開）；使用者之後可自由拖。
export function autoLayout(nodes, edges) {
  const adj = new Map(nodes.map((n) => [n.id, []]))
  const indeg = new Map(nodes.map((n) => [n.id, 0]))
  for (const e of edges) {
    if (adj.has(e.source)) adj.get(e.source).push(e.target)
    if (indeg.has(e.target)) indeg.set(e.target, indeg.get(e.target) + 1)
  }
  const roots = nodes.filter((n) => n.type === 'start' || indeg.get(n.id) === 0).map((n) => n.id)
  const depth = new Map()
  const q = [...new Set(roots.length ? roots : nodes.slice(0, 1).map((n) => n.id))].filter(Boolean)
  q.forEach((id) => depth.set(id, 0))
  while (q.length) {
    const id = q.shift()
    for (const t of adj.get(id) || []) {
      if (!depth.has(t)) { depth.set(t, depth.get(id) + 1); q.push(t) } // BFS 訪一次，含迴圈也會終止
    }
  }
  let maxd = 0
  depth.forEach((v) => { maxd = Math.max(maxd, v) })
  for (const n of nodes) if (!depth.has(n.id)) { maxd += 1; depth.set(n.id, maxd) } // 落單節點排最後
  const byDepth = new Map()
  for (const n of nodes) {
    const d = depth.get(n.id)
    if (!byDepth.has(d)) byDepth.set(d, [])
    byDepth.get(d).push(n)
  }
  const out = nodes.map((n) => ({ ...n }))
  const idx = new Map(out.map((n) => [n.id, n]))
  for (const [d, list] of byDepth) {
    list.forEach((n, i) => {
      const node = idx.get(n.id)
      node.x = i * 240 - (list.length - 1) * 120
      node.y = d * 140
    })
  }
  return out
}

// flow → 圖（neutral 結構）。優先用 flow.graph；否則由舊格式轉換並排版。
export function toGraph(flow) {
  if (flow?.graph?.nodes?.length) {
    return {
      nodes: flow.graph.nodes.map((n) => ({ ...n })),
      edges: (flow.graph.edges || []).map((e) => ({ ...e })),
    }
  }
  const lnodes = flow?.nodes || []
  const nodes = lnodes.map((n) => ({
    id: n.id, type: mapType(n.type), label: n.label,
    page: n.page, wireframeId: n.wireframeId, category: n.category, role: n.role,
    x: n.x, y: n.y,
  }))
  const edges = []
  for (const n of lnodes) {
    if (n.type === 'decision') {
      for (const b of n.branches || []) if (b.target) edges.push({ id: uid('e'), source: n.id, target: b.target, label: b.label })
    } else if (n.next) {
      edges.push({ id: uid('e'), source: n.id, target: n.next })
    }
  }
  for (const e of flow?.extraEdges || []) edges.push({ id: uid('e'), source: e.from, target: e.to, label: e.label })
  const needLayout = nodes.some((n) => n.x == null || n.y == null)
  return { nodes: needLayout ? autoLayout(nodes, edges) : nodes, edges }
}

function esc(s) { return String(s || '').replace(/"/g, "'").replace(/\n/g, ' ') }

// 圖 → Mermaid（匯出給文件用）
export function graphToMermaid(graph) {
  const nodes = graph.nodes || []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const lines = ['flowchart TD']
  for (const n of nodes) {
    const t = esc(n.label)
    if (n.type === 'start' || n.type === 'end') lines.push(`  ${n.id}(["${t}"])`)
    else if (n.type === 'decision') lines.push(`  ${n.id}{"${t}"}`)
    else lines.push(`  ${n.id}["${t}"]`)
  }
  for (const e of graph.edges || []) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue
    lines.push(e.label ? `  ${e.source} -->|"${esc(e.label)}"| ${e.target}` : `  ${e.source} --> ${e.target}`)
  }
  return lines.join('\n')
}
