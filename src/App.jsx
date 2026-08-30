import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useStore } from './store/StoreContext.jsx'
import Sidebar from './components/Sidebar.jsx'
import SopBar from './components/SopBar.jsx'
import LauncherMenu from './components/LauncherMenu.jsx'
import InterviewMode from './components/InterviewMode.jsx'
import TriageGame from './components/TriageGame.jsx'
import ImportPanel from './components/ImportPanel.jsx'
import RequirementsEditor from './components/RequirementsEditor.jsx'
import SpecView from './components/SpecView.jsx'
// Wireframe 用到 Ant Design，延遲載入避免進主包
const WireframeBoard = lazy(() => import('./components/WireframeBoard.jsx'))
// 流程畫布用到 reactflow，延遲載入
const FlowCanvas = lazy(() => import('./components/FlowCanvas.jsx'))
import FieldSpec from './components/FieldSpec.jsx'
import { downloadText, readFileAsText } from './lib/download.js'
import { Upload, Download, FileInput, ListChecks, LayoutTemplate, FileText, Workflow, Undo2, Redo2, Maximize2, Minimize2, Table2, LayoutGrid } from 'lucide-react'

const TABS = [
  { key: 'import', label: '匯入', Icon: FileInput },
  { key: 'requirements', label: '需求', Icon: ListChecks },
  { key: 'wireframe', label: 'Wireframe', Icon: LayoutTemplate },
  { key: 'fields', label: '欄位規格', Icon: Table2 },
  { key: 'spec', label: '規格文件', Icon: FileText },
  { key: 'flow', label: '流程設計', Icon: Workflow },
]

export default function App() {
  const { current, dispatch, undo, redo, canUndo, canRedo } = useStore()
  const [tab, setTab] = useState('import')
  // 目錄選單為預設入口；#interview 直達訪談（手機加入主畫面可當獨立 App 用）
  const [view, setView] = useState(() => (window.location.hash === '#interview' ? 'interview' : window.location.hash === '#triage' ? 'triage' : 'menu'))
  const [focus, setFocus] = useState(false)
  const [toast, setToast] = useState('')
  const importRef = useRef(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2200)
  }

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === '#interview') setView('interview')
      else if (window.location.hash === '#triage') setView('triage')
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (key) => {
    if (key === 'interview') { window.location.hash = 'interview'; setView('interview') }
    else { setTab(key); setView('workspace'); if (window.location.hash) history.replaceState(null, '', ' ') }
  }
  const backToMenu = () => { setView('menu'); if (window.location.hash) history.replaceState(null, '', ' ') }

  // 鍵盤快捷鍵：Ctrl/Cmd+Z 復原、Ctrl/Cmd+Shift+Z 或 Ctrl+Y 重做
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

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
    flow: ((current.flow?.graph?.nodes || current.flow?.nodes || []).filter((n) => n.type === 'page' || n.type === 'screen' || n.type === 'decision')).length,
  }

  const exitTriage = (dest) => {
    if (window.location.hash) history.replaceState(null, '', ' ')
    if (dest === 'requirements') { setTab('requirements'); setView('workspace') } else setView('menu')
  }

  if (view === 'menu') return <LauncherMenu onGo={go} />
  if (view === 'interview') return <InterviewMode onClose={() => ((current.requirements || []).length >= 2 ? (setView('triage'), window.location.hash = 'triage') : backToMenu())} />
  if (view === 'triage') return <TriageGame onExit={exitTriage} />

  return (
    <div className={'app' + (focus ? ' focus' : '')}>
      {!focus && <Sidebar />}
      <div className="main">
        {!focus && <div className="topbar">
          <input
            className="proj-name"
            value={current.name}
            onChange={(e) => dispatch({ type: 'RENAME_PROJECT', name: e.target.value })}
          />
          <span className="meta">最後更新：{new Date(current.updatedAt).toLocaleString('zh-TW')}</span>
          <div className="spacer" />
          <button className="ghost sm" title="復原 (Ctrl/Cmd+Z)" disabled={!canUndo} onClick={undo}><Undo2 size={16} /></button>
          <button className="ghost sm" title="重做 (Ctrl/Cmd+Shift+Z)" disabled={!canRedo} onClick={redo}><Redo2 size={16} /></button>
          <button onClick={() => importRef.current?.click()}><Upload size={15} /> 匯入專案</button>
          <button onClick={exportProject}><Download size={15} /> 匯出專案</button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => importProject(e.target.files[0])}
          />
        </div>}

        {!focus && <div className="tabs">
          {TABS.map((t) => (
            <div key={t.key} className={'tab' + (tab === t.key ? ' active' : '')} onClick={() => setTab(t.key)}>
              <t.Icon size={15} /> {t.label}
              {counts[t.key] != null && counts[t.key] > 0 && <span className="badge">{counts[t.key]}</span>}
            </div>
          ))}
          <div className="spacer" />
          <button className="focus-btn" title="回目錄選單" onClick={backToMenu}><LayoutGrid size={14} /> 目錄</button>
          <button className="focus-btn" title="專注模式（隱藏上方列，畫面最大化）" onClick={() => setFocus(true)}><Maximize2 size={14} /> 專注</button>
        </div>}

        {!focus && <SopBar tab={tab} setTab={setTab} />}

        <div className="content">
          {tab === 'import' && <ImportPanel onDone={() => { setTab('requirements'); showToast('已匯入需求並產生 wireframe / 流程') }} />}
          {tab === 'requirements' && <RequirementsEditor />}
          {tab === 'wireframe' && (
            <Suspense fallback={<div className="empty"><div className="muted">載入元件庫中…</div></div>}>
              <WireframeBoard />
            </Suspense>
          )}
          {tab === 'fields' && <FieldSpec />}
          {tab === 'spec' && <SpecView />}
          {tab === 'flow' && (
            <Suspense fallback={<div className="empty"><div className="muted">載入流程畫布中…</div></div>}>
              <FlowCanvas />
            </Suspense>
          )}
        </div>
      </div>

      {focus && (
        <button className="focus-exit" title="退出專注模式" onClick={() => setFocus(false)}><Minimize2 size={15} /> 退出專注</button>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
