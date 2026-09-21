import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/StoreContext.jsx'
import { unitsOf, unitStats, pageTree, reqsOfPage, looseReqs, unassignedReqs, statusOfReq } from '../lib/units.js'
import { linkedPages } from '../lib/elements.js'
import { PackView, GalaxyView } from './UnitViz.jsx'
import UnitFlows from './UnitFlows.jsx'
import QuoteMap from './QuoteMap.jsx'
import QuoteText from './QuoteText.jsx'
import { ReqDetailSheet } from './MobileReqCard.jsx'
import SpecSheet from './SpecSheet.jsx'
import MeetingDoc from './MeetingDoc.jsx'
import { Plus, X, ArrowUpRight, Stamp, Undo2, ChevronDown, ChevronRight, GripVertical, MoreHorizontal, Pencil } from 'lucide-react'

const ST_CLASS = ['uw-st0', 'uw-st1', 'uw-st2'] // 待確認 / 已蓋章 / 異動

// 拖曳改層（編輯模式）：≡把手拖起幽靈列，放到目標頁列＝成為其子頁、放到樹頭列＝單元最上層
let uwDrag = null
function uwMoveGhost(e) {
  uwDrag.ghost.style.left = (e.clientX + 12) + 'px'
  uwDrag.ghost.style.top = (e.clientY - 16) + 'px'
  document.querySelectorAll('.uw-drophint').forEach((x) => x.classList.remove('uw-drophint'))
  uwDrag.target = null
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const rowT = el?.closest?.('.uw-nrow')
  if (rowT && rowT.dataset.wfid && !uwDrag.banned.has(rowT.dataset.wfid)) {
    rowT.classList.add('uw-drophint')
    uwDrag.target = { id: rowT.dataset.wfid }
    return
  }
  const headT = el?.closest?.('.uw-treehead')
  if (headT) { headT.classList.add('uw-drophint'); uwDrag.target = { root: true } }
}
function uwEndDrag() {
  if (!uwDrag) return
  const { ghost, target, wf, dispatch } = uwDrag
  ghost.remove()
  document.querySelectorAll('.uw-drophint').forEach((x) => x.classList.remove('uw-drophint'))
  uwDrag = null
  if (!target) return
  dispatch({ type: 'UPDATE_WIREFRAME', id: wf.id, patch: { parentId: target.root ? null : target.id } })
}

