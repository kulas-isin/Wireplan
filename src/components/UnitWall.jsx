import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/StoreContext.jsx'
import { unitsOf, unitStats, pageTree, reqsOfPage, looseReqs, unassignedReqs, statusOfReq } from '../lib/units.js'
import { linkedPages } from '../lib/elements.js'
import { Plus, X, ArrowUpRight, Stamp, Undo2, ChevronDown, ChevronRight } from 'lucide-react'

const ST_CLASS = ['uw-st0', 'uw-st1', 'uw-st2'] // 待確認 / 已蓋章 / 異動

// 頁面樹節點：頁名 + 需求膠囊；點列展開/收合、點跳轉圖示進 Wireframe
function TreeNode({ node, project, depth }) {
  const [open, setOpen] = useState(depth === 0)
  const reqs = reqsOfPage(project, node.wf)
  const jump = (e) => {
    e.stopPropagation()
    sessionStorage.setItem('wp-open-wf', node.wf.id)
    window.location.hash = 'wf'
  }
  const hasBody = reqs.length > 0 || node.kids.length > 0
  return (
    <div className="uw-node">
      <div className="uw-nrow" role="button" onClick={() => hasBody && setOpen((o) => !o)}>
        <span className="uw-caret">{hasBody ? (open ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : <i className="uw-leaf" />}</span>
        <span className="uw-nname">{node.wf.name}</span>
        {reqs.length > 0 && <span className="uw-ncnt">{reqs.length} 需求</span>}
        <button className="uw-jump" title="到 Wireframe 開這頁" onClick={jump}><ArrowUpRight size={13} /></button>
      </div>
      {open && (
        <div className="uw-nbody">
          {reqs.length > 0 && (
            <div className="uw-reqs">
              {reqs.map((r) => <span key={r.id} className={'uw-rq ' + ST_CLASS[statusOfReq(r)]}>{r.name}</span>)}
            </div>
          )}
          {node.kids.length > 0 && (
            <div className="uw-kids">
              {node.kids.map((k) => <TreeNode key={k.wf.id} node={k} project={project} depth={depth + 1} />)}
            </div>
          )}
        </div>
      )}
    </div>
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
              onClick={() => setOpenUnit(open ? null : u)}>
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
                <div className="uw-tree" onClick={(e) => e.stopPropagation()}>
                  {pageTree(current, u).map((n) => <TreeNode key={n.wf.id} node={n} project={current} depth={0} />)}
                  {pageTree(current, u).length === 0 && <div className="uw-empty">這個單元還沒有頁面 — 到卡片的畫面地圖「建立此頁」，或在 Wireframe 把頁面的單元設成「{u}」</div>}
                  {looseReqs(current, u).length > 0 && (
                    <div className="uw-loose">
                      <span className="uw-loose-t">還沒掛到頁面：</span>
                      {looseReqs(current, u).map((r) => <span key={r.id} className={'uw-rq ' + ST_CLASS[statusOfReq(r)]}>{r.name}</span>)}
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
      {deal && <DealMode onClose={() => setDeal(false)} />}
    </div>
  )
}
