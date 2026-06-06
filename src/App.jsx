import { useRef, useState } from 'react'
import { useStore } from './store/StoreContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import ImportPanel from './components/ImportPanel.jsx'
import RequirementsEditor from './components/RequirementsEditor.jsx'
import WireframeBoard from './components/WireframeBoard.jsx'
import SpecView from './components/SpecView.jsx'
import FlowView from './components/FlowView.jsx'
import { downloadText, readFileAsText } from './lib/download.js'
import { Upload, Download, FileInput, ListChecks, LayoutTemplate, FileText, Workflow } from 'lucide-react'

const TABS = [
  { key: 'import', label: '匯入', Icon: FileInput },
  { key: 'requirements', label: '需求', Icon: ListChecks },
  { key: 'wireframe', label: 'Wireframe', Icon: LayoutTemplate },
  { key: 'spec', label: '規格文件', Icon: FileText },
  { key: 'flow', label: '流程設計', Icon: Workflow },
]

export default function App() {
  const { current, dispatch } = useStore()
  const [tab, setTab] = useState('import')
  const [toast, setToast] = useState('')
  const importRef = useRef(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  function exportProject() {
    downloadText(`${current.name}.wireplan.json`, JSON.stringify(current, null, 2), 'application/json')
  }

  async function importProject(file) {
    if (!file) return
    try {
      const text = await readFileAsText(file)
      const proj = JSON.parse(text)
      dispatch({ type: 'LOAD_PROJECT', project: proj })
      showToast('已匯入專案')
    } catch (e) {
      showToast('專案檔解析失敗')
    }
  }

  const counts = {
    requirements: current.requirements.length,
    wireframe: current.wireframes.length,
    flow: (current.flow?.nodes || []).filter((n) => n.type === 'screen' || n.type === 'decision').length,
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <input
            className="proj-name"
            value={current.name}
            onChange={(e) => dispatch({ type: 'RENAME_PROJECT', name: e.target.value })}
          />
          <span className="meta">最後更新：{new Date(current.updatedAt).toLocaleString('zh-TW')}</span>
          <div className="spacer" />
          <button onClick={() => importRef.current?.click()}><Upload size={15} /> 匯入專案</button>
          <button onClick={exportProject}><Download size={15} /> 匯出專案</button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => importProject(e.target.files[0])}
          />
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <div key={t.key} className={'tab' + (tab === t.key ? ' active' : '')} onClick={() => setTab(t.key)}>
              <t.Icon size={15} /> {t.label}
              {counts[t.key] != null && counts[t.key] > 0 && <span className="badge">{counts[t.key]}</span>}
            </div>
          ))}
        </div>

        <div className="content">
          {tab === 'import' && <ImportPanel onDone={() => { setTab('requirements'); showToast('已匯入需求並產生 wireframe / 流程') }} />}
          {tab === 'requirements' && <RequirementsEditor />}
          {tab === 'wireframe' && <WireframeBoard />}
          {tab === 'spec' && <SpecView />}
          {tab === 'flow' && <FlowView />}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
