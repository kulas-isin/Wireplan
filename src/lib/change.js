// 需求異動：影響連鎖比對（需求 → 頁面 → 欄位 → 流程節點）
const core = (l) => String(l || '')
  .replace(/^[wWＷ]?\s*[.\d]+[a-zA-Z]?\s*/, '').replace(/[（(【[].*?[）)】\]]/g, '').replace(/\s+/g, '').trim()
const hit = (a, b) => a && b && (a.includes(b) || b.includes(a))

export function impactOf(project, req) {
  const k = core(req.screen || req.name)
  const items = []
  const wfs = (project.wireframes || []).filter((w) => hit(core(w.name), k))
  for (const w of wfs) items.push({ kind: '頁面', label: w.name, key: 'wf:' + w.id, done: false })
  const wfIds = new Set(wfs.map((w) => w.id))
  const wfNames = new Set(wfs.map((w) => w.name))
  for (const f of project.fields || []) {
    if ((f.ref?.wfId && wfIds.has(f.ref.wfId)) || wfNames.has(f.mapping?.wf)) {
      items.push({ kind: '欄位', label: f.label, key: 'fld:' + f._k, done: false })
    }
  }
  const nodes = project.flow?.graph?.nodes || project.flow?.nodes || []
  for (const n of nodes) {
    const lbl = n.data?.label || n.label || ''
    if (hit(core(lbl), k)) items.push({ kind: '流程', label: lbl, key: 'flow:' + n.id, done: false })
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
