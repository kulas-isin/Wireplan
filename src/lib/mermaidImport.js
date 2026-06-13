// Mermaid flowchart → 我們的流程圖模型。
// 支援：flowchart/graph LR|TD、節點形狀（[] {} ([]) [[]] (()) ）、
// 連線 --> / -->|label| / -.label.-> / -.-> / ==>、鏈式 A-->B-->C、
// classDef + class 上色、%% 註解、subgraph/end（忽略框、保留節點）、<br/> 換行。
// 一份 markdown 可含多個 ```mermaid``` 區塊 → 每塊一條流程（名稱取前面的標題）。

const ID = '[A-Za-z0-9_]+'
const SHAPE = '\\(\\[[^\\]]*\\]\\)|\\[\\[[^\\]]*\\]\\]|\\[[^\\]]*\\]|\\{[^}]*\\}|\\(\\([^)]*\\)\\)|\\([^)]*\\)|>[^\\]]*\\]'
const NODE_RE = new RegExp('^(' + ID + ')(' + SHAPE + ')?')
const EDGE_RE = /^\s*(?:-->|---|==>|-\.->)\s*(?:\|([^|]*)\|)?\s*|^\s*-\.\s*([^.]*?)\s*\.->\s*/

const clean = (s) => String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim()

// 由形狀判斷節點型別
function shapeType(shape) {
  if (!shape) return null
  if (shape.startsWith('([') || shape.startsWith('((')) return 'terminal'
  if (shape.startsWith('{')) return 'decision'
  if (shape.startsWith('[[')) return 'process'
  return 'process' // [..] / (..) / >..] 一律當處理節點
}
function shapeText(shape) {
  if (!shape) return ''
  return clean(shape.replace(/^(\(\[|\[\[|\(\(|\(|\[|\{|>)/, '').replace(/(\]\)|\]\]|\)\)|\)|\]|\})$/, ''))
}

// 解析單一 mermaid flowchart
export function parseMermaidFlow(code) {
  const nodes = new Map() // id -> {id,type,label,color}
  const edges = []
  const classColor = {} // className -> color
  const nodeClass = {} // id -> className

  const ensure = (id) => { if (!nodes.has(id)) nodes.set(id, { id, type: 'process', label: id }); return nodes.get(id) }
  const define = (id, shape) => {
    const n = ensure(id)
    const t = shapeType(shape)
    if (t) { n.type = t; n.label = shapeText(shape) || n.label }
  }

  for (let raw of code.split('\n')) {
    let line = raw.trim()
    if (!line || line.startsWith('%%')) continue
    if (/^(flowchart|graph)\b/i.test(line)) continue
    if (/^(subgraph|end|direction)\b/i.test(line)) continue
    if (/^classDef\b/i.test(line)) {
      const m = line.match(/^classDef\s+(\w+)\s+(.*)$/i)
      if (m) { const s = m[2].match(/stroke:\s*(#[0-9a-fA-F]{3,8})/); const f = m[2].match(/fill:\s*(#[0-9a-fA-F]{3,8})/); classColor[m[1]] = (s && s[1]) || (f && f[1]) }
      continue
    }
    if (/^class\b/i.test(line)) {
      const m = line.match(/^class\s+([\w,]+)\s+(\w+)/i)
      if (m) m[1].split(',').forEach((id) => { nodeClass[id.trim()] = m[2] })
      continue
    }
    line = line.replace(/;+\s*$/, '')

    // 斷詞：node (edge node)*
    const toks = []
    let s = line
    while (s.length) {
      const n = s.match(NODE_RE)
      if (!n) break
      toks.push({ t: 'n', id: n[1], shape: n[2] })
      s = s.slice(n[0].length)
      if (!s.trim()) break
      const e = s.match(EDGE_RE)
      if (!e) break
      toks.push({ t: 'e', label: clean(e[1] ?? e[2] ?? '') })
      s = s.slice(e[0].length)
    }
    for (const tk of toks) if (tk.t === 'n') define(tk.id, tk.shape)
    for (let i = 0; i + 2 < toks.length + 1; i++) {
      if (toks[i]?.t === 'n' && toks[i + 1]?.t === 'e' && toks[i + 2]?.t === 'n') {
        edges.push({ from: toks[i].id, to: toks[i + 2].id, label: toks[i + 1].label || undefined })
      }
    }
  }

  // 起點/終點：terminal 形狀 → 無入邊=start、其餘=end
  const hasIn = new Set(edges.map((e) => e.to))
  const hasOut = new Set(edges.map((e) => e.from))
  const list = [...nodes.values()].map((n) => {
    let type = n.type
    if (type === 'terminal') type = !hasIn.has(n.id) ? 'start' : (!hasOut.has(n.id) ? 'end' : 'process')
    const color = classColor[nodeClass[n.id]]
    return { id: n.id, type, label: n.label, color }
  })
  return { nodes: list, edges }
}

// 解析整份 markdown：每個 ```mermaid``` 區塊 → {name, nodes, edges}
export function parseMermaidDoc(text) {
  const out = []
  const re = /```mermaid\s*([\s\S]*?)```/g
  let m
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(0, m.index)
    const heads = before.match(/^#{1,4}\s+(.+)$/gm)
    const name = heads ? heads[heads.length - 1].replace(/^#+\s+/, '').trim() : `流程 ${out.length + 1}`
    const g = parseMermaidFlow(m[1])
    if (g.nodes.length) out.push({ name, nodes: g.nodes, edges: g.edges })
  }
  // 沒有 ```mermaid``` 包裹 → 當成單純一張 flowchart
  if (!out.length && /(^|\n)\s*(flowchart|graph)\b/i.test(text)) {
    const g = parseMermaidFlow(text)
    if (g.nodes.length) out.push({ name: '匯入流程', nodes: g.nodes, edges: g.edges })
  }
  return out
}
