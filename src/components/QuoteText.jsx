import { useState } from 'react'

// 報價原文排版器：資料照存逐字原文，顯示時拆解結構
// 規則：【…】→ 小節標題章；• → 條列；（1）（2）→ 子條列；「功能說明：」等前綴加粗
// interactive：逐行點擊聚焦（點到的行全對比＋柔和藍底，其餘淡出；再點取消）
// annot（筆記模式才傳入）：{ notes, onAdd(line, text, q), onDel(id) }
//   — 檢視模式（不傳 annot）完全看不到筆記與按鈕，版面即純原文
const LEAD = /^(功能說明|功能流程|使用情境舉例|甲方需提供)：([\s\S]*)$/

const emph = (s) => {
  const m = s.match(LEAD)
  return m ? <><b>{m[1]}：</b>{m[2]}</> : s
}

function NoteEditor({ onSave, onCancel }) {
  const [text, setText] = useState('')
  const [q, setQ] = useState(false)
  return (
    <div className="qr-editor" onClick={(e) => e.stopPropagation()}>
      <textarea autoFocus rows={2} value={text} placeholder="用自己的話記一句…"
        onChange={(e) => setText(e.target.value)} />
      <div className="qr-editor-row">
        <label className="qr-qtoggle"><input type="checkbox" checked={q} onChange={() => setQ(!q)} /> 這是要問客戶的</label>
        <div className="spacer" />
        <button className="qr-chip" onClick={onCancel}>取消</button>
        <button className="qr-chip on-done" disabled={!text.trim()} onClick={() => text.trim() && onSave(text.trim(), q)}>存筆記</button>
      </div>
    </div>
  )
}

export default function QuoteText({ text, interactive, annot }) {
  const [act, setAct] = useState(null)
  const [adding, setAdding] = useState(null) // 正在寫筆記的行 key
  const cls = (k, base) => base + (interactive && act === k ? ' act' : '')
  const on = (k) => interactive ? (e) => { e.stopPropagation(); setAct((a) => (a === k ? null : k)) } : undefined

  // 行尾註解：該行的筆記卡＋（聚焦時）加筆記鈕（僅筆記模式）
  const after = (k) => {
    if (!annot) return null
    const lineNotes = (annot.notes || []).filter((n) => n.line === k)
    return (<>
      {lineNotes.map((n) => (
        <div key={n.id} className="qr-note" onClick={(e) => e.stopPropagation()}>
          {n.q && <span className="qr-note-tag">疑問</span>}
          <span className="qr-note-text">{n.text}</span>
          <button className="qr-note-del" title="刪除筆記" onClick={() => confirm('刪除這則筆記？') && annot.onDel(n.id)}>✕</button>
        </div>
      ))}
      {act === k && adding !== k && (
        <button className="qr-notebtn" onClick={(e) => { e.stopPropagation(); setAdding(k) }}>✎ 在這行加筆記</button>
      )}
      {adding === k && (
        <NoteEditor onCancel={() => setAdding(null)}
          onSave={(t, q) => { annot.onAdd(k, t, q); setAdding(null) }} />
      )}
    </>)
  }
  const hasNote = (k) => annot && (annot.notes || []).some((n) => n.line === k)
  const dot = (k) => hasNote(k) ? <i className="qr-linedot" /> : null

  const [introRaw, ...bullets] = String(text || '').split(/\s*•\s*/)
  // 前言依【小節】切段（split 保留標題與其後文字成對）
  const intro = introRaw.split(/(?=【[^】]+】)|(?=功能說明：)|(?=功能流程：)/).map((p) => {
    const m = p.match(/^【([^】]+)】([\s\S]*)$/)
    return m ? { h: m[1], body: m[2].trim() } : { h: null, body: p.trim() }
  }).filter((s) => s.h || s.body)

  return (
    <div className={'qt' + (interactive ? ' qt-tap' : '') + (interactive && act !== null ? ' has-act' : '')}>
      {intro.map((s, i) => (
        <div key={i}>
          {s.h && <div className="qt-h">{s.h}</div>}
          {s.body && <p className={cls('p' + i, 'qt-p')} onClick={on('p' + i)}>{emph(s.body)}{dot('p' + i)}</p>}
          {s.body && after('p' + i)}
        </div>
      ))}
      {bullets.length > 0 && (
        <ul className="qt-ul">
          {bullets.map((b, i) => {
            const parts = b.split(/(?=（\d+）)/).map((x) => x.trim()).filter(Boolean)
            return (
              <li key={i} className={cls('b' + i, 'qt-li')} onClick={on('b' + i)}>
                {emph(parts[0])}{dot('b' + i)}
                {parts.length > 1 && (
                  <ul className="qt-sub">
                    {parts.slice(1).map((x, j) => (<li key={j}>
                      <span className={cls(`b${i}s${j}`, 'qr-subline')} onClick={on(`b${i}s${j}`)}>{x}{dot(`b${i}s${j}`)}</span>
                      {after(`b${i}s${j}`)}
                    </li>))}
                  </ul>
                )}
                {after('b' + i)}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
