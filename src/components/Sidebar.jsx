import { useStore } from '../store/StoreContext.jsx'
import { PencilRuler, Plus, X } from 'lucide-react'

export default function Sidebar() {
  const { state, dispatch } = useStore()

  return (
    <header className="sidebar">
      <div className="logo">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PencilRuler size={20} /> Wireplan
        </span>
        <small>報價單 → Wireframe / 規格 / 流程</small>
      </div>

      <div className="brand-sep" />

      <div className="proj-list">
        {state.projects.map((p) => (
          <div
            key={p.id}
            className={'proj-item' + (p.id === state.currentId ? ' active' : '')}
            onClick={() => dispatch({ type: 'SET_CURRENT', id: p.id })}
            title={p.name}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
              {p.name}
            </span>
            <span
              className="del"
              title="刪除專案"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`確定刪除專案「${p.name}」？`)) dispatch({ type: 'DELETE_PROJECT', id: p.id })
              }}
            >
              <X size={13} />
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={() => dispatch({ type: 'NEW_PROJECT', name: `新專案 ${state.projects.length + 1}` })}
      >
        <Plus size={15} /> 新增專案
      </button>
    </header>
  )
}
