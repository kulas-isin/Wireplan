// 需求異動：影響連鎖比對（需求 → 頁面 → 欄位 → 流程節點）
const core = (l) => String(l || '')
  .replace(/^[wWＷ]?\s*[.\d]+[a-zA-Z]?\s*/, '').replace(/[（(【[].*?[）)】\]]/g, '').replace(/\s+/g, '').trim()
const hit = (a, b) => a && b && (a.includes(b) || b.includes(a))

export function impactOf(project, req) {
  const k = core(req.screen || req.name)
  const items = []
  const seen = new Set()
  const push = (it) => { if (!seen.has(it.key)) { seen.add(it.key); items.push(it) } }

  // 1) 精準連結：由此需求產生的頁面帶 requirementId，改名也不會斷
  const linked = (project.wireframes || []).filter((w) => w.requirementId === req.id)
  for (const w of linked) push({ kind: '頁面', label: w.name, key: 'wf:' + w.id, done: false, via: 'link' })

  // 2) 名稱推測（補手動建立的頁面）
  const guessed = (project.wireframes || []).filter((w) => w.requirementId !== req.id && hit(core(w.name), k))
  for (const w of guessed) push({ kind: '頁面', label: w.name, key: 'wf:' + w.id, done: false, via: 'guess' })

  const linkedIds = new Set(linked.map((w) => w.id))
  const allWfs = [...linked, ...guessed]
  const wfIds = new Set(allWfs.map((w) => w.id))
  const wfNames = new Set(allWfs.map((w) => w.name))
  for (const f of project.fields || []) {
    const byRef = f.ref?.wfId && wfIds.has(f.ref.wfId)
    if (byRef || wfNames.has(f.mapping?.wf)) {
      push({ kind: '欄位', label: f.label, key: 'fld:' + f._k, done: false, via: byRef && linkedIds.has(f.ref.wfId) ? 'link' : 'guess' })
    }
  }
  const nodes = project.flow?.graph?.nodes || project.flow?.nodes || []
  for (const n of nodes) {
    const lbl = n.data?.label || n.label || ''
    if (hit(core(lbl), k)) push({ kind: '流程', label: lbl, key: 'flow:' + n.id, done: false, via: 'guess' })
  }
  return items
}

export function changeMessage(req) {
  const p = req.pending || {}
  const byKind = {}
  for (const it of p.impact || []) byKind[it.kind] = (byKind[it.kind] || 0) + 1
  const scope = Object.entries(byKind).map(([k, n]) => `${k}×${n}`).join('、') || '待評估'
  return [
    `【需求異動確認】${req.name}`,
    `異動內容：${p.note || ''}`,
    `影響範圍：${scope}`,
    '',
    '請回覆「確認」，我們就依此調整，謝謝！',
  ].join('\n')
}

// 已確認且無進行中異動 = 鎖定（要改請先拆封）
export const isLocked = (r) => ((r?.versions || []).length > 0) && !r?.pending
