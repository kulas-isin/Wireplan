import { useStore } from '../store/StoreContext.jsx'

export default function Sidebar() {
  const { state, dispatch } = useStore()

  return (
    <aside className="sidebar">
      <div className="logo">
        Wireplan
        <small>報價單 → Wireframe / 規格 / 流程</small>
      </div>

      <div className="section-title">專案</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
        {state.projects.map((p) => (
          <div
            key={p.id}
            className={'proj-item' + (p.id === state.currentId ? ' active' : '')}
            onClick={() => dispatch({ type: 'SET_CURRENT', id: p.id })}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
              ✕
            </span>
          </div>
        ))}
      </div>

      <button
        style={{ marginTop: 8, background: '#1e293b', color: '#fff', borderColor: '#334155' }}
        onClick={() => dispatch({ type: 'NEW_PROJECT', name: `新專案 ${state.projects.length + 1}` })}
      >
        ＋ 新增專案
      </button>

      <div className="sidebar-footer">
        資料儲存在此瀏覽器（localStorage）。
        <br />可於各分頁匯出 / 備份。
      </div>
    </aside>
  )
}
