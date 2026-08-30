import { useStore } from '../store/StoreContext.jsx'
import { sopStats } from '../lib/sop.js'
import { TriangleAlert } from 'lucide-react'

// SOP 進度列：五站數字 + 缺漏警示，點站名跳分頁 — SOP 不用背，打開就知道卡在哪
export default function SopBar({ tab, setTab }) {
  const { current } = useStore()
  const s = sopStats(current)
  const steps = [
    { key: 'requirements', n: '①', name: '訪談', stat: `${s.reqs} 卡`, warn: 0 },
    { key: 'flow', n: '②', name: '流程', stat: `${s.flowNodes} 節點`, warn: 0 },
    { key: 'wireframe', n: '③', name: '頁面', stat: `${s.wfs} 頁`, warn: s.missingPages, warnText: `${s.missingPages} 需求無頁` },
    { key: 'fields', n: '④', name: '欄位', stat: `${s.fields} 欄`, warn: s.fieldWarns + s.unregistered, warnText: [s.unregistered ? `${s.unregistered} 未登錄` : '', s.fieldWarns ? `${s.fieldWarns} 待補` : ''].filter(Boolean).join('、') },
    { key: 'spec', n: '⑤', name: '交付', stat: '', warn: 0 },
  ]
  return (
    <div className="sop-bar">
      {steps.map((st, i) => (
        <span key={st.key} style={{ display: 'inline-flex', alignItems: 'center' }}>
          {i > 0 && <span className="sop-sep">›</span>}
          <button className={'sop-step' + (tab === st.key ? ' on' : '') + (st.warn ? ' warn' : '')} onClick={() => setTab(st.key)}>
            <b>{st.n}</b> {st.name}
            {st.stat && <span className="sop-stat">{st.stat}</span>}
            {st.warn > 0 && <span className="sop-warn"><TriangleAlert size={11} /> {st.warnText}</span>}
          </button>
        </span>
      ))}
    </div>
  )
}
