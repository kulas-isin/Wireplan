// GitHub 同步：瀏覽器直接呼叫 GitHub REST API（有開 CORS），把專案 JSON 存進使用者自己的私人 repo。
// 設定（含 token）存在獨立的 localStorage key —— 絕不寫進專案資料，分享/匯出專案時不會外洩。
const KEY = 'wp-gh-sync'

export function loadGhConfig() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} }
}
export function saveGhConfig(cfg) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)) } catch { /* 私密模式等情況忽略 */ }
}

const PATH = 'wireplan-data.json'
const b64encode = (s) => btoa(unescape(encodeURIComponent(s)))
const b64decode = (s) => decodeURIComponent(escape(atob(String(s).replace(/\n/g, ''))))

async function api(cfg, method, body) {
  const branch = cfg.branch || 'main'
  const url = `https://api.github.com/repos/${cfg.repo}/contents/${PATH}` + (method === 'GET' ? `?ref=${branch}&t=${Date.now()}` : '')
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify({ ...body, branch }) : undefined,
  })
  if (res.status === 404) return null
  if (res.status === 401) throw new Error('Token 無效或過期 — 請重新產生')
  if (res.status === 403) throw new Error('Token 權限不足 — 需要該 repo 的 Contents 讀寫權限')
  if (res.status === 409) throw new Error('版本衝突 — 先「拉回」再上傳')
  if (!res.ok) throw new Error(`GitHub 回應 ${res.status}`)
  return res.json()
}

// 讀遠端資料：回 { data, sha }；檔案還不存在回 null
export async function ghPull(cfg) {
  const j = await api(cfg, 'GET')
  if (!j) return null
  return { data: JSON.parse(b64decode(j.content)), sha: j.sha }
}

// 寫遠端資料：自動帶上現有檔案的 sha（GitHub 更新必要）
export async function ghPush(cfg, dataObj) {
  const existing = await api(cfg, 'GET')
  await api(cfg, 'PUT', {
    message: `wireplan sync ${new Date().toLocaleString('zh-TW')}`,
    content: b64encode(JSON.stringify(dataObj, null, 1)),
    ...(existing ? { sha: existing.sha } : {}),
  })
}
