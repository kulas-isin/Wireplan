import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/StoreContext.jsx'
import { artItems, artUrl, artStale, artSource, artConfigured, listFinalArt, variantOfFile, fmtDate, artCount, uploadArt, deleteArt, nameForUpload, upsertItems, patchItem, removeItem, importBatch, versionsOf, batchOf } from '../lib/finalArt.js'
import { loadGhConfig } from '../lib/github.js'
import { X, Image as ImageIcon, RefreshCw, Maximize2, TriangleAlert, Upload, Trash2, Pencil, StickyNote, History, FolderUp } from 'lucide-react'

// 一頁的定案圖：載入 URL、標過期
export function useFinalArt(wf) {
  const { current } = useStore()
  const items = artItems(current, wf?.code)
  const [urls, setUrls] = useState({})
  const [err, setErr] = useState('')
  const key = items.map((i) => i.sha).join(',')
  useEffect(() => {
    let alive = true
    setErr('')
    items.forEach((it) => {
      artUrl(current, it).then((u) => { if (alive) setUrls((m) => ({ ...m, [it.sha]: u })) })
        .catch((e) => { if (alive) setErr(e.message) })
    })
    return () => { alive = false }
  }, [key]) // eslint-disable-line
  return { items, urls, err, stale: artStale(wf, items), source: artSource(current) }
}

