import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap, Handle, Position,
  addEdge, applyNodeChanges, applyEdgeChanges, MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { toPng } from 'html-to-image'
import { useStore } from '../store/StoreContext.jsx'
import { uid } from '../lib/id.js'
import { toGraph, autoLayout, graphToMermaid } from '../lib/flowGraph.js'
import { downloadText } from '../lib/download.js'
import { Plus, GitBranch, RotateCw, Download, Image as ImageIcon, LayoutGrid } from 'lucide-react'

// 頁名比對（去編號/括號/空白）— 與 flowGenerator 同邏輯
const coreName = (l) => String(l || '')
  .replace(/^[wWＷ]?\s*[.\d]+[a-zA-Z]?\s*/, '').replace(/[（(【[].*?[）)】\]]/g, '').replace(/\s+/g, '').trim()

// ── 自訂節點 ──────────────────────────────
function PageNode({ data, selected }) {
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
function DecisionNode({ data, selected }) {
  return (
    <div className={'fl-decision' + (selected ? ' sel' : '')}>
      <Handle type="target" position={Position.Top} />
      <div className="fl-diamond"><span>{data.label}</span></div>
      <Handle type="source" position={Position.Right} id="yes" />
      <Handle type="source" position={Position.Bottom} id="no" />
    </div>
  )
}
function TerminalNode({ data, type }) {
  return (
    <div className={'fl-node fl-terminal ' + (type === 'start' ? 'fl-start' : 'fl-end')}>
      {type !== 'start' && <Handle type="target" position={Position.Top} />}
      <span className="fl-label">{data.label}</span>
      {type !== 'end' && <Handle type="source" position={Position.Bottom} />}
    </div>
  )
}
const nodeTypes = { page: PageNode, decision: DecisionNode, start: TerminalNode, end: TerminalNode }

// graph → ReactFlow（標記缺頁、套分類色）
function toRf(graph, wireframes) {
  const wfKeys = new Set((wireframes || []).map((w) => coreName(w.name)))
  const nodes = (graph.nodes || []).map((n) => ({
    id: n.id,
    type: n.type === 'page' || n.type === 'decision' || n.type === 'start' || n.type === 'end' ? n.type : 'page',
    position: { x: n.x ?? 0, y: n.y ?? 0 },
    data: {
      label: n.label || '', page: n.page, wireframeId: n.wireframeId, role: n.role, color: n.color,
      missing: n.type === 'page' && !!(n.page || n.label) && !wfKeys.has(coreName(n.page || n.label)),
    },
  }))
  const edges = (graph.edges || []).map((e) => ({
    id: e.id || uid('e'), source: e.source, target: e.target, sourceHandle: e.sourceHandle,
    label: e.label, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed },
  }))
  return { nodes, edges }
}
// ReactFlow → 存檔用 graph
function fromRf(nodes, edges) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id, type: n.type, label: n.data.label, page: n.data.page,
      wireframeId: n.data.wireframeId, role: n.data.role, color: n.data.color,
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
  const wrapRef = useRef(null)
  const saveTimer = useRef(null)

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
    const label = conn.sourceHandle === 'yes' ? '是' : conn.sourceHandle === 'no' ? '否' : undefined
    setRfEdges((eds) => {
      const next = addEdge({ ...conn, id: uid('e'), label, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds)
      setRfNodes((nds) => { persistNow(nds, next); return nds })
      return next
    })
  }, [])

  const onNodesDelete = useCallback(() => {
    setTimeout(() => setRfNodes((nds) => { setRfEdges((eds) => { persistNow(nds, eds); return eds }); return nds }), 0)
  }, [])

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

  const defaultEdgeOptions = useMemo(() => ({ type: 'smoothstep' }), [])

  return (
    <div className="flow-canvas-wrap">
      <div className="toolbar">
        <strong>流程設計</strong>
        <span className="muted" style={{ fontSize: 12 }}>拖節點移動 · 從節點邊緣拉線連接 · 點線/選節點按 Delete 刪除</span>
        <div className="spacer" />
        <button onClick={() => addNode('page')}><Plus size={15} /> 頁節點</button>
        <button onClick={() => addNode('decision')}><GitBranch size={15} /> 判斷節點</button>
        <button onClick={autoArrange}><LayoutGrid size={15} /> 自動排列</button>
        <button className="primary" onClick={regen}><RotateCw size={14} /> 由畫面重新鋪</button>
        <button onClick={exportPng}><ImageIcon size={15} /> PNG</button>
        <button onClick={exportMermaid}><Download size={15} /> Mermaid</button>
      </div>
      <div className="flow-canvas" ref={wrapRef} style={{ height: 'calc(100vh - 210px)' }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          deleteKeyCode={['Delete', 'Backspace']}
        >
          <Background gap={16} color="#e3e8e5" />
          <Controls />
          <MiniMap pannable zoomable nodeStrokeWidth={2} />
        </ReactFlow>
      </div>
    </div>
  )
}
