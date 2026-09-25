import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/StoreContext.jsx'
import { loadGhConfig, saveGhConfig, ghAutoOn, ghFetch, ghWrite } from '../lib/github.js'
import { setSyncStatus, useSyncStatus, localDirty, hasAnyData, payloadOf, summarize, fmt } from '../lib/ghSync.js'
import { downloadText } from '../lib/download.js'
import { CloudOff, Download, Smartphone, Cloud } from 'lucide-react'

// 自動同步引擎。掛在 StoreProvider 底下、所有畫面之外，一直活著。
//
// 什麼時候動：
//   開啟 app／回到前景／恢復連線 → 看遠端有沒有別台推過的
//   本機改動後 3 秒 → 推上去；離開前景時立刻推
// 怎麼判斷衝突：遠端 sha ≠ 本機記的 baseSha，而且本機從上次同步後也改過 → 停下來問人。
// 不會自己決定誰贏。
const DEBOUNCE = 3000

export default function GithubAutoSync() {
  const { state, dispatch } = useStore()
  const stateRef = useRef(state); stateRef.current = state
  const busy = useRef(false)
  const timer = useRef(null)
  const pendingPush = useRef(false)
  const [conflict, setConflict] = useState(null) // { remote:{data,sha,savedAt}, reason }
  const sync = useSyncStatus()
  const conflictRef = useRef(null); conflictRef.current = conflict

  const cfg = () => loadGhConfig()
  const enabled = () => ghAutoOn(cfg())

  // 套用遠端：同 id 取代、新 id 加入（本機多出來的專案留著，下一輪推上去）
  const applyRemote = (remote) => {
    const c = cfg()
    dispatch({ type: 'APPLY_REMOTE', projects: remote.data.projects || [], library: remote.data.library || {} })
    saveGhConfig({ ...c, baseSha: remote.sha, lastSyncAt: Date.now(), lastError: '' })
    setSyncStatus({ status: 'idle', at: Date.now(), msg: '' })
    // 本機有遠端沒有的專案 → 排一次推
    const remoteIds = new Set((remote.data.projects || []).map((p) => p.id))
    if ((stateRef.current.projects || []).some((p) => !remoteIds.has(p.id))) schedulePush()
  }

  // 兩邊內容其實一樣（同一台的 PWA 與 Safari、或上次推成功但 sha 沒存到）→ 不算衝突，直接接受雲端的 sha
  const sameContent = (remote) => {
    const strip = (list) => (list || []).map(({ updatedAt, ...p }) => p)   // 只差 updatedAt 也算一樣
    try { return JSON.stringify(strip(remote?.data?.projects)) === JSON.stringify(strip(stateRef.current.projects)) } catch { return false }
  }

  const pendingForce = useRef(false)
  const push = async (force = false) => {
    if (!enabled() || busy.current) { if (busy.current) { pendingPush.current = true; if (force) pendingForce.current = true } return }
    if (conflictRef.current && !force) return
    busy.current = true
    setSyncStatus({ status: 'syncing', msg: '' })
    try {
      const c = cfg()
      const head = await ghFetch(c)
      if (!force && head && c.baseSha && head.sha !== c.baseSha) {
        if (sameContent(head)) {
          saveGhConfig({ ...c, baseSha: head.sha, lastSyncAt: Date.now(), lastError: '' })
          setSyncStatus({ status: 'idle', at: Date.now(), msg: '' })
          return
        }
        // 我以為的現況不是現況：別台推過。本機也改過（不然不會走到 push）→ 問人
        setConflict({ remote: head, reason: 'push' })
        setSyncStatus({ status: 'conflict', msg: '' })
        return
      }
      const newSha = await ghWrite(c, payloadOf(stateRef.current), head?.sha || null)
      saveGhConfig({ ...c, baseSha: newSha, lastSyncAt: Date.now(), lastError: '' })
      dispatch({ type: 'MARK_BACKUP' })
      setConflict(null)
      setSyncStatus({ status: 'idle', at: Date.now(), msg: '' })
    } catch (e) {
      saveGhConfig({ ...cfg(), lastError: e.message })
      setSyncStatus({ status: 'error', msg: e.message })
    } finally {
      busy.current = false
      // 衝突視窗按「用這台的」時若剛好在忙，不能丟掉：忙完立刻補推（保留 force）
      if (pendingForce.current) { pendingForce.current = false; pendingPush.current = false; push(true) }
      else if (pendingPush.current) { pendingPush.current = false; schedulePush() }
    }
  }

  const schedulePush = () => {
    if (!enabled()) return
    clearTimeout(timer.current)
    setSyncStatus({ status: conflictRef.current ? 'conflict' : 'pending' })
    timer.current = setTimeout(() => push(false), DEBOUNCE)
  }
  const flushPush = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; push(false) } }

  // 看遠端：開啟、回前景、恢復連線
  const checkRemote = async () => {
    if (!enabled() || busy.current || conflictRef.current) return
    busy.current = true
    setSyncStatus({ status: 'syncing' })
    try {
      const c = cfg()
      const remote = await ghFetch(c)
      const dirty = localDirty(stateRef.current, c.lastSyncAt)
      if (!remote) {
        // 雲端還沒有檔：本機有東西就建，沒有就等
        busy.current = false
        if (hasAnyData(stateRef.current)) await push(true)
        else setSyncStatus({ status: 'idle', at: c.lastSyncAt || null })
        return
      }
      if (remote.sha === c.baseSha) {
        busy.current = false
        if (dirty) await push(false)             // 上次沒推成功的，補推
        else setSyncStatus({ status: 'idle', at: c.lastSyncAt || null, msg: '' })
        return
      }
      // 遠端變了
      if (!c.baseSha && !hasAnyData(stateRef.current)) { applyRemote(remote); return }   // 新裝置第一次：直接拿雲端的
      if (!dirty) { applyRemote(remote); return }
      if (sameContent(remote)) {   // 內容一樣只是 sha 沒對上：接受，不問人
        saveGhConfig({ ...c, baseSha: remote.sha, lastSyncAt: Date.now(), lastError: '' })
        setSyncStatus({ status: 'idle', at: Date.now(), msg: '' })
        return
      }
      setConflict({ remote, reason: 'open' })
      setSyncStatus({ status: 'conflict', msg: '' })
    } catch (e) {
      saveGhConfig({ ...cfg(), lastError: e.message })
      setSyncStatus({ status: 'error', msg: e.message })
    } finally { busy.current = false }
  }

  // 生命週期
  useEffect(() => {
    if (!enabled()) { setSyncStatus({ status: 'off' }); return }
    checkRemote()
    const onVis = () => { if (document.visibilityState === 'visible') checkRemote(); else flushPush() }
    const onOnline = () => checkRemote()
    const onHide = () => flushPush()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('online', onOnline)
    window.addEventListener('pagehide', onHide)
    window.addEventListener('wp-gh-config', onOnline) // 設定面板存完會發這個
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('pagehide', onHide)
      window.removeEventListener('wp-gh-config', onOnline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 本機改動 → 排推。用 updatedAt 判斷，剛從雲端套用的不算改動
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    if (!enabled()) return
    if (localDirty(state, cfg().lastSyncAt)) schedulePush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.projects, state.library])

  if (!conflict) return null

  const local = summarize(state.projects)
  const remote = summarize(conflict.remote.data.projects || [])
  const byId = new Map(remote.map((p) => [p.id, p]))
  const rows = local.map((l) => ({ l, r: byId.get(l.id) }))
    .concat(remote.filter((r) => !local.some((l) => l.id === r.id)).map((r) => ({ l: null, r })))

  const useLocal = async () => { await push(true) }
  const useRemote = () => { applyRemote(conflict.remote); setConflict(null) }
  const working = sync.status === 'syncing'
  const exportLocal = () => downloadText(`wireplan-本機備份-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payloadOf(state), null, 2), 'application/json')

  return createPortal(
    <div className="gh-backdrop">
      <div className="gh-panel gh-conflict" onClick={(e) => e.stopPropagation()}>
        <div className="gh-head"><CloudOff size={17} /><strong>兩邊都改過，要留哪一邊？</strong></div>
        <p className="gh-conflict-lead">
          雲端在 {fmt(conflict.remote.savedAt)} 被另一台裝置更新過，而這台也有上次同步後的改動。
          我不會自己決定，選一個：
        </p>
        <table className="gh-cmp">
          <thead><tr><th>專案</th><th><Smartphone size={12} /> 這台最後改</th><th><Cloud size={12} /> 雲端最後改</th></tr></thead>
          <tbody>
            {rows.map(({ l, r }) => (
              <tr key={(l || r).id}>
                <td>{(l || r).name}<div className="muted">{(l || r).n}</div></td>
                <td className={l && r && l.updatedAt > r.updatedAt ? 'newer' : ''}>{l ? fmt(l.updatedAt) : '（沒有）'}</td>
                <td className={l && r && r.updatedAt > l.updatedAt ? 'newer' : ''}>{r ? fmt(r.updatedAt) : '（沒有）'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="gh-conflict-btns">
          <button className="tg-big primary" disabled={working} onClick={useLocal}><Smartphone size={15} /> {working ? '上傳中…' : '用這台的，覆蓋雲端'}</button>
          <button className="tg-big" disabled={working} onClick={useRemote}><Cloud size={15} /> 用雲端的，丟掉這台的改動</button>
          <button className="ghost sm" onClick={exportLocal}><Download size={14} /> 先把這台匯出備份</button>
        </div>
        {sync.status === 'error' && <div className="gh-conflict-err">上傳失敗：{sync.msg || '未知錯誤'}。可以再按一次，或先匯出備份。</div>}
        <div className="gh-help muted">「覆蓋雲端」會把另一台的改動蓋掉，那台下次開啟會拿到這台的版本。不確定就先匯出備份再選。</div>
      </div>
    </div>,
    document.body,
  )
}