// 規格頁旁邊的定案圖區塊：看圖、上傳新圖、更新某張（Figma 改完再匯出）、刪除、每張可寫備註
export function FinalArtPanel({ wf, compact = false }) {
  const { current, dispatch } = useStore()
  const { items, urls, err, stale } = useFinalArt(wf)
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [noteOf, setNoteOf] = useState(null) // 正在編輯備註的 name
  const [noteTxt, setNoteTxt] = useState('')
  const addRef = useRef(null), replRef = useRef(null)
  const replTarget = useRef(null)
  const configured = artConfigured(current)
  if (!items.length && !configured) return null
  const setFA = (fa) => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'finalArt', value: fa })
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 3000) }
  const [verOf, setVerOf] = useState({}) // name → 正在看的版本 index
  const [oldOpen, setOldOpen] = useState(null) // { item, ver }
  const upload = async (files, forceName) => {
    const reason = (prompt(forceName ? '這次更新的原因（會記在版本履歷）' : '這張圖的說明／原因（選填）', '') ?? null)
    if (reason === null) return
    let fa = current.finalArt || {}
    for (const f of files) {
      const name = forceName || nameForUpload(f.name, wf.code)
      setBusy(name)
      try {
        const prevItem = (fa.items?.[wf.code] || []).find((x) => x.name === name) || null
        const it = await uploadArt({ ...current, finalArt: fa }, f, name, { reason, prevItem })
        fa = upsertItems({ ...current, finalArt: fa }, wf.code, it); setFA(fa); flash(`已上傳 ${name}`)
      } catch (e) { flash('上傳失敗：' + e.message); break }
    }
    setVerOf({}); setBusy('')
  }
  const remove = async (it) => {
    if (!confirm(`刪除定案圖「${it.name}」？repo 裡的檔案也會一併移除。`)) return
    setBusy(it.name)
    try { await deleteArt(current, it); setFA(removeItem(current, wf.code, it.name)); flash('已刪除') } catch (e) { flash('刪除失敗：' + e.message) }
    setBusy('')
  }
  const saveNote = (it) => { setFA(patchItem(current, wf.code, it.name, { note: noteTxt.trim() })); setNoteOf(null) }
  return (
    <div className={'fa-panel' + (compact ? ' compact' : '')}>
      <div className="fa-head">
        <ImageIcon size={13} /> 定案圖
        {items.length > 0 && <span className="ps-kind">{fmtDate(Math.max(...items.map((i) => i.seenAt || 0)))}</span>}
        {stale && <span className="fa-stale" title="圖匯入之後這頁的規格又改過，記得重出圖"><TriangleAlert size={11} /> 規格已在定案後修改</span>}
        <div className="spacer" />
        {configured && <button className="uf-sealbtn" disabled={!!busy} onClick={() => addRef.current?.click()}><Upload size={11} /> {items.length ? '加一張' : '上傳定案圖'}</button>}
        <input ref={addRef} type="file" accept="image/png,image/jpeg,image/webp" multiple style={{ display: 'none' }} onChange={(e) => { upload([...e.target.files]); e.target.value = '' }} />
        <input ref={replRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => { if (e.target.files[0] && replTarget.current) upload([e.target.files[0]], replTarget.current); e.target.value = '' }} />
      </div>
      {(err || msg || busy) && <div className={'fa-msg' + (err || /失敗/.test(msg) ? ' bad' : '')}>{busy ? `處理中：${busy}…` : (msg || `圖載入失敗：${err}`)}</div>}
      {!items.length && <div className="fa-empty">這頁還沒有定案圖。從 Figma 匯出 PNG 後按「上傳定案圖」，檔名有頁面編號會自動對上，沒有就用這頁的編號。</div>}
      <div className="fa-list">
        {items.map((it) => (
          <figure key={it.name} className="fa-fig">
            <div className="fa-img" onClick={() => urls[it.sha] && setOpen(it)}>
              {urls[it.sha] ? <img src={urls[it.sha]} alt={it.name} loading="lazy" /> : <div className="fa-ph">載入中…</div>}
              <span className="fa-zoom"><Maximize2 size={13} /></span>
            </div>
            <figcaption>
              <span className="fa-cap">{variantOfFile(it.name) || it.name}</span>
              <span className="fa-date">{fmtDate(it.seenAt)}</span>
              {versionsOf(it).length > 1 && (
                <span className="fa-vers" title="版本：點舊版可看圖與原因">
                  {versionsOf(it).map((v, i) => (
                    <button key={v.sha + i} className={'uf-vchip' + ((verOf[it.name] ?? versionsOf(it).length - 1) === i ? ' on' : '')}
                      onClick={() => setVerOf((m) => ({ ...m, [it.name]: i }))}>v{i + 1}</button>
                  ))}
                </span>
              )}
              <div className="spacer" />
              <button className="uw-mini" title="備註" onClick={() => { setNoteOf(noteOf === it.name ? null : it.name); setNoteTxt(it.note || '') }}><StickyNote size={12} /></button>
              {configured && <button className="uw-mini" title="用新圖取代這張（同檔名）" disabled={!!busy} onClick={() => { replTarget.current = it.name; replRef.current?.click() }}><Pencil size={12} /></button>}
              {configured && <button className="uw-mini uf-del" title="刪除" disabled={!!busy} onClick={() => remove(it)}><Trash2 size={12} /></button>}
            </figcaption>
            {(() => {
              const vs = versionsOf(it); const i = verOf[it.name] ?? vs.length - 1; const v = vs[i]
              if (vs.length <= 1 && !v?.reason) return null
              const b = v?.batchId ? batchOf(current, v.batchId) : null
              return (
                <div className={'fa-ver' + (i < vs.length - 1 ? ' old' : '')}>
                  <History size={11} /> v{i + 1}・{fmtDate(v.at)}{i < vs.length - 1 ? '（舊版）' : ''}
                  {v.reason ? `・${v.reason}` : ''}{b ? `・批次 ${fmtDate(b.at)}（${b.files.length} 張）` : ''}
                  {i < vs.length - 1 && <button className="uf-sealbtn" onClick={() => setOldOpen({ item: it, ver: v, i })}>看這版</button>}
                </div>
              )
            })()}
            {noteOf === it.name ? (
              <div className="fa-note-edit">
                <textarea rows={2} autoFocus value={noteTxt} placeholder="這張圖的備註（例：10/6 客戶要求把篩選移到右側）" onChange={(e) => setNoteTxt(e.target.value)} />
                <div className="qs-btns"><button className="uf-sealbtn" onClick={() => setNoteOf(null)}>取消</button><button className="uf-sealgo" onClick={() => saveNote(it)}>儲存備註</button></div>
              </div>
            ) : it.note ? <div className="fa-note" onClick={() => { setNoteOf(it.name); setNoteTxt(it.note) }}>{it.note}</div> : null}
          </figure>
        ))}
      </div>
      {open && <FinalArtLightbox src={urls[open.sha]} label={`${wf.code}　${variantOfFile(open.name) || wf.name}`} onClose={() => setOpen(null)} />}
      {oldOpen && <OldVersionLightbox project={current} item={oldOpen.item} ver={oldOpen.ver} label={`${wf.code}　${variantOfFile(oldOpen.item.name) || wf.name}　v${oldOpen.i + 1}（舊版${oldOpen.ver.reason ? '・' + oldOpen.ver.reason : ''}）`} onClose={() => setOldOpen(null)} />}
    </div>
  )
}

