import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap, Handle, Position, ConnectionMode,
  addEdge, applyNodeChanges, applyEdgeChanges, MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { toPng } from 'html-to-image'
import { useStore } from '../store/StoreContext.jsx'
import { uid } from '../lib/id.js'
import { toGraph, autoLayout, graphToMermaid } from '../lib/flowGraph.js'
import { FLOW_PATTERNS, buildPatternFlow } from '../lib/flowPatterns.js'
import { downloadText } from '../lib/download.js'
import { Plus, GitBranch, RotateCw, Download, Image as ImageIcon, LayoutGrid, Link2, Trash2 } from 'lucide-react'

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
  const [connectMode, setConnectMode] = useState(false)
  const [pending, setPending] = useState(null)
  const [selected, setSelected] = useState({ nodes: [], edges: [] })
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
      const next = addEdge({ id: uid('e'), source: pending, target: node.id, label, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } }, eds)
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

  const defaultEdgeOptions = useMemo(() => ({ type: 'smoothstep' }), [])

  return (
    <div className="flow-canvas-wrap">
      <div className="toolbar">
        <strong>流程設計</strong>
        <span className="muted fl-hint">{connectMode ? (pending ? '再點「目標」節點即連線' : '點一個節點當「起點」') : '拖節點移動 · 拉線或用連線模式連接'}</span>
        <div className="spacer" />
        <button className={connectMode ? 'primary' : ''} onClick={toggleConnect}><Link2 size={15} /> 連線模式</button>
        <button onClick={() => addNode('page')}><Plus size={15} /> 頁節點</button>
        <button onClick={() => addNode('decision')}><GitBranch size={15} /> 判斷節點</button>
        <select className="fl-pattern-select" value="" onChange={(e) => { if (e.target.value) insertPattern(e.target.value); e.target.value = '' }} title="插入業務流程模式">
          <option value="">＋ 業務流程…</option>
          {FLOW_PATTERNS.map((p) => <option key={p.id} value={p.id}>{p.name}（{p.role}）</option>)}
        </select>
        <button onClick={autoArrange}><LayoutGrid size={15} /> 自動排列</button>
        <button className="primary" onClick={regen}><RotateCw size={14} /> 由畫面重新鋪</button>
        <button onClick={exportPng}><ImageIcon size={15} /> PNG</button>
        <button onClick={exportMermaid}><Download size={15} /> Mermaid</button>
      </div>
      <div className={'flow-canvas' + (connectMode ? ' fl-connect' : '')} ref={wrapRef} style={{ height: 'calc(100vh - 210px)' }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodesDelete={onNodesDelete}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onSelectionChange={onSelectionChange}
          nodesDraggable={!connectMode}
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2.5}
          deleteKeyCode={['Delete', 'Backspace']}
        >
          <Background gap={16} color="#e3e8e5" />
          <Controls />
          <MiniMap pannable zoomable nodeStrokeWidth={2} />
        </ReactFlow>
        {(selected.nodes.length > 0 || selected.edges.length > 0) && (
          <button className="fl-del-fab" onClick={deleteSelected}><Trash2 size={16} /> 刪除選取（{selected.nodes.length + selected.edges.length}）</button>
        )}
      </div>
    </div>
  )
}
