import { useState, useRef } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { newRequirement } from '../lib/requirementExtractor.js'
import { detectCategory, categoryMeta } from '../lib/categories.js'
import { Plus, Mic, Check, Trash2, Pencil, HelpCircle, X } from 'lucide-react'

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null

// 訪談模式：客戶面前（手機）快速記需求卡 — 只抓不整理，回頭再補
export default function InterviewMode({ onClose }) {
  const { state, current, dispatch } = useStore()
  const reqs = current.requirements || []
  const chips = state.library?.chips || []
  const guide = state.library?.guide || []
  const checks = current.guideChecks || {}
  const remain = guide.filter((q) => !checks[q]).length
  const [editLib, setEditLib] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [newChip, setNewChip] = useState('')
  const [newQ, setNewQ] = useState('')
  const setLib = (field, value) => dispatch({ type: 'UPDATE_LIBRARY', field, value })
  const toggleCheck = (q) => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'guideChecks', value: { ...checks, [q]: !checks[q] } })
  const [txt, setTxt] = useState('')
  const [openId, setOpenId] = useState(null)
  const [listening, setListening] = useState(false)
  const [live, setLive] = useState('')
  const inputRef = useRef(null)
  const recRef = useRef(null)
  const heardRef = useRef('')

  const addCard = (name) => {
    const n = String(name || '').trim()
    if (!n) return false
    dispatch({ type: 'ADD_REQUIREMENT', requirement: newRequirement({ name: n, screen: n, category: detectCategory(n) }) })
    return true
  }
  const add = () => { if (addCard(txt)) { setTxt(''); inputRef.current?.focus() } }
  const patch = (id, p) => dispatch({ type: 'UPDATE_REQUIREMENT', id, patch: p })

  // 按住說話：放開自動成卡（辨識錯了點卡片改就好）
  const startRec = () => {
    if (!SR || listening) return
    try {
      const rec = new SR()
      rec.lang = 'zh-TW'
      rec.continuous = true
      rec.interimResults = true
      heardRef.current = ''
      rec.onresult = (e) => {
        let all = ''
        for (let i = 0; i < e.results.length; i++) all += e.results[i][0].transcript
        heardRef.current = all
        setLive(all)
      }
      rec.onend = () => {
        setListening(false)
        setLive('')
        const heard = heardRef.current.trim()
        if (heard.length >= 2) addCard(heard)
        else if (heard) setTxt((t) => t + heard)
      }
      rec.onerror = () => { setListening(false); setLive('') }
      recRef.current = rec
      rec.start()
      setListening(true)
    } catch { setListening(false) }
  }
  const stopRec = () => { try { recRef.current?.stop() } catch { /* noop */ } }

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
      <div className="iv-chips">
        <button className={'iv-chip iv-tool' + (showGuide ? ' on' : '')} onClick={() => setShowGuide((v) => !v)}>
          <HelpCircle size={14} /> 引導{remain > 0 ? `（剩 ${remain}）` : ' ✓'}
        </button>
        {chips.map((q) => (
          <button key={q} className="iv-chip" onClick={() => (editLib ? setLib('chips', chips.filter((c) => c !== q)) : addCard(q))}>
            {editLib ? <>{q} <X size={12} /></> : `＋${q}`}
          </button>
        ))}
        {editLib && (
          <input className="iv-chip-add" value={newChip} placeholder="新增常用…Enter" onChange={(e) => setNewChip(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newChip.trim()) { setLib('chips', [...chips, newChip.trim()]); setNewChip('') } }} />
        )}
        <button className={'iv-chip iv-tool' + (editLib ? ' on' : '')} onClick={() => setEditLib((v) => !v)}>
          <Pencil size={13} /> {editLib ? '完成' : '編輯'}
        </button>
      </div>
      {showGuide && (
        <div className="iv-guide">
          {guide.map((q) => (
            <label key={q} className={'iv-gq' + (checks[q] ? ' done' : '')}>
              <input type="checkbox" checked={!!checks[q]} onChange={() => toggleCheck(q)} />
              <span>{q}</span>
              {editLib && <button className="iv-gq-del" onClick={(e) => { e.preventDefault(); setLib('guide', guide.filter((x) => x !== q)) }}><X size={13} /></button>}
            </label>
          ))}
          {editLib && (
            <input className="iv-chip-add" value={newQ} placeholder="新增引導問題…Enter" onChange={(e) => setNewQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newQ.trim()) { setLib('guide', [...guide, newQ.trim()]); setNewQ('') } }} />
          )}
        </div>
      )}
      {listening && <div className="iv-live"><Mic size={15} /> 聆聽中… <span>{live || '請說話'}</span></div>}
      <div className="iv-input">
        <textarea ref={inputRef} autoFocus rows={2} value={txt}
          placeholder="客戶說了什麼？一句話記下來…（Enter 記一筆）"
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add() } }} />
        <div className="iv-btns">
          {SR && (
            <button className={'iv-voice' + (listening ? ' rec' : '')}
              onPointerDown={(e) => { e.preventDefault(); startRec() }}
              onPointerUp={stopRec} onPointerLeave={stopRec} onPointerCancel={stopRec}
              onContextMenu={(e) => e.preventDefault()}>
              <Mic size={20} /> {listening ? '放開成卡' : '按住說話'}
            </button>
          )}
          <button className="iv-add" onClick={add}><Plus size={20} /> 記一筆</button>
        </div>
      </div>
      <div className="iv-cards">
        {cards.length === 0 && (
          <div className="iv-empty">還沒有卡片。聽到需求就記、不用整理 — 回頭再讓 AI 補分類 / 故事 / 頁面。{SR ? '也可以按住「說話」鈕，放開自動成卡。' : ''}</div>
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
                {(r.talks || []).filter((t) => t.who === 'client').map((t, i) => (
                  <div key={i} className="iv-quote">「{t.text}」<small>{new Date(t.at).toLocaleDateString('zh-TW')}</small></div>
                ))}
                <input placeholder="客戶原話…（Enter 記入對話串）"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      patch(r.id, { talks: [...(r.talks || []), { at: Date.now(), who: 'client', text: e.currentTarget.value.trim() }] })
                      e.currentTarget.value = ''
                    }
                  }} />
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
