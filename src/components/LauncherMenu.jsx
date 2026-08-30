import { useStore } from '../store/StoreContext.jsx'
import { sopStats } from '../lib/sop.js'
import { PencilRuler, Mic, ListChecks, LayoutTemplate, Table2, FileText, Workflow, FileInput, Plus, TriangleAlert } from 'lucide-react'

// 目錄選單：進 app 先選「要做哪件事」— 手機一格一格點，訪談是獨立大入口
export default function LauncherMenu({ onGo }) {
  const { state, current, dispatch } = useStore()
  const s = sopStats(current)

  const tiles = [
    { key: 'interview', name: '訪談記卡', desc: '客戶面前快速記需求（語音 / chips）', Icon: Mic, stat: `${s.reqs} 卡`, primary: true },
    { key: 'requirements', name: '需求整理', desc: '清單、分類、覆蓋檢查', Icon: ListChecks, stat: `${s.reqs} 項`, warn: s.missingPages ? `${s.missingPages} 需求無頁` : '' },
    { key: 'wireframe', name: 'Wireframe', desc: '畫面設計與匯入', Icon: LayoutTemplate, stat: `${s.wfs} 頁` },
    { key: 'fields', name: '欄位規格', desc: '欄位、規則、字典', Icon: Table2, stat: `${s.fields} 欄`, warn: (s.fieldWarns + s.unregistered) > 0 ? `${s.fieldWarns + s.unregistered} 待處理` : '' },
    { key: 'flow', name: '流程設計', desc: '業務流程圖', Icon: Workflow, stat: `${s.flowNodes} 節點` },
    { key: 'spec', name: '規格文件', desc: '交付給 RD 的文件', Icon: FileText, stat: '' },
    { key: 'import', name: '匯入報價單', desc: '從報價單起一個專案', Icon: FileInput, stat: '' },
  ]

  return (
    <div className="lm-wrap">
      <div className="lm-head">
        <span className="lm-logo"><PencilRuler size={22} /> Wireplan</span>
        <div className="spacer" />
        <select className="lm-proj" value={state.currentId} onChange={(e) => dispatch({ type: 'SET_CURRENT', id: e.target.value })}>
          {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="ghost sm" title="新增專案" onClick={() => dispatch({ type: 'NEW_PROJECT' })}><Plus size={16} /></button>
      </div>
      <div className="lm-grid">
        {tiles.map((t) => (
          <button key={t.key} className={'lm-tile' + (t.primary ? ' primary' : '')} onClick={() => onGo(t.key)}>
            <t.Icon size={t.primary ? 30 : 24} />
            <span className="lm-name">{t.name}</span>
            <span className="lm-desc">{t.desc}</span>
            <span className="lm-meta">
              {t.stat && <span className="lm-stat">{t.stat}</span>}
              {t.warn && <span className="lm-warn"><TriangleAlert size={11} /> {t.warn}</span>}
            </span>
          </button>
        ))}
      </div>
      <div className="lm-foot muted">手機可把本頁加到主畫面；「訪談記卡」可用網址 #interview 直達。</div>
    </div>
  )
}
