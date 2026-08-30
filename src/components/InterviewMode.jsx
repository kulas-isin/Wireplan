import { useState, useRef } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { newRequirement } from '../lib/requirementExtractor.js'
import { detectCategory, categoryMeta } from '../lib/categories.js'
import { Plus, Mic, Check, Trash2 } from 'lucide-react'

// 訪談模式：客戶面前（手機）快速記需求卡 — 只抓不整理，回頭再補
export default function InterviewMode({ onClose }) {
  const { current, dispatch } = useStore()
  const reqs = current.requirements || []
  const [txt, setTxt] = useState('')
  const [openId, setOpenId] = useState(null)
  const inputRef = useRef(null)

  const add = () => {
    const name = txt.trim()
    if (!name) return
    dispatch({ type: 'ADD_REQUIREMENT', requirement: newRequirement({ name, screen: name, category: detectCategory(name) }) })
    setTxt('')
    inputRef.current?.focus()
  }
  const patch = (id, p) => dispatch({ type: 'UPDATE_REQUIREMENT', id, patch: p })

  const cards = [...reqs].reverse() // 最新的在最上面
  return (
    <div className="iv-wrap">
      <div className="iv-head">
        <Mic size={18} />
        <strong>訪談模式</strong>
        <span className="iv-count">{reqs.length} 張卡</span>
        <div className="spacer" />
        <button className="iv-done" onClick={onClose}><Check size={16} /> 完成</button>
      </div>
      <div className="iv-input">
        <textarea ref={inputRef} autoFocus rows={2} value={txt}
          placeholder="客戶說了什麼？一句話記下來…（Enter 記一筆）"
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add() } }} />
        <button className="iv-add" onClick={add}><Plus size={20} /> 記一筆</button>
      </div>
      <div className="iv-cards">
        {cards.length === 0 && (
          <div className="iv-empty">還沒有卡片。聽到需求就記、不用整理 — 回頭再讓 AI 補分類 / 故事 / 頁面。</div>
        )}
        {cards.map((r) => (
          <div key={r.id} className={'iv-card' + (openId === r.id ? ' open' : '')}>
            <div className="iv-card-row" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
              <span className="iv-name">{r.name}</span>
              <span className="iv-cat" style={{ background: categoryMeta(r.category).color + '22', color: categoryMeta(r.category).color }}>
                {categoryMeta(r.category).label}
              </span>
            </div>
            {openId === r.id && (
              <div className="iv-detail">
                <textarea rows={2} value={r.note} placeholder="客戶原話 / 補充…"
                  onChange={(e) => patch(r.id, { note: e.target.value })} />
                <input value={r.screen} placeholder="對應頁面（可先留白）"
                  onChange={(e) => patch(r.id, { screen: e.target.value })} />
                <div className="iv-pri">
                  {['高', '中', '低'].map((p) => (
                    <button key={p} className={'fe-pill' + (r.priority === p ? ' on' : '')} onClick={() => patch(r.id, { priority: p })}>{p}</button>
                  ))}
                  <div className="spacer" />
                  <button className="ghost sm danger" onClick={() => dispatch({ type: 'DELETE_REQUIREMENT', id: r.id })}><Trash2 size={14} /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
