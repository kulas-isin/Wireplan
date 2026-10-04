// 定案圖：demo 產出的線框 PNG，放在私人 repo（通常就是客戶的 projects-data），Wireplan 用同步用的 token 讀回來，
// 顯示在頁面規格旁邊。圖本身不進 localStorage（一套就 7–8 MB），快取在 IndexedDB；專案只存清單（檔名、sha、看見時間）。
//
// project.finalArt = { repo, branch, path, items: { [code]: [{ name, path, sha, size, seenAt }] }, fetchedAt }
// 檔名對頁面：開頭的頁面編號（P3-02、M3-01-2…），後面接 _ 或 .；同一編號多張＝不同狀態（新增空白、複製帶入…）。
import { loadGhConfig } from './github.js'

const CODE_RE = /^([PM]\d+-\d+(?:-\d+)?)(?:[._](.*))?\.(png|jpe?g|webp)$/i

export const codeOfFile = (name) => (CODE_RE.exec(name) || [])[1] || null
export const variantOfFile = (name) => {
  const m = CODE_RE.exec(name)
  if (!m || !m[2]) return ''
  return m[2].replace(/_/g, ' ').trim()
}

export const artSource = (project) => {
  const fa = project?.finalArt || {}
  const gh = loadGhConfig()
  return { repo: (fa.repo || gh.repo || '').trim(), branch: (fa.branch || gh.branch || 'main').trim(), path: (fa.path || '').trim().replace(/^\/+|\/+$/g, '') }
}
export const artConfigured = (project) => { const s = artSource(project); return !!(s.repo && s.path && loadGhConfig().token) }
export const artItems = (project, code) => (code && project?.finalArt?.items?.[code]) || []
export const artCount = (project) => Object.keys(project?.finalArt?.items || {}).length
// 圖「看見」之後頁面又被改過 → 圖可能過期
export const artStale = (wf, items) => !!(wf?.updatedAt && items.length && items.every((it) => (it.seenAt || 0) < wf.updatedAt))

const api = (repo, p, branch) => `https://api.github.com/repos/${repo}/contents/${p.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`
const explain = (res) => res.status === 404 ? '找不到資料夾或 repo（路徑、分支對嗎？）' : res.status === 401 ? 'Token 無效或過期' : res.status === 403 ? 'Token 沒有這個 repo 的讀取權限' : `GitHub 回 ${res.status}`

// 讀資料夾清單，依頁面編號分組；sha 沒變的保留原本的 seenAt
export async function listFinalArt(project) {
  const src = artSource(project)
  const token = loadGhConfig().token
  if (!src.repo || !src.path) throw new Error('請先填 repo 與資料夾路徑')
  if (!token) throw new Error('請先在 GitHub 同步設定 token')
  const res = await fetch(api(src.repo, src.path, src.branch), { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } })
  if (!res.ok) throw new Error(explain(res))
  const arr = await res.json()
  if (!Array.isArray(arr)) throw new Error('路徑不是資料夾')
  const prev = project.finalArt?.items || {}
  const now = Date.now()
  const items = {}
  const unmatched = []
  for (const f of arr) {
    if (f.type !== 'file') continue
    const code = codeOfFile(f.name)
    if (!code) { if (/\.(png|jpe?g|webp)$/i.test(f.name)) unmatched.push(f.name); continue }
    const old = (prev[code] || []).find((x) => x.name === f.name)
    const it = { name: f.name, path: f.path, sha: f.sha, size: f.size, seenAt: old && old.sha === f.sha ? old.seenAt : now, ...(old?.note ? { note: old.note } : {}) }
    ;(items[code] = items[code] || []).push(it)
  }
  for (const k of Object.keys(items)) items[k].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
  return { finalArt: { ...src, items, fetchedAt: now }, unmatched, total: Object.values(items).reduce((n, a) => n + a.length, 0) }
}

// ── IndexedDB 快取（key＝blob sha；同一張圖內容不變就不再下載）──
let dbp = null
function db() {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no idb'))
    const r = indexedDB.open('wireplan-art', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('blobs')
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
  return dbp
}
const idbGet = (sha) => db().then((d) => new Promise((res) => { const t = d.transaction('blobs').objectStore('blobs').get(sha); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null) })).catch(() => null)
const idbPut = (sha, blob) => db().then((d) => new Promise((res) => { const t = d.transaction('blobs', 'readwrite').objectStore('blobs').put(blob, sha); t.oncomplete = () => res(true); t.onerror = () => res(false) })).catch(() => false)

