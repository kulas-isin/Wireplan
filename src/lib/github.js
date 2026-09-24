// GitHub 同步：瀏覽器直接呼叫 GitHub REST API（有開 CORS），把專案 JSON 存進使用者自己的私人 repo。
// 設定（含 token）存在獨立的 localStorage key —— 絕不寫進專案資料，分享/匯出專案時不會外洩。
//
// 版本標記用檔案的 blob sha：本機記住「上次同步時的 sha」（baseSha），
// 推之前先比對，遠端 sha 變了就代表別台裝置推過 → 交給上層判斷是套用還是衝突。
const KEY = 'wp-gh-sync'

export function loadGhConfig() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}
export function saveGhConfig(cfg) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)) } catch { /* 私密模式等情況忽略 */ }
}
export const ghConfigured = (cfg = loadGhConfig()) => !!(cfg.repo && cfg.token)
// 自動同步預設開；設定過的人可以關
export const ghAutoOn = (cfg = loadGhConfig()) => ghConfigured(cfg) && cfg.auto !== false

const PATH = 'wireplan-data.json'
const b64encode = (s) => btoa(unescape(encodeURIComponent(s)))
const b64decode = (s) => decodeURIComponent(escape(atob(String(s).replace(/\n/g, ''))))

function url(cfg, withRef) {
  const branch = cfg.branch || 'main'
  return `https://api.github.com/repos/${cfg.repo}/contents/${PATH}` + (withRef ? `?ref=${branch}&t=${Date.now()}` : '')
}
function explain(res) {
  if (res.status === 401) return 'Token 無效或過期 — 請重新產生'
  if (res.status === 403) return 'Token 權限不足 — 需要該 repo 的 Contents 讀寫權限'
  if (res.status === 409) return '版本衝突 — 遠端已被另一台裝置更新'
  if (res.status === 422) return 'GitHub 拒絕寫入（422）— 通常是 sha 對不上，先拉回'
  return `GitHub 回應 ${res.status}`
}

// 讀遠端：回 { data, sha, savedAt } ；檔案不存在回 null。
// 先用 object 型別拿 sha（超過 1MB 時 content 是空的、encoding 'none'），再視情況用 raw 拿內容。
export async function ghFetch(cfg) {
  const head = await fetch(url(cfg, true), {
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github.object+json' },
  })
  if (head.status === 404) return null
  if (!head.ok) throw new Error(explain(head))
  const meta = await head.json()
  let text
  if (meta.encoding === 'base64' && meta.content) text = b64decode(meta.content)
  else {
    const raw = await fetch(url(cfg, true), {
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github.raw+json' },
    })
    if (!raw.ok) throw new Error(explain(raw))
    text = await raw.text()
  }
  const data = JSON.parse(text)
  return { data, sha: meta.sha, savedAt: data?.savedAt || null }
}

// 寫遠端：sha 是「我以為的現況」。GitHub 會在 sha 對不上時回 409/422，這就是衝突偵測。
// 回新的 blob sha，存回 baseSha。
export async function ghWrite(cfg, dataObj, sha) {
  const res = await fetch(url(cfg, false), {
    method: 'PUT',
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `wireplan sync ${new Date().toLocaleString('zh-TW')}`,
      content: b64encode(JSON.stringify(dataObj, null, 1)),
      branch: cfg.branch || 'main',
      ...(sha ? { sha } : {}),
    }),
  })
  if (!res.ok) throw new Error(explain(res))
  const j = await res.json()
  return j?.content?.sha || null
}

// ── 舊介面（手動面板用）──
export async function ghPull(cfg) { return ghFetch(cfg) }
export async function ghPush(cfg, dataObj) {
  const cur = await ghFetch(cfg)
  return ghWrite(cfg, dataObj, cur?.sha)
}
