import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/StoreContext.jsx'
import { statusOfReq } from '../lib/units.js'
import { X, ScrollText, Link2, ChevronDown, ChevronUp } from 'lucide-react'

// 報價對照：報價單原始條目 ↔ 需求卡 的雙向追溯。
// project.quote = { source: '來源說明', items: [{ id, section, text, reqIds: [] }] }
// 條目原文是合約基準，只能對應、不能在這裡改；對應關係（reqIds）隨時可調。
export default function QuoteMap({ onClose }) {
  const { current, dispatch } = useStore()
  const quote = current.quote || {}
  const items = quote.items || []
  const reqs = current.requirements || []
  const reqById = Object.fromEntries(reqs.map((r) => [r.id, r]))
  const save = (nextItems) => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'quote', value: { ...quote, items: nextItems } })
  const [linking, setLinking] = useState(null) // 展開對應選單的條目 id
  const ST_COLOR = ['#2E5F96', '#4E7A2E', '#B0691F'] // 待確認/已蓋章/異動中

  const liveIds = (it) => (it.reqIds || []).filter((id) => reqById[id])
  const mapped = new Set(items.flatMap(liveIds))
  const extraReqs = reqs.filter((r) => !mapped.has(r.id)) // 報價外需求：追溯不到任何條目
  const unmappedCount = items.filter((it) => liveIds(it).length === 0).length

  const toggle = (item, reqId) => {
    const s = new Set(item.reqIds || [])
    s.has(reqId) ? s.delete(reqId) : s.add(reqId)
    save(items.map((i) => (i.id === item.id ? { ...i, reqIds: [...s] } : i)))
  }

  // 依報價單原始章節分組（保持原順序）
  const sections = []
  for (const it of items) {
    const name = it.section || '報價條目'
    let g = sections.find((s) => s.name === name)
    if (!g) { g = { name, list: [] }; sections.push(g) }
    g.list.push(it)
  }
  // 對應選單裡需求依單元分組，找起來快
  const reqGroups = []
  for (const r of reqs) {
    const u = (r.unit || '').trim() || '未分單元'
    let g = reqGroups.find((x) => x.name === u)
    if (!g) { g = { name: u, list: [] }; reqGroups.push(g) }
    g.list.push(r)
  }

  return createPortal(
    <div className="uf-wrap">
      <div className="uf-head">
        <ScrollText size={18} />
        <strong>報價對照（{items.length} 條）</strong>
        <div className="spacer" />
        <button className="rd-back" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="uf-body">
        {items.length === 0 ? (
          <div className="uf-empty">
            這個專案還沒有報價單條目。<br />
            用 quote-to-project 重新產出含 <b>quote.items</b>（報價原文逐條）的專案 JSON，
            同 id 再匯入即可同步補上，需求資料不會動。
          </div>
        ) : (<>
          <div className="qm-sum">
            <span className="qm-chip ok">已對應 {items.length - unmappedCount}</span>
            {unmappedCount > 0 && <span className="qm-chip warn">未對應 {unmappedCount}</span>}
            {extraReqs.length > 0 && <span className="qm-chip info">報價外需求 {extraReqs.length}</span>}
          </div>
          {sections.map((sec) => (
            <div key={sec.name} className="uf-card qm-sec">
              <div className="qm-sec-name">{sec.name}</div>
              {sec.list.map((it) => {
                const linked = liveIds(it)
                return (
                  <div key={it.id} className={'qm-item' + (linked.length ? '' : ' gap')}>
                    <div className="qm-text">{it.text}</div>
                    <div className="qm-links">
                      {linked.map((id) => {
                        const r = reqById[id]
                        return (
                          <span key={id} className="qm-req">
                            <i className="uf-cov-dot" style={{ background: ST_COLOR[statusOfReq(r)], marginTop: 0 }} />
                            {r.name}
                          </span>
                        )
                      })}
                      {linked.length === 0 && <span className="qm-none">尚未對應到任何需求 — 漏開需求？</span>}
                      <button className="qm-linkbtn" onClick={() => setLinking(linking === it.id ? null : it.id)}>
                        <Link2 size={11} /> 對應{linking === it.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    </div>
                    {linking === it.id && (
                      <div className="qm-picker">
                        {reqGroups.map((g) => (
                          <div key={g.name}>
                            <div className="qm-picker-unit">{g.name}</div>
                            {g.list.map((r) => (
                              <label key={r.id} className="uf-check">
                                <input type="checkbox" checked={(it.reqIds || []).includes(r.id)} onChange={() => toggle(it, r.id)} />
                                <i className="uf-cov-dot" style={{ background: ST_COLOR[statusOfReq(r)] }} />
                                <span>{r.name}</span>
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          {extraReqs.length > 0 && (
            <div className="uf-card qm-sec">
              <div className="qm-sec-name">報價外需求（{extraReqs.length}）</div>
              <div className="uf-cov-note">這些需求追溯不到報價單任何條目 — 拿去出「需求評估單」，決定吸收開發還是另行報價。</div>
              {extraReqs.map((r) => (
                <div key={r.id} className="qm-item">
                  <div className="qm-links">
                    <span className="qm-req">
                      <i className="uf-cov-dot" style={{ background: ST_COLOR[statusOfReq(r)], marginTop: 0 }} />
                      {r.name}
                    </span>
                    <span className="qm-unit">{(r.unit || '').trim() || '未分單元'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>
    </div>,
    document.body
  )
}