const urlCache = new Map() // sha → objectURL（這次開啟期間）
const inflight = new Map()

export async function artUrl(project, item) {
  if (urlCache.has(item.sha)) return urlCache.get(item.sha)
  if (inflight.has(item.sha)) return inflight.get(item.sha)
  const p = (async () => {
    let blob = await idbGet(item.sha)
    if (!blob) {
      const src = artSource(project)
      const token = loadGhConfig().token
      const res = await fetch(api(src.repo, item.path, src.branch), { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw+json' } })
      if (!res.ok) throw new Error(explain(res))
      blob = await res.blob()
      idbPut(item.sha, blob)
    }
    const u = URL.createObjectURL(blob)
    urlCache.set(item.sha, u)
    return u
  })()
  inflight.set(item.sha, p)
  try { return await p } finally { inflight.delete(item.sha) }
}

// 手動上傳／更新一張圖（Figma 改完匯出的 PNG）：直接寫進 repo 資料夾，同名就覆蓋（帶舊 sha）
const b64 = (buf) => { let bin = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) bin += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(bin) }
export async function uploadArt(project, file, name) {
  const src = artSource(project)
  const token = loadGhConfig().token
  if (!src.repo || !src.path) throw new Error('請先在同步設定填定案圖的 repo 與資料夾')
  if (!token) throw new Error('請先設定同步 token')
  const path = `${src.path}/${name}`
  const h = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
  let sha = null
  const cur = await fetch(api(src.repo, path, src.branch), { headers: h })
  if (cur.ok) sha = (await cur.json()).sha || null
  const buf = await file.arrayBuffer()
  const res = await fetch(`https://api.github.com/repos/${src.repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `定案圖 ${name} ${new Date().toLocaleString('zh-TW')}`, content: b64(buf), branch: src.branch, ...(sha ? { sha } : {}) }),
  })
  if (!res.ok) throw new Error(res.status === 403 ? 'Token 沒有這個 repo 的寫入權限' : explain(res))
  const j = await res.json()
  const item = { name, path, sha: j?.content?.sha || sha, size: buf.byteLength, seenAt: Date.now() }
  const blob = new Blob([buf], { type: file.type || 'image/png' })
  idbPut(item.sha, blob)
  if (urlCache.has(item.sha)) URL.revokeObjectURL(urlCache.get(item.sha))
  urlCache.set(item.sha, URL.createObjectURL(blob))
  return item
}
// 從 repo 刪一張
export async function deleteArt(project, item) {
  const src = artSource(project)
  const token = loadGhConfig().token
  const res = await fetch(`https://api.github.com/repos/${src.repo}/contents/${item.path.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'DELETE', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `移除定案圖 ${item.name}`, sha: item.sha, branch: src.branch }),
  })
  if (!res.ok && res.status !== 404) throw new Error(explain(res))
}
// 檔名：有編號照用；沒有就補上目前頁的編號
export const nameForUpload = (fileName, code) => {
  const clean = fileName.replace(/[\\/:*?"<>|]/g, '_')
  return codeOfFile(clean) ? clean : `${code}_${clean}`
}
// 清單更新：同名取代、新名附加；items 外的欄位（note）保留
export function upsertItems(project, code, item) {
  const fa = project.finalArt || {}
  const list = [...(fa.items?.[code] || [])]
  const i = list.findIndex((x) => x.name === item.name)
  if (i >= 0) list[i] = { ...list[i], ...item }; else list.push(item)
  list.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
  return { ...fa, items: { ...(fa.items || {}), [code]: list } }
}
export function patchItem(project, code, name, patch) {
  const fa = project.finalArt || {}
  return { ...fa, items: { ...(fa.items || {}), [code]: (fa.items?.[code] || []).map((x) => (x.name === name ? { ...x, ...patch } : x)) } }
}
export function removeItem(project, code, name) {
  const fa = project.finalArt || {}
  const list = (fa.items?.[code] || []).filter((x) => x.name !== name)
  const items = { ...(fa.items || {}) }
  if (list.length) items[code] = list; else delete items[code]
  return { ...fa, items }
}

export const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) : '')