// 舊版本：用 sha 抓 blob 再開全螢幕
function OldVersionLightbox({ project, item, ver, label, onClose }) {
  const [src, setSrc] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { artUrl(project, { ...item, sha: ver.sha, current: false }).then(setSrc).catch((e) => setErr(e.message)) }, [ver.sha]) // eslint-disable-line
  if (err) return createPortal(<div className="fa-lb" onClick={onClose}><div className="fa-lb-head"><span>{label}</span><div className="spacer" /><button className="rd-back" onClick={onClose}><X size={16} /></button></div><div className="fa-msg bad" style={{ margin: 16 }}>舊版載入失敗：{err}</div></div>, document.body)
  if (!src) return createPortal(<div className="fa-lb"><div className="fa-lb-head"><span>{label}</span><div className="spacer" /><button className="rd-back" onClick={onClose}><X size={16} /></button></div><div className="fa-ph" style={{ color: '#EDF7CF' }}>載入舊版中…</div></div>, document.body)
  return <FinalArtLightbox src={src} label={label} onClose={onClose} />
}

// 全螢幕看圖：預設塞進螢幕，點一下切 1:1 可捲動；Esc 關
export function FinalArtLightbox({ src, label, onClose }) {
  const [full, setFull] = useState(false)
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [onClose])
  return createPortal(
    <div className="fa-lb" onClick={onClose}>
      <div className="fa-lb-head" onClick={(e) => e.stopPropagation()}>
        <span>{label}</span>
        <div className="spacer" />
        <button className="uf-sealbtn" onClick={() => setFull((f) => !f)}>{full ? '塞進螢幕' : '1 : 1'}</button>
        <button className="rd-back" onClick={onClose}><X size={16} /></button>
      </div>
      <div className={'fa-lb-body' + (full ? ' full' : '')} onClick={(e) => { e.stopPropagation(); setFull((f) => !f) }}>
        <img src={src} alt={label} />
      </div>
    </div>,
    document.body,
  )
}

// 設定：圖放在哪個 repo 的哪個資料夾；讀清單
export function FinalArtSettings() {
  const { current, dispatch } = useStore()
  const gh = loadGhConfig()
  const fa = current.finalArt || {}
  const [repo, setRepo] = useState(fa.repo || '')
  const [branch, setBranch] = useState(fa.branch || '')
  const [path, setPath] = useState(fa.path || '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const n = artCount(current)
  const save = () => {
    const next = { ...fa, repo: repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, ''), branch: branch.trim(), path: path.trim().replace(/^\/+|\/+$/g, '') }
    dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'finalArt', value: next })
    return next
  }
  const refresh = async () => {
    save()
    setBusy(true); setMsg('讀取清單中…')
    try {
      const r = await listFinalArt({ ...current, finalArt: { ...fa, repo, branch, path } })
      dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'finalArt', value: r.finalArt })
      const codes = new Set((current.wireframes || []).map((w) => w.code).filter(Boolean))
      const hit = Object.keys(r.finalArt.items).filter((c) => codes.has(c)).length
      const miss = Object.keys(r.finalArt.items).filter((c) => !codes.has(c))
      setMsg(`找到 ${r.total} 張、${Object.keys(r.finalArt.items).length} 個頁面編號；對到專案裡 ${hit} 頁` + (miss.length ? `，${miss.length} 個編號專案裡沒有（${miss.slice(0, 5).join('、')}${miss.length > 5 ? '…' : ''}）` : '') + (r.unmatched.length ? `；${r.unmatched.length} 張檔名沒有頁面編號，略過` : ''))
    } catch (e) { setMsg('讀取失敗：' + e.message) }
    setBusy(false)
  }
  return (
    <details className="gh-manual" open={!!fa.path}>
      <summary>定案圖來源（demo 產出的線框 PNG，顯示在頁面規格旁）{n ? `・${n} 頁` : ''}</summary>
      <label className="gh-field"><span>repo（留空＝同步用的 {gh.repo || '尚未設定'}）</span>
        <input value={repo} placeholder={gh.repo || 'owner/名稱'} onChange={(e) => setRepo(e.target.value)} />
      </label>
      <label className="gh-field"><span>資料夾路徑</span>
        <input value={path} placeholder="例如 chuchustyle-erp/04_素材/定案圖/商品管理" onChange={(e) => setPath(e.target.value)} />
      </label>
      <label className="gh-field"><span>分支（留空＝main）</span>
        <input value={branch} placeholder="main" onChange={(e) => setBranch(e.target.value)} />
      </label>
      <div className="gh-note"><ImageIcon size={13} /> 檔名開頭要是頁面編號（P3-02_商品新增.png、M3-01-2.png）；同一編號多張＝同一頁的不同狀態。圖只快取在這台裝置，不進專案資料。</div>
      <div className="gh-btns">
        <button className="tg-big primary" disabled={busy || !path.trim() || !(repo.trim() || gh.repo) || !gh.token} onClick={refresh}><RefreshCw size={15} /> 讀取清單{fa.fetchedAt ? `（上次 ${fmtDate(fa.fetchedAt)}）` : ''}</button>
      </div>
      {!gh.token && <div className="gh-msg">要先在上面設定同步 token，才讀得到私人 repo 的圖。</div>}
      {msg && <div className="gh-msg">{msg}</div>}
      <BatchImport disabled={busy || !path.trim() || !(repo.trim() || gh.repo) || !gh.token} onBeforeImport={save} />
    </details>
  )
}

