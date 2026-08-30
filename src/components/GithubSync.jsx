import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/StoreContext.jsx'
import { loadGhConfig, saveGhConfig, ghPull, ghPush } from '../lib/github.js'
import { X, UploadCloud, DownloadCloud, ShieldCheck } from 'lucide-react'

// GitHub 同步面板：把所有專案存進使用者自己的私人 repo（wireplan-data.json），
// 換裝置 / 手機↔電腦 都能推上去、拉回來。token 只存本機 localStorage。
export default function GithubSync({ onClose }) {
  const { state, dispatch } = useStore()
  const saved = loadGhConfig()
  const [repo, setRepo] = useState(saved.repo || '')
  const [token, setToken] = useState(saved.token || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(saved.lastSyncAt ? `上次同步：${new Date(saved.lastSyncAt).toLocaleString('zh-TW')}` : '')

  const cfg = () => {
    const c = { ...saved, repo: repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, ''), token: token.trim() }
    saveGhConfig(c)
    return c
  }
  const push = async () => {
    setBusy(true); setMsg('上傳中…')
    try {
      const c = cfg()
      await ghPush(c, { app: 'wireplan', savedAt: Date.now(), projects: state.projects, library: state.library })
      saveGhConfig({ ...c, lastSyncAt: Date.now() })
      dispatch({ type: 'MARK_BACKUP' })
      setMsg(`已上傳 ${state.projects.length} 個專案 ✓`)
    } catch (e) { setMsg('上傳失敗：' + e.message) }
    setBusy(false)
  }
  const pull = async () => {
    setBusy(true); setMsg('拉回中…')
    try {
      const c = cfg()
      const r = await ghPull(c)
      if (!r) { setMsg('repo 上還沒有資料檔 — 先按「上傳」建立'); setBusy(false); return }
      for (const p of r.data.projects || []) dispatch({ type: 'LOAD_PROJECT', project: p })
      for (const [field, value] of Object.entries(r.data.library || {})) dispatch({ type: 'UPDATE_LIBRARY', field, value })
      saveGhConfig({ ...c, lastSyncAt: Date.now() })
      setMsg(`已拉回 ${(r.data.projects || []).length} 個專案（同 id 覆蓋、新 id 加入）✓`)
    } catch (e) { setMsg('拉回失敗：' + e.message) }
    setBusy(false)
  }
  const ready = repo.trim() && token.trim()

  return createPortal(
    <div className="gh-backdrop" onClick={onClose}>
      <div className="gh-panel" onClick={(e) => e.stopPropagation()}>
        <div className="gh-head">
          <strong>GitHub 同步</strong>
          <div className="spacer" />
          <button className="rd-back" onClick={onClose}><X size={16} /></button>
        </div>
        <label className="gh-field"><span>私人 repo（owner/名稱）</span>
          <input value={repo} placeholder="例如 kulas-isin/wireplan-data" onChange={(e) => setRepo(e.target.value)} />
        </label>
        <label className="gh-field"><span>Fine-grained token（只給該 repo 的 Contents 讀寫）</span>
          <input type="password" value={token} placeholder="github_pat_…" onChange={(e) => setToken(e.target.value)} />
        </label>
        <div className="gh-note"><ShieldCheck size={13} /> token 只存這台裝置的瀏覽器，不會寫進專案資料或分享檔。請務必用「私人」repo — 需求資料含客戶內容。</div>
        <div className="gh-btns">
          <button className="tg-big primary" disabled={!ready || busy} onClick={push}><UploadCloud size={15} /> 上傳到 GitHub</button>
          <button className="tg-big" disabled={!ready || busy} onClick={pull}><DownloadCloud size={15} /> 從 GitHub 拉回</button>
        </div>
        {msg && <div className="gh-msg">{msg}</div>}
        <div className="gh-help muted">
          第一次設定：GitHub → Settings → Developer settings → Fine-grained tokens → 新增，Repository access 只勾資料 repo，Permissions 給 Contents「Read and write」。
        </div>
      </div>
    </div>,
    document.body
  )
}
