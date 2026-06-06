import { useStore } from '../store/StoreContext.jsx'
import { uid } from '../lib/id.js'
import { categoryMeta } from '../lib/categories.js'
import { flowToMarkdown, flowToMermaid } from '../lib/flowGenerator.js'
import { downloadText } from '../lib/download.js'
import { Plus, RotateCw, Download, ChevronUp, ChevronDown, X, Circle, ArrowDown, Workflow } from 'lucide-react'

export default function FlowView() {
  const { current, dispatch } = useStore()
  const flow = current.flow || { steps: [] }

  const setFlow = (steps) => dispatch({ type: 'UPDATE_FLOW', flow: { ...flow, steps } })

  const updateGroup = (gid, patch) =>
    setFlow(flow.steps.map((s) => (s.id === gid ? { ...s, ...patch } : s)))

  const updateAction = (gid, aid, label) =>
    setFlow(flow.steps.map((s) =>
      s.id === gid ? { ...s, actions: s.actions.map((a) => (a.id === aid ? { ...a, label } : a)) } : s,
    ))

  const addAction = (gid) =>
    setFlow(flow.steps.map((s) =>
      s.id === gid ? { ...s, actions: [...(s.actions || []), { id: uid('act'), label: '新步驟' }] } : s,
    ))

  const delAction = (gid, aid) =>
    setFlow(flow.steps.map((s) =>
      s.id === gid ? { ...s, actions: s.actions.filter((a) => a.id !== aid) } : s,
    ))

  const moveGroup = (gid, dir) => {
    const arr = [...flow.steps]
    const idx = arr.findIndex((s) => s.id === gid)
    const target = idx + dir
    // 不可移到 start(0) 之前或 end(last) 之後
    if (target <= 0 || target >= arr.length - 1) return
    ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
    setFlow(arr)
  }

  const delGroup = (gid) => setFlow(flow.steps.filter((s) => s.id !== gid))

  const addGroup = () => {
    const arr = [...flow.steps]
    const endIdx = arr.findIndex((s) => s.kind === 'end')
    const node = { id: uid('step'), kind: 'group', label: '新流程節點', category: 'generic', actions: [{ id: uid('act'), label: '步驟一' }] }
    arr.splice(endIdx < 0 ? arr.length : endIdx, 0, node)
    setFlow(arr)
  }

  const groups = flow.steps.filter((s) => s.kind === 'group')

  return (
    <div>
      <div className="toolbar">
        <strong>流程設計</strong>
        <div className="spacer" />
        <button onClick={addGroup}><Plus size={15} /> 新增流程節點</button>
        <button onClick={() => { if (confirm('依目前需求重新產生流程？將覆蓋手動調整。')) dispatch({ type: 'REGENERATE_FLOW' }) }}><RotateCw size={14} /> 由需求重新產生</button>
        <button onClick={() => downloadText(`${current.name}-流程設計.md`, flowToMarkdown(current, flow), 'text/markdown')}><Download size={15} /> Markdown</button>
        <button onClick={() => downloadText(`${current.name}-流程圖.mmd`, flowToMermaid(flow), 'text/plain')}><Download size={15} /> Mermaid</button>
      </div>

      {groups.length === 0 ? (
        <div className="empty"><div className="big"><Workflow size={40} /></div><div>尚無流程，先建立需求或按「新增流程節點」。</div></div>
      ) : (
        <div className="doc-layout" style={{ gridTemplateColumns: '1.1fr 0.9fr' }}>
          <div className="panel" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 230px)' }}>
            <div className="flow-canvas">
              <div className="flow-node terminal"><Circle size={11} fill="#22c55e" color="#22c55e" /> 開始</div>
              <div className="flow-arrow"><ArrowDown size={20} /></div>
              {groups.map((g, gi) => {
                const cat = categoryMeta(g.category)
                return (
                  <div key={g.id} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="flow-node" style={{ borderTopColor: cat.color, borderTopWidth: 3 }}>
                      <div className="fn-head">
                        <span className="tag" style={{ background: cat.color }}>{cat.label}</span>
                        <input value={g.label} onChange={(e) => updateGroup(g.id, { label: e.target.value })} />
                        <button className="ghost sm" disabled={gi === 0} onClick={() => moveGroup(g.id, -1)}><ChevronUp size={14} /></button>
                        <button className="ghost sm" disabled={gi === groups.length - 1} onClick={() => moveGroup(g.id, 1)}><ChevronDown size={14} /></button>
                        <button className="ghost sm danger" onClick={() => delGroup(g.id)}><X size={14} /></button>
                      </div>
                      <div className="fn-body">
                        {(g.actions || []).map((a, ai) => (
                          <div className="flow-act" key={a.id}>
                            <span className="num">{ai + 1}</span>
                            <input value={a.label} onChange={(e) => updateAction(g.id, a.id, e.target.value)} />
                            <button className="ghost sm danger" onClick={() => delAction(g.id, a.id)}><X size={13} /></button>
                          </div>
                        ))}
                        <button className="ghost sm" onClick={() => addAction(g.id)}><Plus size={13} /> 步驟</button>
                      </div>
                    </div>
                    <div className="flow-arrow"><ArrowDown size={20} /></div>
                  </div>
                )
              })}
              <div className="flow-node terminal"><Circle size={11} fill="#ef4444" color="#ef4444" /> 結束</div>
            </div>
          </div>

          <div className="panel doc-preview">
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Mermaid 流程圖原始碼（可貼到支援 Mermaid 的工具預覽）</div>
            <pre style={{ background: '#0f172a', color: '#e2e8f0', padding: 14, borderRadius: 8, fontSize: 12, overflow: 'auto' }}>
              {flowToMermaid(flow)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
