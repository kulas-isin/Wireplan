import { useEffect } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { uid } from '../lib/id.js'
import { categoryMeta } from '../lib/categories.js'
import { flowToMarkdown, flowToMermaid, ensureFlow, newNode } from '../lib/flowGenerator.js'
import { downloadText } from '../lib/download.js'
import Mermaid from './Mermaid.jsx'
import { Plus, RotateCw, Download, ChevronUp, ChevronDown, X, GitBranch } from 'lucide-react'

export default function FlowView() {
  const { current, dispatch } = useStore()

  // 舊格式 / 空流程 → 自動以新格式重新產生並保存
  useEffect(() => {
    if (!current.flow?.nodes?.length) dispatch({ type: 'REGENERATE_FLOW' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id])

  const flow = ensureFlow(current)
  const nodes = flow.nodes
  const endId = nodes.find((n) => n.type === 'end')?.id

  const setNodes = (next) => dispatch({ type: 'UPDATE_FLOW', flow: { ...flow, nodes: next } })
  const patchNode = (id, patch) => setNodes(nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)))

  const addNode = (type) => {
    const node = newNode(type, { next: endId })
    const idx = nodes.findIndex((n) => n.type === 'end')
    const arr = [...nodes]
    arr.splice(idx < 0 ? arr.length : idx, 0, node)
    setNodes(arr)
  }

  const deleteNode = (id) => {
    const target = nodes.find((n) => n.id === id)
    const fallback = target?.next ?? endId
    const arr = nodes
      .filter((n) => n.id !== id)
      .map((n) => {
        const nn = { ...n }
        if (nn.next === id) nn.next = fallback
        if (nn.branches) nn.branches = nn.branches.map((b) => (b.target === id ? { ...b, target: fallback } : b))
        return nn
      })
    setNodes(arr)
  }

  const moveNode = (id, dir) => {
    const arr = [...nodes]
    const idx = arr.findIndex((n) => n.id === id)
    const t = idx + dir
    // 不可移到 start 之前或 end 之後
    if (idx < 0 || t <= 0 || t >= arr.length - 1) return
    ;[arr[idx], arr[t]] = [arr[t], arr[idx]]
    setNodes(arr)
  }

  const addBranch = (id) => {
    const n = nodes.find((x) => x.id === id)
    patchNode(id, { branches: [...(n.branches || []), { id: uid('br'), label: '其他', target: endId }] })
  }
  const updateBranch = (id, bid, patch) => {
    const n = nodes.find((x) => x.id === id)
    patchNode(id, { branches: n.branches.map((b) => (b.id === bid ? { ...b, ...patch } : b)) })
  }
  const delBranch = (id, bid) => {
    const n = nodes.find((x) => x.id === id)
    patchNode(id, { branches: n.branches.filter((b) => b.id !== bid) })
  }

  // 目標下拉：除了自己以外的所有節點
  const TargetSelect = ({ value, exclude, onChange }) => (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">（未指定）</option>
      {nodes.filter((n) => n.id !== exclude).map((n) => (
        <option key={n.id} value={n.id}>
          {n.type === 'end' ? '🔴 結束' : n.type === 'start' ? '🟢 開始' : n.type === 'decision' ? `🔶 ${n.label}` : `◻️ ${n.label}`}
        </option>
      ))}
    </select>
  )

  const mermaid = flowToMermaid(flow)

  return (
    <div>
      <div className="toolbar">
        <strong>流程設計</strong>
        <div className="spacer" />
        <button onClick={() => addNode('screen')}><Plus size={15} /> 畫面節點</button>
        <button onClick={() => addNode('decision')}><GitBranch size={15} /> 判斷節點</button>
        <button onClick={() => { if (confirm('依目前需求重新產生流程？將覆蓋手動調整。')) dispatch({ type: 'REGENERATE_FLOW' }) }}><RotateCw size={14} /> 由需求重新產生</button>
        <button onClick={() => downloadText(`${current.name}-流程設計.md`, flowToMarkdown(current, flow), 'text/markdown')}><Download size={15} /> Markdown</button>
        <button onClick={() => downloadText(`${current.name}-流程圖.mmd`, mermaid, 'text/plain')}><Download size={15} /> Mermaid</button>
      </div>

      <div className="doc-layout" style={{ gridTemplateColumns: '0.95fr 1.05fr' }}>
        {/* 左：節點清單編輯 */}
        <div style={{ overflow: 'auto', height: 'calc(100vh - 270px)' }}>
          <div className="flow-list">
            {nodes.map((n, i) => {
              if (n.type === 'start') {
                return (
                  <div key={n.id} className="flow-card start">
                    <div className="fc-head"><span className="tag" style={{ background: '#22c55e' }}>開始</span><strong>流程起點</strong></div>
                    <div className="fc-row">下一步 →
                      <TargetSelect value={n.next} exclude={n.id} onChange={(v) => patchNode(n.id, { next: v })} />
                    </div>
                  </div>
                )
              }
              if (n.type === 'end') {
                return (
                  <div key={n.id} className="flow-card end">
                    <div className="fc-head"><span className="tag" style={{ background: 'var(--danger)' }}>結束</span><strong>流程終點</strong></div>
                  </div>
                )
              }
              if (n.type === 'decision') {
                return (
                  <div key={n.id} className="flow-card decision">
                    <div className="fc-head">
                      <span className="tag" style={{ background: 'var(--warn)' }}>判斷</span>
                      <input value={n.label} onChange={(e) => patchNode(n.id, { label: e.target.value })} placeholder="判斷條件？" />
                      <button className="ghost sm" disabled={i === 1} onClick={() => moveNode(n.id, -1)}><ChevronUp size={14} /></button>
                      <button className="ghost sm" onClick={() => moveNode(n.id, 1)}><ChevronDown size={14} /></button>
                      <button className="ghost sm danger" onClick={() => deleteNode(n.id)}><X size={14} /></button>
                    </div>
                    {(n.branches || []).map((b) => (
                      <div className="flow-branch" key={b.id}>
                        <input className="blabel" value={b.label} onChange={(e) => updateBranch(n.id, b.id, { label: e.target.value })} placeholder="分支" />
                        <span className="muted">→</span>
                        <TargetSelect value={b.target} exclude={n.id} onChange={(v) => updateBranch(n.id, b.id, { target: v })} />
                        <button className="ghost sm danger" onClick={() => delBranch(n.id, b.id)}><X size={13} /></button>
                      </div>
                    ))}
                    <button className="ghost sm" style={{ marginTop: 6 }} onClick={() => addBranch(n.id)}><Plus size={13} /> 分支</button>
                  </div>
                )
              }
              // screen / action
              const cat = n.category ? categoryMeta(n.category) : null
              return (
                <div key={n.id} className="flow-card">
                  <div className="fc-head">
                    {cat && <span className="tag" style={{ background: cat.color }}>{cat.label}</span>}
                    <input value={n.label} onChange={(e) => patchNode(n.id, { label: e.target.value })} />
                    <button className="ghost sm" disabled={i === 1} onClick={() => moveNode(n.id, -1)}><ChevronUp size={14} /></button>
                    <button className="ghost sm" onClick={() => moveNode(n.id, 1)}><ChevronDown size={14} /></button>
                    <button className="ghost sm danger" onClick={() => deleteNode(n.id)}><X size={14} /></button>
                  </div>
                  <div className="fc-row">下一步 →
                    <TargetSelect value={n.next} exclude={n.id} onChange={(v) => patchNode(n.id, { next: v })} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 右：即時流程圖 */}
        <div>
          <Mermaid code={mermaid} />
        </div>
      </div>
    </div>
  )
}
