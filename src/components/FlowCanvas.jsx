import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap, Handle, Position, ConnectionMode,
  addEdge, applyNodeChanges, applyEdgeChanges, MarkerType,
  BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useNodes,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { toPng } from 'html-to-image'
import { useStore } from '../store/StoreContext.jsx'
import { uid } from '../lib/id.js'
import { toGraph, autoLayout, graphToMermaid } from '../lib/flowGraph.js'
import { FLOW_PATTERNS, buildPatternFlow } from '../lib/flowPatterns.js'
import { extractTriggers } from '../lib/flowTriggers.js'
import { parseMermaidDoc } from '../lib/mermaidImport.js'
import WireframePreview from './WireframePreview.jsx'
import { downloadText } from '../lib/download.js'
import { Plus, GitBranch, RotateCw, Download, Image as ImageIcon, LayoutGrid, Link2, Trash2 } from 'lucide-react'

// 頁名比對（去編號/括號/空白）— 與 flowGenerator 同邏輯
const coreName = (l) => String(l || '')
  .replace(/^[wWＷ]?\s*[.\d]+[a-zA-Z]?\s*/, '').replace(/[（(【[].*?[）)】\]]/g, '').replace(/\s+/g, '').trim()

// ── 自訂節點 ──────────────────────────────
function PageNode({ id, data, selected }) {
  const { current } = useStore()
  const wf = data.missing ? null : findWf(current.wireframes, data.page || data.label)
  if (!wf) {
    return (
      <div className={'fl-node fl-page' + (data.missing ? ' fl-missing' : '') + (selected ? ' sel' : '')}
        style={data.color ? { borderColor: data.color } : undefined}>
        <Handle type="target" position={Position.Top} />
        <Handle type="target" position={Position.Left} id="l" />
        {data.color && <span className="fl-dot" style={{ background: data.color }} />}
        <span className="fl-label">{data.label}{data.missing ? '（待補）' : ''}</span>
        <Handle type="source" position={Position.Bottom} />
        <Handle type="source" position={Position.Right} id="r" />
      </div>
    )
  }
  const triggers = extractTriggers(wf)
  const wired = new Set((current.flow?.graph?.edges || []).filter((e) => e.source === id && e.label).map((e) => e.label))
  return (
    <div className={'fl-screen-node' + (selected ? ' sel' : '')} style={data.color ? { borderColor: data.color } : undefined}>
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} id="l" />
      <div className="fl-thumb"><div className="fl-thumb-scale"><WireframePreview wireframe={wf} /></div></div>
      <div className="fl-cap">{data.label}</div>
      {triggers.length > 0 && (
        <div className="fl-ports">
          {triggers.map((t) => (
            <span key={t.label} className={'fl-port' + (wired.has(t.label) ? ' on' : '')} title={`從「${t.label}」拉線到目標畫面`}>
              {t.label}
              <Handle type="source" position={Position.Right} id={'t:' + t.label} className="fl-port-h" />
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
function DecisionNode({ data, selected }) {
  return (
    <div className={'fl-decision' + (selected ? ' sel' : '')}>
      <Handle type="target" position={Position.Top} />
      <div className="fl-diamond" />
      <span className="fl-dtext">{data.label}</span>
      <Handle type="source" position={Position.Right} id="yes" />
      <Handle type="source" position={Position.Bottom} id="no" />
    </div>
  )
}
function TerminalNode({ data, type }) {
  return (
    <div className={'fl-node fl-terminal ' + (type === 'start' ? 'fl-start' : 'fl-end')}>
      <Handle type="target" position={Position.Top} />
      <span className="fl-label">{data.label}</span>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
function ProcessNode({ data, selected }) {
  return (
    <div className={'fl-node fl-process' + (selected ? ' sel' : '') + (data.jumpFlow ? ' fl-jump' : '')} style={data.color ? { borderColor: data.color } : undefined} title={data.jumpFlow ? `雙擊跳到流程「${data.jumpFlow}」` : undefined}>
      <Handle type="target" position={Position.Top} />
      <Handle type="target" position={Position.Left} id="l" />
      <span className="fl-label">{data.jumpFlow ? '↪ ' : ''}{data.label}</span>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} id="r" />
    </div>
  )
}
const nodeTypes = { page: PageNode, decision: DecisionNode, start: TerminalNode, end: TerminalNode, process: ProcessNode }

// ── 回寫機制：page→page 的線顯示「已對應 / 加導航鈕」 ──
const findWf = (wfs, name) => {
  const k = coreName(name)
  return (wfs || []).find((w) => { const c = coreName(w.name); return c && (c.includes(k) || k.includes(c)) })
}
const collectActions = (components, out = []) => {
  for (const c of components || []) {
    if (!c || typeof c !== 'object') continue
    if (c.type === 'buttonRow') out.push(...(c.buttons || []))
    else if (c.type === 'link') out.push(c.label)
    else if (c.type === 'pageHeader') out.push(c.primaryText, c.secondaryText, ...(c.actions || []))
    else if (c.type === 'breadcrumb' || c.type === 'dropdown') out.push(...(c.items || []))
    if (Array.isArray(c.children)) collectActions(c.children, out)
  }
  return out.filter(Boolean)
}
const hasNavTo = (srcWf, targetName) => {
  const k = coreName(targetName)
  return collectActions(srcWf.components).some((t) => { const c = coreName(t); return c && (c.includes(k) || k.includes(c)) })
}

function BackSyncEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, markerEnd, style }) {
  const nodes = useNodes()
  const { current, dispatch } = useStore()
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const s = nodes.find((n) => n.id === source)
  const t = nodes.find((n) => n.id === target)
  let chip = null
  if (s?.type === 'page' && t?.type === 'page') {
    const srcWf = findWf(current.wireframes, s.data.page || s.data.label)
    const tgtWf = findWf(current.wireframes, t.data.page || t.data.label)
    if (srcWf && tgtWf && srcWf.id !== tgtWf.id) {
      chip = hasNavTo(srcWf, tgtWf.name)
        ? <span className="fl-edge-ok">✓ 已對應</span>
        : <button className="fl-edge-add" title={`在「${srcWf.name}」加一顆前往「${tgtWf.name}」的按鈕`}
            onClick={(e) => {
              e.stopPropagation()
              dispatch({ type: 'ADD_COMPONENT', wireframeId: srcWf.id, component: { id: uid('cmp'), type: 'buttonRow', label: '', width: 'full', region: 'content', buttons: ['前往 ' + coreName(tgtWf.name)] } })
            }}>⊕ 加導航鈕</button>
    }
  }
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: '#64748b', strokeWidth: 2, ...(style || {}) }} />
      {(label || chip) && (
        <EdgeLabelRenderer>
          <div className="fl-edge-lbl" style={{ transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}>
            {label && <span className="fl-edge-text">{label}</span>}
            {chip}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
const edgeTypes = { backsync: BackSyncEdge }

// graph → ReactFlow（標記缺頁、套分類色、跨流程引用）
const fCode = (s) => { const m = String(s || '').match(/F\d+/i); return m ? m[0].toUpperCase() : null }
function toRf(graph, wireframes) {
  const wfKeys = new Set((wireframes || []).map((w) => coreName(w.name)))
  // 建立「F 編號 → 流程名」對照，用來偵測引用別張流程的節點
  const flowNames = [...new Set((graph.nodes || []).map((n) => n.flow).filter(Boolean))]
  const flowByCode = {}
  flowNames.forEach((fn) => { const c = fCode(fn); if (c) flowByCode[c] = fn })
  const nodes = (graph.nodes || []).map((n) => {
    const lc = fCode(n.label)
    const jumpFlow = lc && flowByCode[lc] && flowByCode[lc] !== n.flow ? flowByCode[lc] : undefined
    return {
      id: n.id,
      type: ['page', 'decision', 'start', 'end', 'process'].includes(n.type) ? n.type : 'page',
      position: { x: n.x ?? 0, y: n.y ?? 0 },
      data: {
        label: n.label || '', page: n.page, wireframeId: n.wireframeId, role: n.role, color: n.color, flow: n.flow, jumpFlow,
        missing: n.type === 'page' && !!(n.page || n.label) && !wfKeys.has(coreName(n.page || n.label)),
      },
    }
  })
  const edges = (graph.edges || []).map((e) => ({
    id: e.id || uid('e'), source: e.source, target: e.target, sourceHandle: e.sourceHandle,
    label: e.label, type: 'backsync', markerEnd: { type: MarkerType.ArrowClosed },
  }))
  return { nodes, edges }
}
// ReactFlow → 存檔用 graph
function fromRf(nodes, edges) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id, type: n.type, label: n.data.label, page: n.data.page,
      wireframeId: n.data.wireframeId, role: n.data.role, color: n.data.color, flow: n.data.flow,
      x: Math.round(n.position.x), y: Math.round(n.position.y),
    })),
    edges: edges.map((e) => ({
      id: e.id, source: e.source, target: e.target,
      sourceHandle: e.sourceHandle || undefined, label: e.label || undefined,
    })),
  }
}

export default function FlowCanvas() {
  const { current, dispatch } = useStore()
  const [rfNodes, setRfNodes] = useState([])
  const [rfEdges, setRfEdges] = useState([])
  const [reload, setReload] = useState(0)
  const [connectMode, setConnectMode] = useState(false)
  const [pending, setPending] = useState(null)
  const [selected, setSelected] = useState({ nodes: [], edges: [] })
  const [viewFlow, setViewFlow] = useState('')
  const [mmOpen, setMmOpen] = useState(false)
  const [mmText, setMmText] = useState('')
  const wrapRef = useRef(null)
  const saveTimer = useRef(null)
  const rfInst = useRef(null)

  // 目前畫布上有哪些業務流程（給「顯示流程」下拉）
  const flowNames = useMemo(() => [...new Set(rfNodes.map((n) => n.data.flow).filter(Boolean))], [rfNodes])
  // 只顯示選定流程的節點/線（編輯仍作用在完整資料上）
  const viewNodes = useMemo(() => (viewFlow ? rfNodes.filter((n) => n.data.flow === viewFlow) : rfNodes), [rfNodes, viewFlow])
  const viewEdges = useMemo(() => {
    if (!viewFlow) return rfEdges
    const ids = new Set(viewNodes.map((n) => n.id))
    return rfEdges.filter((e) => ids.has(e.source) && ids.has(e.target))
  }, [rfEdges, viewNodes, viewFlow])

  // 切換顯示流程後重新置中
  useEffect(() => {
    const t = setTimeout(() => rfInst.current?.fitView({ maxZoom: 1, padding: 0.2, duration: 200 }), 60)
    return () => clearTimeout(t)
  }, [viewFlow])

  // 載入：切專案 / 外部重新產生時，從 store 重建畫布
  useEffect(() => {
    if (!current.flow?.graph?.nodes?.length && !current.flow?.nodes?.length) {
      dispatch({ type: 'REGENERATE_FLOW_FROM_WIREFRAMES' })
      return
    }
    const g = toGraph(current.flow)
    const rf = toRf(g, current.wireframes)
    setRfNodes(rf.nodes); setRfEdges(rf.edges)
    if (!current.flow?.graph) persist(g, true) // 由舊格式載入 → 正規化為 graph
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id, reload])

  // 存檔（silent = 純移動，不進 undo 歷史）
  const persist = useCallback((graph, silent) => {
    dispatch({ type: silent ? 'UPDATE_FLOW_SILENT' : 'UPDATE_FLOW', flow: { graph } })
  }, [dispatch])

  const persistNow = (nodes, edges, silent) => persist(fromRf(nodes, edges), silent)

  const onNodesChange = useCallback((changes) => {
    setRfNodes((nds) => applyNodeChanges(changes, nds))
  }, [])
  const onEdgesChange = useCallback((changes) => {
    setRfEdges((eds) => {
      const next = applyEdgeChanges(changes, eds)
      if (changes.some((c) => c.type === 'remove')) setRfNodes((nds) => { persistNow(nds, next); return nds })
      return next
    })
  }, [])

  // 拖完才存（不進歷史）
  const onNodeDragStop = useCallback(() => {
    setRfNodes((nds) => { setRfEdges((eds) => { persistNow(nds, eds, true); return eds }); return nds })
  }, [])

  // 拉線連接
  const onConnect = useCallback((conn) => {
    const sh = conn.sourceHandle
    const label = sh === 'yes' ? '是' : sh === 'no' ? '否' : (sh && sh.startsWith('t:')) ? sh.slice(2) : undefined
    setRfEdges((eds) => {
      const next = addEdge({ ...conn, id: uid('e'), label, type: 'backsync', markerEnd: { type: MarkerType.ArrowClosed } }, eds)
      setRfNodes((nds) => { persistNow(nds, next); return nds })
      return next
    })
  }, [])

  const onNodesDelete = useCallback(() => {
    setTimeout(() => setRfNodes((nds) => { setRfEdges((eds) => { persistNow(nds, eds); return eds }); return nds }), 0)
  }, [])

  // 標記/清除「連線模式」起點高亮
  const markPending = (id) => setRfNodes((nds) => nds.map((n) => ({ ...n, className: n.id === id ? 'fl-pending' : undefined })))

  // 連線模式：點起點 → 點目標 = 連線（手機不用拖小圓點）
  const onNodeClick = useCallback((_e, node) => {
    if (!connectMode) return
    if (!pending) { setPending(node.id); markPending(node.id); return }
    if (pending === node.id) { setPending(null); markPending(null); return }
    setRfEdges((eds) => {
      const src = rfNodes.find((n) => n.id === pending)
      let label
      if (src?.type === 'decision') { const out = eds.filter((x) => x.source === pending).length; label = out === 0 ? '是' : out === 1 ? '否' : undefined }
      const next = addEdge({ id: uid('e'), source: pending, target: node.id, label, type: 'backsync', markerEnd: { type: MarkerType.ArrowClosed } }, eds)
      setRfNodes((nds) => { const cleared = nds.map((n) => ({ ...n, className: undefined })); persistNow(cleared, next); return cleared })
      return next
    })
    setPending(null)
  }, [connectMode, pending, rfNodes])

  const onPaneClick = useCallback(() => { if (pending) { setPending(null); markPending(null) } }, [pending])

  const onSelectionChange = useCallback(({ nodes, edges }) => setSelected({ nodes: nodes || [], edges: edges || [] }), [])

  // 刪除目前選取（手機無 Delete 鍵）
  const deleteSelected = () => {
    const nIds = new Set(selected.nodes.map((n) => n.id))
    const eIds = new Set(selected.edges.map((e) => e.id))
    if (!nIds.size && !eIds.size) return
    setRfNodes((nds) => {
      const nextN = nds.filter((n) => !nIds.has(n.id))
      setRfEdges((eds) => {
        const nextE = eds.filter((e) => !eIds.has(e.id) && !nIds.has(e.source) && !nIds.has(e.target))
        persistNow(nextN, nextE)
        return nextE
      })
      return nextN
    })
    setSelected({ nodes: [], edges: [] })
  }

  const toggleConnect = () => { setConnectMode((m) => !m); setPending(null); markPending(null) }

  // 選到單一頁節點時，列出該頁可觸發元件 → 逐一指定去向
  const selPage = (selected.nodes.length === 1 && selected.nodes[0].type === 'page') ? selected.nodes[0] : null
  const selWf = selPage ? findWf(current.wireframes, selPage.data.page || selPage.data.label) : null
  const triggers = useMemo(() => (selWf ? extractTriggers(selWf) : []), [selWf])

  // 設定某觸發的去向（建立/更新/移除一條帶觸發標籤的連線）
  const setTriggerTarget = (sourceId, triggerLabel, targetId) => {
    setRfEdges((eds) => {
      let next = eds.filter((e) => !(e.source === sourceId && e.label === triggerLabel))
      if (targetId) next = [...next, { id: uid('e'), source: sourceId, target: targetId, sourceHandle: 't:' + triggerLabel, label: triggerLabel, type: 'backsync', markerEnd: { type: MarkerType.ArrowClosed } }]
      setRfNodes((nds) => { persistNow(nds, next); return nds })
      return next
    })
  }

  // 編輯連線標籤（觸發按鈕 / 條件文字）
  const editEdgeLabel = (edge) => {
    if (!edge) return
    const v = window.prompt('連線標籤（觸發按鈕 / 條件，例如「點登入」「是」）：', edge.label || '')
    if (v === null) return
    setRfEdges((eds) => {
      const next = eds.map((e) => (e.id === edge.id ? { ...e, label: v.trim() || undefined } : e))
      setRfNodes((nds) => { persistNow(nds, next); return nds })
      return next
    })
  }
  const onEdgeDoubleClick = useCallback((_e, edge) => editEdgeLabel(edge), [])

  // 雙擊「引用別張流程」的節點 → 跳到那條流程
  const onNodeDoubleClick = useCallback((_e, node) => { if (node?.data?.jumpFlow) setViewFlow(node.data.jumpFlow) }, [])

  // 加節點
  const addNode = (kind) => {
    let label = kind === 'decision' ? '判斷？' : '新頁面'
    let page, wireframeId
    if (kind === 'page') {
      const name = window.prompt('頁面名稱：', '新頁面')
      if (name == null) return
      label = name; page = name
      if (window.confirm(`要同時建立一張空白 wireframe「${name}」嗎？`)) {
        dispatch({ type: 'ADD_BLANK_WIREFRAME', name })
      }
    }
    const node = {
      id: uid('node'), type: kind, position: { x: 60, y: 40 },
      data: { label, page, wireframeId, missing: false },
    }
    setRfNodes((nds) => { const next = [...nds, node]; setRfEdges((eds) => { persistNow(next, eds); return eds }); return next })
    setReload((r) => r + 1) // 重新解析缺頁狀態（含剛建立的 wireframe）
  }

  const autoArrange = () => {
    const g = fromRf(rfNodes, rfEdges)
    const laid = autoLayout(g.nodes, g.edges)
    const posById = new Map(laid.map((n) => [n.id, n]))
    setRfNodes((nds) => {
      const next = nds.map((n) => ({ ...n, position: { x: posById.get(n.id)?.x ?? n.position.x, y: posById.get(n.id)?.y ?? n.position.y } }))
      setRfEdges((eds) => { persistNow(next, eds, true); return eds })
      return next
    })
  }

  const exportPng = async () => {
    const el = wrapRef.current?.querySelector('.react-flow__viewport')
    if (!el) return
    try {
      const url = await toPng(el, { backgroundColor: '#fff', pixelRatio: 2, cacheBust: true })
      const a = document.createElement('a'); a.href = url; a.download = `${current.name || '流程'}-流程圖.png`; a.click()
    } catch { /* ignore */ }
  }
  const exportMermaid = () => downloadText(`${current.name || '流程'}-流程圖.mmd`, graphToMermaid(fromRf(rfNodes, rfEdges)), 'text/plain')

  const regen = () => {
    if (!confirm('依目前「畫面」重新鋪流程？\n（你手動拖過的位置與連線會被重排，建議在空白或初次使用時用）')) return
    dispatch({ type: 'REGENERATE_FLOW_FROM_WIREFRAMES' })
    setReload((r) => r + 1)
  }

  // 匯入 Mermaid：每個 ```mermaid``` 區塊 → 一條流程，往右排開併入現有圖
  const importMermaid = (text) => {
    const flows = parseMermaidDoc(text)
    if (!flows.length) { window.alert('沒有解析到 flowchart（請貼 mermaid flowchart 內容）'); return }
    const cur = fromRf(rfNodes, rfEdges)
    let offX = cur.nodes.length ? Math.max(...cur.nodes.map((n) => n.x || 0)) + 400 : 0
    const addN = [], addE = []
    for (const f of flows) {
      const idMap = new Map()
      const gn = f.nodes.map((n) => { const id = uid('node'); idMap.set(n.id, id); return { id, type: n.type, label: n.label, color: n.color, flow: f.name } })
      const ge = f.edges.filter((e) => idMap.has(e.from) && idMap.has(e.to)).map((e) => ({ id: uid('e'), source: idMap.get(e.from), target: idMap.get(e.to), label: e.label }))
      const laid = autoLayout(gn, ge)
      const xs = laid.map((n) => n.x || 0)
      const w = (Math.max(...xs, 0) - Math.min(...xs, 0)) || 0
      addN.push(...laid.map((n) => ({ ...n, x: (n.x || 0) + offX })))
      addE.push(...ge)
      offX += w + 420
    }
    persist({ nodes: [...cur.nodes, ...addN], edges: [...cur.edges, ...addE] })
    setReload((r) => r + 1)
    window.alert(`已匯入 ${flows.length} 條流程：${flows.map((f) => f.name).join('、')}`)
  }

  // 插入業務流程模式（綁既有頁面、含判斷/失敗回圈、角色色），放在現有流程右側
  const insertPattern = (id) => {
    const p = FLOW_PATTERNS.find((x) => x.id === id)
    if (!p) return
    const g = buildPatternFlow(p, current.wireframes)
    const cur = fromRf(rfNodes, rfEdges)
    const maxX = cur.nodes.reduce((m, n) => Math.max(m, n.x || 0), -Infinity)
    const offX = cur.nodes.length ? maxX + 360 : 0
    const merged = {
      nodes: [...cur.nodes, ...g.nodes.map((n) => ({ ...n, x: (n.x || 0) + offX, y: n.y || 0 }))],
      edges: [...cur.edges, ...g.edges],
    }
    persist(merged)
    setReload((r) => r + 1)
  }

  const defaultEdgeOptions = useMemo(() => ({ type: 'backsync' }), [])

  return (
    <div className="flow-canvas-wrap">
      <div className="toolbar">
        <strong>流程設計</strong>
        <span className="muted fl-hint">{connectMode ? (pending ? '再點「目標」節點即連線' : '點一個節點當「起點」') : '拖節點移動 · 拉線或用連線模式連接'}</span>
        <div className="spacer" />
        <button className={connectMode ? 'primary' : ''} onClick={toggleConnect}><Link2 size={15} /> 連線模式</button>
        <button onClick={() => addNode('page')}><Plus size={15} /> 頁節點</button>
        <button onClick={() => addNode('decision')}><GitBranch size={15} /> 判斷節點</button>
        {flowNames.length > 0 && (
          <select className="fl-pattern-select" value={viewFlow} onChange={(e) => setViewFlow(e.target.value)} title="只顯示某條業務流程">
            <option value="">顯示：全部</option>
            {flowNames.map((nm) => <option key={nm} value={nm}>只看：{nm}</option>)}
          </select>
        )}
        <select className="fl-pattern-select" value="" onChange={(e) => { if (e.target.value) insertPattern(e.target.value); e.target.value = '' }} title="插入業務流程模式">
          <option value="">＋ 業務流程…</option>
          {FLOW_PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.name}（{p.role}）</option>)}
        </select>
        <button onClick={autoArrange}><LayoutGrid size={15} /> 自動排列</button>
        <button className="primary" onClick={regen}><RotateCw size={14} /> 由畫面重新鋪</button>
        <button onClick={() => { setMmText(''); setMmOpen(true) }}><Download size={15} style={{ transform: 'rotate(180deg)' }} /> 匯入 Mermaid</button>
        <button onClick={exportPng}><ImageIcon size={15} /> PNG</button>
        <button onClick={exportMermaid}><Download size={15} /> Mermaid</button>
      </div>
      {mmOpen && (
        <div className="mm-modal-backdrop" onClick={() => setMmOpen(false)}>
          <div className="mm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mm-modal-head">匯入 Mermaid 流程圖</div>
            <p className="mm-modal-tip">貼上 mermaid flowchart（可整份含多個 ```mermaid``` 區塊，每塊變一條流程）。支援判斷多分支、起訖、處理節點、classDef 顏色。</p>
            <textarea className="mm-modal-ta" value={mmText} onChange={(e) => setMmText(e.target.value)} placeholder={'flowchart LR\n  A([開始]) --> B{判斷?}\n  B -->|是| C[頁面]\n  B -->|否| A'} />
            <div className="mm-modal-btns">
              <button onClick={() => setMmOpen(false)}>取消</button>
              <button className="primary" onClick={() => { importMermaid(mmText); setMmOpen(false) }}>匯入</button>
            </div>
          </div>
        </div>
      )}
      <div className={'flow-canvas' + (connectMode ? ' fl-connect' : '')} ref={wrapRef} style={{ height: 'calc(100vh - 210px)' }}>
        <ReactFlow
          nodes={viewNodes}
          edges={viewEdges}
          onInit={(inst) => { rfInst.current = inst }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onSelectionChange={onSelectionChange}
          nodesDraggable={!connectMode}
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2.5}
          onlyRenderVisibleElements
          deleteKeyCode={['Delete', 'Backspace']}
        >
          <Background gap={18} size={1.5} color="#dfe4ea" />
          <Controls />
          <MiniMap pannable zoomable nodeStrokeWidth={2} />
        </ReactFlow>
        {selPage && (
          <div className="fl-trig-panel">
            <div className="fl-trig-head">
              <span>「{selPage.data.label}」可觸發 <b>{triggers.length}</b></span>
              <button onClick={() => rfInst.current?.fitView({ maxZoom: 1, duration: 150 })} title="關閉請點空白處">↺</button>
            </div>
            {!selWf && <div className="fl-trig-empty">此頁節點未綁到 wireframe（紅色待補）</div>}
            {selWf && triggers.length === 0 && <div className="fl-trig-empty">此頁沒有可觸發元件</div>}
            <div className="fl-trig-list">
              {triggers.map((t) => {
                const cur = rfEdges.find((e) => e.source === selPage.id && e.label === t.label)?.target || ''
                return (
                  <div className="fl-trig-row" key={t.label}>
                    <span className="fl-trig-name" title={t.label}>{t.label}<i>{t.kind}</i></span>
                    <select value={cur} onChange={(e) => setTriggerTarget(selPage.id, t.label, e.target.value || null)}>
                      <option value="">（未設定入口）</option>
                      {rfNodes.filter((n) => n.id !== selPage.id).map((n) => (
                        <option key={n.id} value={n.id}>{(n.type === 'decision' ? '◇ ' : n.type === 'end' ? '⛳ ' : '▢ ') + (n.data.label || n.type)}</option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {selected.nodes.length === 0 && selected.edges.length === 1 && (
          <button className="fl-edit-fab" onClick={() => editEdgeLabel(selected.edges[0])}><Link2 size={15} /> 改標籤</button>
        )}
        {(selected.nodes.length > 0 || selected.edges.length > 0) && (
          <button className="fl-del-fab" onClick={deleteSelected}><Trash2 size={16} /> 刪除選取（{selected.nodes.length + selected.edges.length}）</button>
        )}
      </div>
    </div>
  )
}