// 大批匯入：選很多張（Figma 整批匯出），依檔名編號各自歸位；整批一個原因，記成一筆批次
function BatchImport({ disabled, onBeforeImport }) {
  const { current, dispatch } = useStore()
  const ref = useRef(null)
  const [reason, setReason] = useState('')
  const [prog, setProg] = useState('')
  const [report, setReport] = useState(null)
  const [openBatch, setOpenBatch] = useState(null)
  const batches = [...(current.finalArt?.batches || [])].reverse()
  const run = async (files) => {
    if (!files.length) return
    onBeforeImport && onBeforeImport()
    setReport(null)
    const r = await importBatch(current, files, reason.trim(), (n) => setProg(n))
    setProg('')
    dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'finalArt', value: r.finalArt })
    setReport(r); setReason('')
  }
  return (
    <div className="fa-batch">
      <div className="ht-title"><FolderUp size={12} /> 批次匯入</div>
      <input className="fa-reason" value={reason} placeholder="這批更新的原因（例：10/6 第 3 場後依決議修訂）" onChange={(e) => setReason(e.target.value)} />
      <div className="gh-btns">
        <button className="tg-big" disabled={disabled || !!prog} onClick={() => ref.current?.click()}><Upload size={15} /> 選檔案（可多選）</button>
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" multiple style={{ display: 'none' }} onChange={(e) => { run([...e.target.files]); e.target.value = '' }} />
      <div className="gh-help muted">檔名開頭要有頁面編號（P3-02_…png）才會歸位；同檔名會覆蓋成新版本，舊版仍可回看。</div>
      {prog && <div className="gh-msg">上傳中：{prog}</div>}
      {report && (
        <div className="gh-msg">
          完成 {report.done.length} 張（取代 {report.done.filter((d) => d.replaced).length}、新增 {report.done.filter((d) => !d.replaced).length}）
          {report.skipped.length > 0 && <>；略過 {report.skipped.length} 張沒有頁面編號：{report.skipped.slice(0, 4).join('、')}{report.skipped.length > 4 ? '…' : ''}</>}
          {report.failed.length > 0 && <><br />失敗：{report.failed.join('；')}</>}
        </div>
      )}
      {batches.length > 0 && (
        <div className="fa-batches">
          <div className="ht-title"><History size={12} /> 批次紀錄</div>
          {batches.map((b) => (
            <div key={b.id} className="fa-batch-row">
              <button className="fa-batch-head" onClick={() => setOpenBatch(openBatch === b.id ? null : b.id)}>
                <span className="fa-date">{new Date(b.at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                <span className="fa-batch-reason">{b.reason || '（沒寫原因）'}</span>
                <span className="ps-kind">{b.files.length} 張</span>
              </button>
              {openBatch === b.id && <div className="fa-batch-files">{b.files.map((f) => <span key={f.name}><b>{f.code}</b> {f.name}{f.replaced ? '（取代）' : '（新增）'}</span>)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export { artConfigured }
