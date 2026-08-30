// AI 展開結果（requirementPatches）套用：只補空欄；未蓋章才改名且原名留痕
import { isLocked } from './change.js'

export function applyRequirementPatches(requirements, patches, dispatch) {
  let applied = 0, renamed = 0, skippedLocked = 0, notFound = 0, talksAdded = 0
  for (const p of patches || []) {
    const r = (requirements || []).find((x) => x.id === p.id || (p.name && x.name === p.name))
    if (!r) { notFound++; continue }
    const patch = {}
    if (!r.description && p.description) patch.description = p.description
    if (!r.acceptance && p.acceptance) patch.acceptance = p.acceptance
    // 對話串：追加（去重同文字）；對話是紀錄不是規格變更，鎖定卡也可追加
    if (Array.isArray(p.talks) && p.talks.length) {
      const existing = new Set((r.talks || []).map((t) => t.text))
      const add = p.talks
        .filter((t) => t && t.text && !existing.has(String(t.text)))
        .map((t) => ({ at: (t.date && Date.parse(t.date)) || Date.now(), who: t.who === 'us' ? 'us' : 'client', text: String(t.text) }))
      if (add.length) { patch.talks = [...(r.talks || []), ...add]; talksAdded += add.length }
    }
    if (p.name && p.name !== r.name) {
      if (isLocked(r)) skippedLocked++
      else { patch.name = p.name; patch.note = [r.note, `（原名：${r.name}）`].filter(Boolean).join('｜'); renamed++ }
    }
    if (Object.keys(patch).length) { dispatch({ type: 'UPDATE_REQUIREMENT', id: r.id, patch }); applied++ }
  }
  return { applied, renamed, skippedLocked, notFound, talksAdded }
}

// 寬容解析：整包物件 / 純陣列 / 前後有雜文字皆可
export function parsePatches(text) {
  const t = String(text || '').trim()
  const tryParse = (s) => { try { return JSON.parse(s) } catch { return null } }
  let j = tryParse(t)
  if (!j) {
    const m = t.match(/\{[\s\S]*\}/)
    if (m) j = tryParse(m[0])
  }
  if (!j) return null
  if (Array.isArray(j)) return j
  if (Array.isArray(j.requirementPatches)) return j.requirementPatches
  if (Array.isArray(j.talkPatches)) return j.talkPatches
  return null
}