// 頁面樹節點：頁名 + 需求膠囊；編輯模式浮出 ＋ / ≡ / ⋯
function TreeNode({ node, project, depth, edit, dispatch, onMore, subtreeIds, onReq, onSpec }) {
  const [open, setOpen] = useState(depth === 0)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const reqs = reqsOfPage(project, node.wf)
  const jump = (e) => {
    e.stopPropagation()
    sessionStorage.setItem('wp-open-wf', node.wf.id)
    window.location.hash = 'wf'
  }
  const addChild = () => {
    const v = newName.trim()
    if (!v) return
    dispatch({ type: 'ADD_WIREFRAME', wireframes: [{ id: 'wf_' + Math.random().toString(36).slice(2, 10), unit: node.wf.unit, parentId: node.wf.id, name: v, device: 'desktop', layout: 'stack', components: [] }] })
    setNewName(''); setAdding(false); setOpen(true)
  }
  const startDrag = (e) => {
    e.stopPropagation(); e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const g = document.createElement('div')
    g.className = 'uw-ghost'; g.textContent = node.wf.name
    document.body.appendChild(g)
    uwDrag = { wf: node.wf, dispatch, ghost: g, target: null, banned: subtreeIds(node) }
    uwMoveGhost(e)
  }
  const hasBody = reqs.length > 0 || node.kids.length > 0
  return (
    <div className="uw-node">
      <div className="uw-nrow" role="button" data-wfid={node.wf.id}
        onClick={(e) => { if (e.target.closest && e.target.closest('.uw-drag')) return; if (hasBody) setOpen((o) => !o) }}>
        {edit && (
          <span className="uw-drag" title="按住拖到別的頁面底下" onPointerDown={startDrag}
            onPointerMove={(e) => { if (uwDrag) uwMoveGhost(e) }} onPointerUp={uwEndDrag} onPointerCancel={uwEndDrag}>
            <GripVertical size={14} />
          </span>
        )}
        <span className="uw-caret">{hasBody ? (open ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <i className="uw-leaf" />}</span>
        <span className="uw-nname" title="開頁面規格清單" onClick={(e) => { if (!edit) { e.stopPropagation(); onSpec?.(node.wf.id) } }}>{node.wf.name}</span>
        {reqs.length > 0 && <span className="uw-ncnt">{reqs.length} 需求</span>}
        {edit ? (
          <>
            <button className="uw-mini" title="在此頁底下新增子頁" onClick={(e) => { e.stopPropagation(); setAdding(true); setOpen(true) }}><Plus size={13} /></button>
            <button className="uw-mini" title="更多" onClick={(e) => { e.stopPropagation(); onMore(node.wf) }}><MoreHorizontal size={13} /></button>
          </>
        ) : (
          <button className="uw-jump" title="到 Wireframe 開這頁" onClick={jump}><ArrowUpRight size={13} /></button>
        )}
      </div>
      {open && (
        <div className="uw-nbody">
          {adding && (
            <div className="uw-newrow">
              <input autoFocus value={newName} placeholder="子頁名稱…" onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addChild() }} />
              <button onClick={addChild}>加入</button>
            </div>
          )}
          {reqs.length > 0 && !edit && (
            <div className="uw-reqs">
              {reqs.map((r) => <span key={r.id} className={'uw-rq ' + ST_CLASS[statusOfReq(r)]}
                onClick={(e) => { e.stopPropagation(); onReq?.(r.id) }}>{r.name}</span>)}
            </div>
          )}
          {node.kids.length > 0 && (
            <div className="uw-kids">
              {node.kids.map((k) => <TreeNode key={k.wf.id} node={k} project={project} depth={depth + 1} edit={edit} dispatch={dispatch} onMore={onMore} subtreeIds={subtreeIds} onReq={onReq} onSpec={onSpec} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ⋯ 節點選單：改名 / 移到… / 自單元移除（底部抽屜，沿用 as-sheet 語彙）
function NodeSheet({ wf, project, onClose, dispatch }) {
  const [moving, setMoving] = useState(false)
  const unit = wf.unit || ''
  const flat = []
  const walk = (nodes, lv, banned) => nodes.forEach((n) => {
    const isBanned = banned || n.wf.id === wf.id
    if (!isBanned) flat.push({ wf: n.wf, lv })
    walk(n.kids, lv + 1, isBanned)
  })
  walk(pageTree(project, unit), 0, false)
  return createPortal(
    <div className="as-backdrop" onClick={onClose}>
      <div className="as-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="as-grab" />
        {!moving ? (
          <>
            <button className="as-row" onClick={() => { const v = prompt('頁面名稱', wf.name); if (v && v.trim()) dispatch({ type: 'UPDATE_WIREFRAME', id: wf.id, patch: { name: v.trim() } }); onClose() }}>
              <span className="as-ic"><Pencil size={18} /></span>
              <span><b>改名</b><small>{wf.name}</small></span>
            </button>
            <button className="as-row" onClick={() => setMoving(true)}>
              <span className="as-ic"><GripVertical size={18} /></span>
              <span><b>移到…</b><small>掛到單元最上層或其他頁面底下</small></span>
            </button>
            <button className="as-row" onClick={() => { if (confirm(`把「${wf.name}」移出「${unit}」？（頁面保留，只解掛單元）`)) dispatch({ type: 'UPDATE_WIREFRAME', id: wf.id, patch: { unit: '', parentId: null } }); onClose() }}>
              <span className="as-ic" style={{ background: '#FBE9D6', color: '#B3402A' }}><X size={18} /></span>
              <span><b style={{ color: '#B3402A' }}>自單元移除</b><small>頁面與內容都保留，只離開這個單元</small></span>
            </button>
          </>
        ) : (
          <>
            <button className="as-row" onClick={() => { dispatch({ type: 'UPDATE_WIREFRAME', id: wf.id, patch: { parentId: null } }); onClose() }}>
              <span className="as-ic"><ArrowUpRight size={18} /></span>
              <span><b>{unit}（單元最上層）</b></span>
            </button>
            {flat.map(({ wf: t, lv }) => (
              <button key={t.id} className="as-row" onClick={() => { dispatch({ type: 'UPDATE_WIREFRAME', id: wf.id, patch: { parentId: t.id } }); onClose() }}>
                <span className="as-ic"><ChevronRight size={18} /></span>
                <span><b>{'　'.repeat(lv)}└ {t.name}</b></span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}

// 歸檔快手：一次一張卡、點單元＝蓋章歸檔（章落卡面＋漣漪），可復原
function DealMode({ onClose }) {
  const { current, dispatch } = useStore()
  const units = unitsOf(current)
  const [history, setHistory] = useState([])
  const [fx, setFx] = useState(null) // { unit } 蓋章動畫中
  const queue = unassignedReqs(current)
  const card = queue[0]
  const doneN = history.length
  const stampIt = (u) => {
    if (!card || fx) return
    setFx({ unit: u, id: card.id })
    setTimeout(() => {
      dispatch({ type: 'UPDATE_REQUIREMENT', id: card.id, patch: { unit: u } })
      // 卡片連結的頁面（還沒有單元的）跟著歸進同一單元 — 樹自動長出來
      for (const w of linkedPages(card, current.wireframes || [])) {
        if (!(w.unit || '').trim()) dispatch({ type: 'UPDATE_WIREFRAME', id: w.id, patch: { unit: u } })
      }
      setHistory((h) => [...h, card.id])
      setFx(null)
    }, 620)
  }
  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    dispatch({ type: 'UPDATE_REQUIREMENT', id: last, patch: { unit: '' } })
    setHistory((h) => h.slice(0, -1))
  }
  return createPortal(
    <div className="uw-deal">
      <div className="uw-deal-head">
        <strong>歸檔快手</strong>
        <span className="muted">剩 {queue.length} 張 · 已歸 {doneN}</span>
        <div className="spacer" />
        <button className="rd-back" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="uw-stage">
        {card ? (
          <div className="uw-dealcard" key={card.id}>
            <div className="uw-dc-cat">{card.screen || '未指定畫面'}</div>
            <div className="uw-dc-name">{card.name}</div>
            {card.description && <div className="uw-dc-desc">{card.description}</div>}
            {fx && (
              <>
                <div className="uw-stampfx">{fx.unit.slice(0, 4)}</div>
                <div className="uw-ripplefx" />
              </>
            )}
          </div>
        ) : (
          <div className="uw-dealdone">
            <div>全部歸檔完成</div>
            <p>{doneN} 張卡各就各位 — 回單元牆看看它們的新家</p>
            <button className="tg-big primary" onClick={onClose}>回單元牆</button>
          </div>
        )}
      </div>
      {card && <p className="uw-hint"><Stamp size={13} /> 點下面的單元＝拿起那顆章，蓋在這張卡上</p>}
      <div className="uw-chips">
        {units.map((u) => (
          <button key={u} className="uw-uchip" onClick={() => stampIt(u)}>{u}</button>
        ))}
      </div>
      {history.length > 0 && <button className="uw-undo" onClick={undo}><Undo2 size={13} /> 復原上一張</button>}
    </div>,
    document.body
  )
}

// 單元牆：Bento 磁磚（卡數/狀態色條/警示，出事轉暖色），點磁磚原地展開頁面樹
export default function UnitWall() {
  const { current, dispatch } = useStore()
  const units = unitsOf(current)
  const [openUnit, setOpenUnit] = useState(null)
  const [deal, setDeal] = useState(false)
  const [editStruct, setEditStruct] = useState(false)
  const [flowUnit, setFlowUnit] = useState(null)
  const [showQuote, setShowQuote] = useState(false)
  const [tileQuote, setTileQuote] = useState(false) // 展開磁磚內的報價原文區
  const [openReq, setOpenReq] = useState(null) // 磁磚內點需求 → 就地開需求卡（單元內循環）
  const [specWf, setSpecWf] = useState(null) // 磁磚內點頁名 → 開頁面規格清單
  const [showMeeting, setShowMeeting] = useState(false)
  const [noteMode, setNoteMode] = useState(false) // 筆記模式：檢視模式下看不到任何標記工具
  // 報價條目的標記/筆記更新（存回 quote.items）
  const patchQuoteItem = (id, p) => {
    const q = current.quote || {}
    dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'quote', value: { ...q, items: (q.items || []).map((it) => it.id === id ? { ...it, ...p } : it) } })
  }
  const toggleMark = (it, m) => {
    const s = new Set(it.marks || [])
    if (s.has(m)) s.delete(m)
    else { s.add(m); if (m === 'done') s.delete('q'); if (m === 'q') s.delete('done') }
    patchQuoteItem(it.id, { marks: [...s] })
  }
  const MARKS = [['done', '✓ 已讀懂'], ['q', '? 疑問'], ['star', '★ 重點']]
  const quoteItems = current.quote?.items || []
  const quoteReqIds = new Set((current.requirements || []).map((r) => r.id))
  const quoteGaps = quoteItems.filter((it) => !(it.reqIds || []).some((id) => quoteReqIds.has(id))).length
  const [viz, setViz] = useState('wall') // wall | pack | force
  const [moreWf, setMoreWf] = useState(null)
  const [addingRoot, setAddingRoot] = useState(false)
  const [rootName, setRootName] = useState('')
  const subtreeIds = (node, s = new Set()) => { s.add(node.wf.id); node.kids.forEach((k) => subtreeIds(k, s)); return s }
  const stats = useMemo(() => Object.fromEntries(units.map((u) => [u, unitStats(current, u)])), [current, units])
  const loose = unassignedReqs(current)
  const addUnit = () => {
    const v = prompt('新單元名稱（例如：託運單管理）')
    if (!v || !v.trim()) return
    const name = v.trim()
    if (units.includes(name)) { alert('已有同名單元'); return }
    dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'units', value: [...(current.units || []), name] })
  }
  return (
    <div className="uw-wrap">
      <div className="uw-modes">
        {[['wall', '磁磚'], ['pack', '圓圈嵌套'], ['force', '星系']].map(([k, label]) => (
          <button key={k} className={viz === k ? 'on' : ''} onClick={() => setViz(k)}>{label}</button>
        ))}
        <div className="spacer" />
        <button className="uw-editbtn" onClick={() => setShowMeeting(true)}>會議記錄</button>
        <button className="uw-editbtn" onClick={() => setShowQuote(true)}>
          報價對照{quoteItems.length === 0 ? '' : quoteGaps > 0 ? ` ${quoteGaps}!` : ' ✓'}
        </button>
        <button className="uw-editbtn" onClick={() => setFlowUnit('')}>
          專案流程 {(current.unitFlows || []).filter((f) => !(f.unit || '')).length}
          {(current.unitFlows || []).some((f) => !(f.unit || '') && f.sealed) ? ' ✓' : ''}
        </button>
      </div>
      {viz === 'pack' && <PackView />}
      {viz === 'force' && <GalaxyView />}
      {viz === 'wall' && <>
      {loose.length > 0 && units.length > 0 && (
        <button className="uw-banner" onClick={() => setDeal(true)}>
          <Stamp size={15} /> {loose.length} 張卡還沒分單元 — 進歸檔快手，一秒一張
        </button>
      )}
      <div className="uw-wall">
        {units.map((u) => {
          const s = stats[u]
          const hot = s.chg > 0 || s.miss > 0
          const open = openUnit === u
          const seg = (n, cls) => n ? <i className={cls} style={{ width: (n / (s.total || 1) * 100) + '%' }} /> : null
          return (
            <div key={u} role="button" tabIndex={0}
              className={'uw-tile' + (s.total >= 10 ? ' big' : '') + (hot ? ' hot' : '') + (open ? ' open' : '')}
              onClick={() => { setOpenUnit(open ? null : u); setEditStruct(false); setAddingRoot(false); setTileQuote(false) }}>
              <span className="uw-sheen" />
              <div className="uw-tname">{u}</div>
              <div className="uw-tcount"><b>{s.total}</b> 張需求卡</div>
              <div className="uw-bar">{seg(s.draft, 'uw-b0')}{seg(s.ok, 'uw-b1')}{seg(s.chg, 'uw-b2')}</div>
              <div className="uw-flags">
                {s.miss > 0 && <span className="uw-flag warn">缺頁 {s.miss}</span>}
                {s.chg > 0 && <span className="uw-flag warn">異動 {s.chg}</span>}
                {!hot && s.total > 0 && s.draft === 0 && <span className="uw-flag ok">全數蓋章 ✓</span>}
                {s.draft > 0 && !hot && <span className="uw-flag blue">待確認 {s.draft}</span>}
              </div>
              {open && (
                <div className={'uw-tree' + (editStruct ? ' editing' : '')} onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    const uReqIds = new Set((current.requirements || []).filter((r) => (r.unit || '').trim() === u).map((r) => r.id))
                    const qItems = (current.quote?.items || []).filter((it) => (it.reqIds || []).some((id) => uReqIds.has(id)))
                    const readN = qItems.filter((it) => (it.marks || []).includes('done')).length
                    const qN = qItems.filter((it) => (it.marks || []).includes('q') || (it.notes || []).some((n) => n.q)).length
                    return qItems.length > 0 && (<>
                      <div className="uw-treehead" style={{ marginBottom: 0 }}>
                        <button className={'uw-editbtn' + (tileQuote ? ' on' : '')} onClick={() => setTileQuote((v) => !v)}>
                          報價原文 {readN > 0 ? `已讀 ${readN}/${qItems.length}` : `${qItems.length} 條`}{qN > 0 ? `・疑問 ${qN}` : ''}
                        </button>
                        {tileQuote && (
                          <button className={'uw-editbtn' + (noteMode ? ' on' : '')} onClick={() => setNoteMode((v) => !v)}>
                            ✎ 筆記{noteMode ? '中' : ''}
                          </button>
                        )}
                      </div>
                      {tileQuote && (
                        <div className="uw-quote">
                          {qItems.map((it) => (
                            <div key={it.id} className="uw-quote-item">
                              {it.name && <div className="qm-name">{it.name}
                                {!noteMode && (it.marks || []).length > 0 && <i className="qr-markdot" style={{ background: (it.marks || []).includes('q') ? '#E0A55C' : '#9CBD48' }} />}
                              </div>}
                              {noteMode && (
                                <div className="qr-marks">
                                  {MARKS.map(([m, label]) => (
                                    <button key={m} className={'qr-chip' + ((it.marks || []).includes(m) ? ' on-' + m : '')}
                                      onClick={() => toggleMark(it, m)}>{label}</button>
                                  ))}
                                </div>
                              )}
                              <QuoteText text={it.text} interactive
                                annot={noteMode ? {
                                  notes: it.notes || [],
                                  onAdd: (line, text, q) => patchQuoteItem(it.id, { notes: [...(it.notes || []), { id: 'n' + Math.random().toString(36).slice(2, 9), line, text, q, at: Date.now() }] }),
                                  onDel: (nid) => patchQuoteItem(it.id, { notes: (it.notes || []).filter((n) => n.id !== nid) }),
                                } : undefined} />
                            </div>
                          ))}
                        </div>
                      )}
                    </>)
                  })()}
                  <div className="uw-treehead">
                    {editStruct && <span className="uw-treehead-hint">≡ 可拖曳改層；拖到本列＝單元最上層</span>}
                    <button className="uw-editbtn" onClick={() => setFlowUnit(u)}>
                      粗流 {(current.unitFlows || []).filter((f) => f.unit === u).length}
                      {(current.unitFlows || []).some((f) => f.unit === u && f.sealed) ? ' ✓' : ''}
                    </button>
                    {editStruct && <button className="uw-mini" title="在單元最上層新增頁" onClick={() => setAddingRoot(true)}><Plus size={13} /></button>}
                    <button className={'uw-editbtn' + (editStruct ? ' on' : '')} onClick={() => { setEditStruct((v) => !v); setAddingRoot(false) }}>
                      {editStruct ? '完成' : '編輯結構'}
                    </button>
                  </div>
                  {addingRoot && (
                    <div className="uw-newrow">
                      <input autoFocus value={rootName} placeholder="頁面名稱…" onChange={(e) => setRootName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && rootName.trim()) {
                            dispatch({ type: 'ADD_WIREFRAME', wireframes: [{ id: 'wf_' + Math.random().toString(36).slice(2, 10), unit: u, parentId: null, name: rootName.trim(), device: 'desktop', layout: 'stack', components: [] }] })
                            setRootName(''); setAddingRoot(false)
                          }
                        }} />
                      <button onClick={() => {
                        if (!rootName.trim()) return
                        dispatch({ type: 'ADD_WIREFRAME', wireframes: [{ id: 'wf_' + Math.random().toString(36).slice(2, 10), unit: u, parentId: null, name: rootName.trim(), device: 'desktop', layout: 'stack', components: [] }] })
                        setRootName(''); setAddingRoot(false)
                      }}>加入</button>
                    </div>
                  )}
                  {pageTree(current, u).map((n) => <TreeNode key={n.wf.id} node={n} project={current} depth={0} edit={editStruct} dispatch={dispatch} onMore={setMoreWf} subtreeIds={subtreeIds} onReq={setOpenReq} onSpec={setSpecWf} />)}
                  {pageTree(current, u).length === 0 && <div className="uw-empty">這個單元還沒有頁面 — 按「編輯結構 → ＋」直接新增，或到卡片的畫面地圖「建立此頁」</div>}
                  {looseReqs(current, u).length > 0 && (
                    <div className="uw-loose">
                      <span className="uw-loose-t">還沒掛到頁面：</span>
                      {looseReqs(current, u).map((r) => <span key={r.id} className={'uw-rq ' + ST_CLASS[statusOfReq(r)]}
                        onClick={(e) => { e.stopPropagation(); setOpenReq(r.id) }}>{r.name}</span>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <button className="uw-tile uw-add" onClick={addUnit}><Plus size={18} /><span>新增單元</span></button>
      </div>
      <div className="uw-legend">
        <span><i style={{ background: '#7BA7D4' }} />待確認</span>
        <span><i style={{ background: '#9CBD48' }} />已蓋章</span>
        <span><i style={{ background: '#E0A55C' }} />異動中</span>
        <span><i className="uw-lg-hot" />暖色＝有事</span>
      </div>
      </>}
      {deal && <DealMode onClose={() => setDeal(false)} />}
      {moreWf && <NodeSheet wf={moreWf} project={current} dispatch={dispatch} onClose={() => setMoreWf(null)} />}
      {flowUnit !== null && <UnitFlows unit={flowUnit} onClose={() => setFlowUnit(null)} />}
      {showQuote && <QuoteMap onClose={() => setShowQuote(false)} />}
      {specWf && <SpecSheet wfId={specWf} onClose={() => setSpecWf(null)} />}
      {showMeeting && <MeetingDoc onClose={() => setShowMeeting(false)} />}
      {openReq && (() => {
        const r = (current.requirements || []).find((x) => x.id === openReq)
        if (!r) return null
        const list = (current.requirements || []).filter((x) => (x.unit || '').trim() === (r.unit || '').trim())
        return <ReqDetailSheet startId={openReq} list={list} onClose={() => setOpenReq(null)} />
      })()}
    </div>
  )
}
