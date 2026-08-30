import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { COMPONENT_TYPES, generateWireframe } from '../lib/wireframeTemplates.js'
import { findPageByName, findElementOnPages, normalizeReqPages, pageBricks, groupOf, suggestPages } from '../lib/elements.js'
import { uid } from '../lib/id.js'
import { Plus, X, ArrowUpRight, Hammer, ArrowDownToLine } from 'lucide-react'

// 磚的調色：依元件性質分組上色，掃一眼就知道每頁裝了什麼
const GROUP_CLASS = { 按鈕: 'pm-b-btn', 資料輸入: 'pm-b-in', 資料展示: 'pm-b-out', 導覽: 'pm-b-nav', 回饋: 'pm-b-fb', 版面: 'pm-b-lay' }

// 規劃磚的快速面板：常用型別點一下就丟進頁卡，不用打字
const PALETTE = ['field', 'formgrid', 'searchbar', 'filter', 'upload', 'table', 'cardlist', 'chart', 'statcards', 'descriptions', 'tabs', 'steps', 'buttonRow', 'modal', 'alert']
const palLabel = (t) => (t === 'buttonRow' ? '按鈕' : COMPONENT_TYPES[t]?.label || t)

function Brick({ brick, hollow, onTap, onDel }) {
  return (
    <span className={'pm-brick ' + GROUP_CLASS[groupOf(brick.type)] + (hollow ? ' pm-hollow' : '')} onClick={onTap} title={hollow ? '規劃中，畫面上還沒有' : undefined}>
      {brick.label}
      {onDel && <button className="pm-bx" onClick={(e) => { e.stopPropagation(); onDel() }}><X size={10} /></button>}
    </span>
  )
}

