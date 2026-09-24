import { useState, useRef } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { listTodos, sortTodos, normalizeTodo, parseTodoLines, OWNERS, ownerLabel } from '../lib/todos.js'
import { Plus, Trash2, Check, ChevronDown, ChevronUp, X } from 'lucide-react'

// 專案待辦。兩種用法：
//   <Todos limit={3} />  目錄頁的預覽（只列未完成前幾筆）
//   <Todos full />       完整面板（含已完成、逐筆展開編輯）
export default function Todos({ limit = 0, full = false, onClose = null, headless = false }) {
  const { current, dispatch } = useStore()
  const all = sortTodos(listTodos(current))
  const open = all.filter((t) => !t.done)
  const [showDone, setShowDone] = useState(false)
  const [editing, setEditing] = useState(null)
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  const save = (next) => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'todos', value: next })
  const add = () => {
    const t = text.trim()
    if (!t) return
    save([normalizeTodo({ text: t }), ...all])
    setText('')
    inputRef.current?.focus()
  }
  const patch = (id, p) => save(all.map((t) => (t.id === id
    ? { ...t, ...p, ...(p.done !== undefined ? { doneAt: p.done ? Date.now() : null } : {}) }
    : t)))
  const remove = (id) => save(all.filter((t) => t.id !== id))
  // 貼多行 → 一次建多筆。單行貼上照常進輸入框，不攔
  const [pasted, setPasted] = useState(0)
  const onPaste = (e) => {
    const raw = e.clipboardData?.getData('text') || ''
    if (!/\r?\n/.test(raw.trim())) return
    const items = parseTodoLines(raw)
    if (!items.length) return
    e.preventDefault()
    save([...items, ...all])
    setText('')
    setPasted(items.length)
    setTimeout(() => setPasted(0), 2500)
  }

  const rows = full ? (showDone ? all : open) : open.slice(0, limit || 3)

  const Row = ({ t }) => (
    <div className={'td-row' + (t.done ? ' done' : '')}>
      <button className="td-box" aria-label={t.done ? '標為未完成' : '標為完成'}
        onClick={() => patch(t.id, { done: !t.done })}>
        {t.done && <Check size={13} strokeWidth={3} />}
      </button>
      <div className="td-mid" onClick={() => full && setEditing(editing === t.id ? null : t.id)}>
        <span className="td-text">{t.text}</span>
        {(t.owner || t.due) && (
          <span className="td-tags">
            {t.owner && <i className={'td-tag ' + t.owner}>{ownerLabel(t.owner)}</i>}
            {t.due && <i className="td-tag due">{t.due}</i>}
          </span>
        )}
      </div>
      {full && (
        <button className="td-more" aria-label="編輯" onClick={() => setEditing(editing === t.id ? null : t.id)}>
          {editing === t.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      )}
      {full && editing === t.id && (
        <div className="td-edit">
          <input className="td-in" value={t.text} placeholder="待辦內容"
            onChange={(e) => patch(t.id, { text: e.target.value })} />
          <div className="td-edit-row">
            <div className="td-owners">
              {OWNERS.map((o) => (
                <button key={o.key} className={'td-own' + (t.owner === o.key ? ' on' : '')}
                  onClick={() => patch(t.id, { owner: t.owner === o.key ? null : o.key })}>{o.label}</button>
              ))}
            </div>
            <input className="td-in td-due" value={t.due} placeholder="期限（第 2 場會議前）"
              onChange={(e) => patch(t.id, { due: e.target.value })} />
            <button className="td-del" aria-label="刪除" onClick={() => remove(t.id)}><Trash2 size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className={'td-wrap' + (full ? ' full' : '')}>
      {full && (
        <div className={'td-head' + (headless ? ' slim' : '')}>
          {!headless && <>
            <strong>待辦</strong>
            <span className="muted">{open.length} 件未完成</span>
          </>}
          <div className="spacer" />
          {all.length > open.length && (
            <button className="ghost sm" onClick={() => setShowDone((v) => !v)}>
              {showDone ? '只看未完成' : `顯示已完成 (${all.length - open.length})`}
            </button>
          )}
          {onClose && <button className="ghost sm" aria-label="關閉" onClick={onClose}><X size={16} /></button>}
        </div>
      )}

      <div className="td-add">
        <input ref={inputRef} value={text} placeholder="新增待辦，按 Enter；貼多行會一次建多筆"
          onChange={(e) => setText(e.target.value)} onPaste={onPaste}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <button className="td-addbtn" aria-label="新增" onClick={add}><Plus size={16} /></button>
      </div>

      {pasted > 0 && <div className="td-pasted">已從貼上的文字建立 {pasted} 筆</div>}

      {rows.length === 0
        ? <div className="td-empty">沒有待辦。想到什麼就記上面那行。</div>
        : <div className="td-list">{rows.map((t) => <Row key={t.id} t={t} />)}</div>}

      {!full && open.length > rows.length && (
        <div className="td-rest muted">還有 {open.length - rows.length} 件</div>
      )}
    </div>
  )
}