// 畫面地圖：一條需求的頁面橫向排開。實線卡=已建（磚從 wireframe 即時算出，永遠是現況）；
// 虛線卡=規劃中（點面板加磚、一鍵建立成真頁，規劃的磚直接變成頁上元件）。
export default function PageMap({ req, pages, patch }) {
  const { current, dispatch } = useStore()
  const wfs = current.wireframes || []
  const planned = normalizeReqPages(req.pages)
  const [pal, setPal] = useState(null) // 開啟快速面板的規劃卡 index
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  // 卡片集合：規劃清單為主，已連結但沒在清單裡的頁補在後面（不用填也看得到現況）
  const cards = planned.map((p) => ({ ...p, wf: findPageByName(p.name, wfs) }))
  const extras = pages.filter((w) => !cards.some((c) => c.wf && c.wf.id === w.id))

  const setPlanned = (next) => patch({ pages: next })
  const jump = (pid) => { sessionStorage.setItem('wp-open-wf', pid); window.location.hash = 'wf' }
  const rename = (i, bi) => {
    const cur = planned[i].bricks[bi]
    const v = prompt('元件名稱', cur.label)
    if (v == null) return
    setPlanned(planned.map((p, j) => (j === i ? { ...p, bricks: p.bricks.map((b, k) => (k === bi ? { ...b, label: v.trim() || b.label } : b)) } : p)))
  }
  const addBrick = (i, type) => setPlanned(planned.map((p, j) => (j === i ? { ...p, bricks: [...p.bricks, { type, label: palLabel(type) }] } : p)))
  const delBrick = (i, bi) => setPlanned(planned.map((p, j) => (j === i ? { ...p, bricks: p.bricks.filter((_, k) => k !== bi) } : p)))
  const delPage = (i) => { if (planned[i].bricks.length === 0 || confirm(`移除規劃頁「${planned[i].name}」？（不影響已建畫面）`)) setPlanned(planned.filter((_, j) => j !== i)) }
  const addPage = () => {
    const t = name.trim()
    if (!t) return
    setPlanned([...planned, { name: t, bricks: [] }])
    setName(''); setNaming(false)
  }
  const fillSuggest = () => {
    const sug = suggestPages(req).filter((n) => !planned.some((p) => p.name === n))
    if (!sug.length) { alert('這個分類的建議頁面都已在地圖上了'); return }
    setPlanned([...planned, ...sug.map((n) => ({ name: n, bricks: [] }))])
  }
  // 建立：規劃的磚直接變成頁上元件；沒放磚就退回分類範本
  const build = (entry) => {
    const comps = entry.bricks.length
      ? entry.bricks.map((b) => (b.type === 'buttonRow'
        ? { id: uid('cmp'), type: 'buttonRow', label: '', width: 'full', buttons: [b.label.replace(/(按鈕|鈕)$/, '')] }
        : { id: uid('cmp'), type: b.type, label: b.label, width: 'full' }))
      : generateWireframe(req).components
    dispatch({ type: 'ADD_WIREFRAME', wireframes: [{ id: uid('wf'), requirementId: req.id, name: entry.name, device: 'desktop', layout: 'stack', template: req.category, components: comps }] })
  }

  return (
    <div className="pm-wrap">
      <div className="pm-strip">
        {cards.map((c, i) => c.wf ? (
          // 已建：磚即時從 wireframe 算出；規劃了但頁上還沒有的磚以空心顯示（漏元件一眼看到）
          <div key={'p' + i} className="pm-card" onClick={() => jump(c.wf.id)}>
            <div className="pm-name">{c.wf.name} <ArrowUpRight size={12} /></div>
            <div className="pm-bricks">
              {pageBricks(c.wf).map((b, bi) => <Brick key={bi} brick={b} />)}
              {c.bricks.filter((b) => !findElementOnPages(b.label, [c.wf])).map((b, bi) => <Brick key={'h' + bi} brick={b} hollow />)}
            </div>
          </div>
        ) : (
          <div key={'p' + i} className="pm-card pm-ghost">
            <div className="pm-name">{c.name}<button className="pm-px" onClick={() => delPage(i)}><X size={12} /></button></div>
            <div className="pm-bricks">
              {c.bricks.map((b, bi) => <Brick key={bi} brick={b} onTap={() => rename(i, bi)} onDel={() => delBrick(i, bi)} />)}
              <button className="pm-brickadd" onClick={() => setPal(pal === i ? null : i)}><Plus size={12} /> 元件</button>
            </div>
            {pal === i && (
              <div className="pm-pal">
                {PALETTE.map((t) => <button key={t} className={'pm-brick ' + GROUP_CLASS[groupOf(t)]} onClick={() => addBrick(i, t)}>{palLabel(t)}</button>)}
              </div>
            )}
            <button className="pm-mk" onClick={() => build(c)}><Hammer size={12} /> 建立此頁</button>
          </div>
        ))}
        {extras.map((w) => (
          <div key={w.id} className="pm-card" onClick={() => jump(w.id)}>
            <div className="pm-name">{w.name} <ArrowUpRight size={12} /></div>
            <div className="pm-bricks">{pageBricks(w).map((b, bi) => <Brick key={bi} brick={b} />)}</div>
          </div>
        ))}
        <div className="pm-card pm-add">
          {naming ? (
            <>
              <input autoFocus value={name} placeholder="頁面名稱…" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addPage() }} />
              <button className="pm-mk" onClick={addPage}>加入</button>
            </>
          ) : (
            <button className="pm-addbtn" onClick={() => setNaming(true)}><Plus size={16} /><span>加一頁</span></button>
          )}
        </div>
      </div>
      {cards.length === 0 && extras.length === 0 && (
        <div className="al-empty">這條需求該有哪幾頁？「加一頁」逐頁放磚，或先 <button className="al-add" style={{ display: 'inline-flex' }} onClick={fillSuggest}><ArrowDownToLine size={12} /> 依分類帶入建議頁</button></div>
      )}
      {(cards.length > 0 || extras.length > 0) && (
        <button className="al-add" onClick={fillSuggest}><ArrowDownToLine size={13} /> 依分類帶入建議頁</button>
      )}
    </div>
  )
}
