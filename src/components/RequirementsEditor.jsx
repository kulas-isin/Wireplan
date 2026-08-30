import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { newRequirement } from '../lib/requirementExtractor.js'
import { CATEGORY_LIST, categoryMeta } from '../lib/categories.js'
import InterviewMode from './InterviewMode.jsx'
import ChangeControl from './ChangeControl.jsx'
import MobileReqCard from './MobileReqCard.jsx'
import ReqCarousel from './ReqCarousel.jsx'
import ConfirmDoc from './ConfirmDoc.jsx'
import { requirementCoverage } from '../lib/sop.js'
import { isLocked } from '../lib/change.js'
import { generateWireframe } from '../lib/wireframeTemplates.js'
import { applyRequirementPatches, parsePatches } from '../lib/reqPatches.js'
import { ChevronUp, ChevronDown, RotateCw, Trash2, Wand2, Plus, ClipboardList, Mic, TriangleAlert, LayoutTemplate, Layers, Orbit, List, FileSignature, ClipboardPaste, X, MoreHorizontal, MessageSquareText, Search } from 'lucide-react'


function useIsMobile() {
  const [m, setM] = useState(() => window.matchMedia('(max-width: 720px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const on = (e) => setM(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return m
}


function RequirementRow({ req, index, total }) {
  const { dispatch } = useStore()
  const [open, setOpen] = useState(false)
  const cat = categoryMeta(req.category)
  const locked = isLocked(req)
  const lockTip = locked ? '已確認 — 要修改請先按 ✂ 拆封' : undefined

  const patch = (p) => dispatch({ type: 'UPDATE_REQUIREMENT', id: req.id, patch: p })

  return (
    <>
      <tr>
        <td>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <button className="ghost sm" disabled={index === 0} onClick={() => dispatch({ type: 'MOVE_REQUIREMENT', id: req.id, dir: -1 })}><ChevronUp size={14} /></button>
            <button className="ghost sm" disabled={index === total - 1} onClick={() => dispatch({ type: 'MOVE_REQUIREMENT', id: req.id, dir: 1 })}><ChevronDown size={14} /></button>
          </div>
        </td>
        <td style={{ width: '24%' }}>
          <input value={req.name} disabled={locked} title={lockTip} onChange={(e) => patch({ name: e.target.value })} />
        </td>
        <td>
          <select
            value={req.category}
            disabled={locked} title={lockTip}
            onChange={(e) => patch({ category: e.target.value })}
            style={{ borderLeft: `4px solid ${cat.color}` }}
          >
            {CATEGORY_LIST.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
        </td>
        <td style={{ width: 70 }}>
          <select value={req.priority} disabled={locked} title={lockTip} onChange={(e) => patch({ priority: e.target.value })}>
            <option>高</option><option>中</option><option>低</option>
          </select>
        </td>
        <td style={{ width: 96 }}><ChangeControl req={req} /></td>
        <td style={{ width: 80 }}><input value={req.estimate} disabled={locked} title={lockTip} onChange={(e) => patch({ estimate: e.target.value })} placeholder="工時" /></td>
        <td style={{ width: 90 }}><input value={req.price} disabled={locked} title={lockTip} onChange={(e) => patch({ price: e.target.value })} placeholder="報價" /></td>
        <td>
          <div className="req-actions">
            <button className="sm" onClick={() => setOpen((o) => !o)}>{open ? '收合' : '詳細'}</button>
            <button className="sm" title="依分類重新產生 wireframe" onClick={() => dispatch({ type: 'REGENERATE_WIREFRAME', requirementId: req.id })}><RotateCw size={13} /> 版面</button>
            <button className="sm danger" title="刪除" onClick={() => { if (locked) { alert('這條需求已確認（蓋章）。要刪除請先按 ✂ 拆封。'); return } if (confirm('刪除此需求？')) dispatch({ type: 'DELETE_REQUIREMENT', id: req.id }) }}><Trash2 size={13} /></button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="req-detail">
          <td colSpan={8} style={{ background: '#f8fafc' }}>
            <div className="grid2" style={{ padding: '6px 2px' }}>
              <label className="field">
                <span>功能說明</span>
                <textarea value={req.description} disabled={locked} title={lockTip} onChange={(e) => patch({ description: e.target.value })} />
              </label>
              <label className="field">
                <span>驗收條件（每行一條）</span>
                <textarea value={req.acceptance} disabled={locked} title={lockTip} onChange={(e) => patch({ acceptance: e.target.value })} placeholder="留空則使用預設驗收條件" />
              </label>
              <label className="field">
                <span>對應畫面名稱</span>
                <textarea rows={2} value={req.screen} disabled={locked} title={lockTip} onChange={(e) => patch({ screen: e.target.value })} />
              </label>
              <label className="field">
                <span>備註</span>
                <input value={req.note} disabled={locked} title={lockTip} onChange={(e) => patch({ note: e.target.value })} />
              </label>
            </div>
            {((req.versions || []).length > 0 || (req.changeLog || []).length > 0) && (
              <div className="req-history">
                {(req.versions || []).map((v) => <span key={'v' + v.v} className="st-badge st-green">v{v.v} ✓ {new Date(v.at).toLocaleDateString('zh-TW')}</span>)}
                {(req.changeLog || []).map((c, i) => <span key={'c' + i} className="req-h-change">✂ {new Date(c.at).toLocaleDateString('zh-TW')}：{c.note}</span>)}
              </div>
            )}
            <div className="row" style={{ paddingBottom: 8 }}>
              <button className="sm" onClick={() => dispatch({ type: 'REDETECT_CATEGORY', id: req.id })}><Wand2 size={13} /> 重新自動判斷分類</button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function RequirementsEditor() {
  const { current, dispatch } = useStore()
  const reqs = current.requirements
  const [interview, setInterview] = useState(false)
  const [wheel, setWheel] = useState(false)
  const [doc, setDoc] = useState(false)
  const [paste, setPaste] = useState(null) // null=關閉, ''=開啟輸入中, 其他=結果訊息
  const [sheet, setSheet] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [q, setQ] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [cat, setCat] = useState('all')
  const [status, setStatus] = useState('all')
  const isMobile = useIsMobile()

  const statusOf = (r) => (r.pending ? 'pending' : (r.versions || []).length ? 'confirmed' : 'draft')
  const stCounts = useMemo(() => {
    const c = { all: reqs.length, draft: 0, confirmed: 0, pending: 0 }
    for (const r of reqs) c[statusOf(r)]++
    return c
  }, [reqs])
  const cats = useMemo(() => {
    const m = new Map()
    for (const r of reqs) m.set(r.category, (m.get(r.category) || 0) + 1)
    return [...m.entries()]
  }, [reqs])
  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    return reqs.filter((r) => {
      if (status !== 'all' && statusOf(r) !== status) return false
      if (cat !== 'all' && r.category !== cat) return false
      if (!k) return true
      const texts = [r.name, r.note, r.screen, r.description, ...(r.talks || []).map((t) => t.text)]
      return texts.some((t) => String(t || '').toLowerCase().includes(k))
    })
  }, [reqs, q, cat, status])
  const filterKey = q + '|' + cat + '|' + status

  const copyLinePrompt = async () => {
    const cardsList = reqs.map((r) => ({ id: r.id, name: r.name }))
    const text = [
      '請閱讀我接著貼上的 LINE 對話紀錄，整理成需求對話串：',
      '1. 只萃取與下列需求卡相關的「關鍵訊息」，各改寫成精煉的一句（不要原文照貼；略過貼圖、寒暄、與需求無關的內容）',
      '2. 客戶提出/要求/決定的 → who:"client"；我方（接案方）回覆或確認的 → who:"us"',
      '3. 訊息有日期就帶 date（格式 YYYY/M/D）',
      '4. 對不到任何卡的重要新需求，用文字另外告訴我，不要塞進 JSON',
      '回傳單一 JSON：',
      '{"requirementPatches":[{"id":"卡片id","talks":[{"who":"client","text":"...","date":"2026/8/30"}]}]}',
      '',
      '需求卡：',
      JSON.stringify(cardsList, null, 1),
      '',
      '——以下是 LINE 對話紀錄——',
      '（把你的 LINE 紀錄貼在這裡再送出）',
    ].join('\n')
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove()
    }
    setSheet(false)
    setPasteText('')
    setPaste('已複製整理指令！貼給 AI 時把你的 LINE 紀錄接在後面。拿到 JSON 後貼回這裡按「套用」。')
  }

  const applyPaste = () => {
    const patches = parsePatches(pasteText)
    if (!patches) { setPaste('看不懂這段內容 — 請貼 AI 回傳的 requirementPatches JSON'); return }
    const r = applyRequirementPatches(reqs, patches, dispatch)
    setPaste(`已套用 ${r.applied} 張${r.talksAdded ? `、對話 +${r.talksAdded} 則` : ''}${r.elementsAdded ? `、元件 +${r.elementsAdded} 個` : ''}${r.renamed ? `、改名 ${r.renamed} 張（原名記在備註）` : ''}${r.skippedLocked ? `、${r.skippedLocked} 張已蓋章略過改名` : ''}${r.notFound ? `、${r.notFound} 筆對不到卡` : ''}`)
    setPasteText('')
  }

  function addBlank() {
    dispatch({ type: 'ADD_REQUIREMENT', requirement: newRequirement({ name: '新功能', screen: '新功能' }) })
  }

  if (interview) return <InterviewMode onClose={() => setInterview(false)} />

  if (!reqs.length) {
    return (
      <div className="empty">
        <div className="big"><ClipboardList size={40} /></div>
        <div>尚無需求項目</div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="primary" onClick={() => setInterview(true)}><Mic size={15} /> 訪談模式（快速記卡）</button>
          <button onClick={addBlank}><Plus size={15} /> 手動新增需求</button>
        </div>
        <div className="muted" style={{ marginTop: 8 }}>訪談時用手機開「訪談模式」邊聽邊記；或到「匯入」分頁匯入報價單。</div>
      </div>
    )
  }

  const missing = requirementCoverage(current)
  const genMissing = () => {
    const wfs = missing.map((r) => generateWireframe(r))
    if (wfs.length) dispatch({ type: 'ADD_WIREFRAME', wireframes: wfs })
  }

  return (
    <div>
      {doc && <ConfirmDoc onClose={() => setDoc(false)} />}
      {paste !== null && (
        <div className="cr-backdrop" onClick={() => setPaste(null)}>
          <div className="cr-panel ip-panel" onClick={(e) => e.stopPropagation()}>
            <div className="cr-head"><strong>匯入 AI 展開結果</strong><button className="ghost sm" onClick={() => setPaste(null)}><X size={16} /></button></div>
            <div className="cr-form">
              <textarea rows={7} autoFocus value={pasteText} placeholder='貼上 AI 回傳的 JSON（{"requirementPatches":[…]}）' onChange={(e) => setPasteText(e.target.value)} />
              {paste && <div className="ip-msg">{paste}</div>}
              <button className="tg-big primary" disabled={!pasteText.trim()} onClick={applyPaste}><ClipboardPaste size={15} /> 套用</button>
            </div>
          </div>
        </div>
      )}
      <div className="toolbar rp-tools">
        <strong>需求清單（{reqs.length} 項）</strong>
        <div className="spacer" />
        <button className="primary" onClick={() => setInterview(true)}><Mic size={15} /> 訪談</button>
        <button onClick={() => { window.location.hash = 'triage' }} title="收牌局：合併重複、掃優先度、複製摘要"><Layers size={15} /> 收整</button>
        <button className={wheel ? 'active' : ''} onClick={() => setWheel((w) => !w)} title="轉盤模式：快速翻滾找卡">{wheel ? <List size={15} /> : <Orbit size={15} />} {wheel ? '清單' : '轉盤'}</button>
        <button className={'rp-icbtn' + (showSearch || q ? ' active' : '')} onClick={() => { if (showSearch) { setQ('') } setShowSearch((v) => !v) }} title="搜尋"><Search size={17} /></button>
        <button className="rp-icbtn" onClick={addBlank} title="新增需求"><Plus size={18} /></button>
        <button className="rp-icbtn" onClick={() => setSheet(true)} title="更多功能"><MoreHorizontal size={18} /></button>
      </div>
      {sheet && (
        <div className="as-backdrop" onClick={() => setSheet(false)}>
          <div className="as-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="as-grab" />
            <button className="as-row" disabled={missing.length === 0} style={missing.length === 0 ? { opacity: .55 } : undefined}
              onClick={() => { if (!missing.length) return; setSheet(false); genMissing(); alert(`已依需求產生 ${missing.length} 頁，到「完整工作區 › Wireframe」查看`) }}>
              <span className="as-ic"><LayoutTemplate size={18} /></span>
              <span><b>產生缺頁畫面</b><small>{missing.length ? `${missing.length} 條需求還沒有頁面 → 一鍵產生` : '所有需求都已有對應頁面 ✓'}</small></span>
            </button>
            <button className="as-row" onClick={() => { setSheet(false); setDoc(true) }}>
              <span className="as-ic"><FileSignature size={18} /></span>
              <span><b>需求確認書</b><small>給客戶回簽的正式文件（列印 / 存 PDF）</small></span>
            </button>
            <button className="as-row" onClick={copyLinePrompt}>
              <span className="as-ic"><MessageSquareText size={18} /></span>
              <span><b>LINE 紀錄 → 對話串</b><small>複製整理指令，連同 LINE 紀錄貼給 AI，回來匯入</small></span>
            </button>
            <button className="as-row" onClick={() => { setSheet(false); setPaste(''); setPasteText('') }}>
              <span className="as-ic"><ClipboardPaste size={18} /></span>
              <span><b>匯入 AI 展開結果</b><small>貼上 JSON，自動回填說明與驗收條件</small></span>
            </button>
            <button className="as-row" onClick={() => { setSheet(false); dispatch({ type: 'REGENERATE_FLOW' }) }}>
              <span className="as-ic"><RotateCw size={18} /></span>
              <span><b>重新產生流程</b><small>依目前需求清單重建業務流程圖</small></span>
            </button>
          </div>
        </div>
      )}
      {missing.length > 0 && (
        <div className="fs-alert" style={{ marginBottom: 10 }}>
          <span className="fs-alert-new"><TriangleAlert size={14} /> {missing.length} 條需求還沒有對應頁面：{missing.slice(0, 4).map((r) => r.name).join('、')}{missing.length > 4 ? '…' : ''}
            <button className="sm" onClick={genMissing}><LayoutTemplate size={13} /> 一鍵產生缺頁</button>
          </span>
        </div>
      )}
      {showSearch && (
        <div className="rw-search">
          <Search size={16} />
          <input autoFocus value={q} placeholder="搜尋需求 / 對話 / 說明…" onChange={(e) => setQ(e.target.value)} />
          <span className="muted" style={{ fontSize: 12 }}>{list.length} 張</span>
        </div>
      )}
      <div className="rw-tabs">
        {[['all', `全部 ${stCounts.all}`], ['draft', `待確認 ${stCounts.draft}`], ['confirmed', `已確認 ${stCounts.confirmed}`], ['pending', `異動中 ${stCounts.pending}`]]
          .filter(([k]) => k === 'all' || stCounts[k] > 0)
          .map(([k, label]) => (
            <button key={k} className={'rw-tab' + (status === k ? ' on' : '')} onClick={() => setStatus(status === k ? 'all' : k)}>{label}</button>
          ))}
        <span className="rw-div" />
        {cats.map(([key, n]) => {
          const m = categoryMeta(key)
          return (
            <button key={key} className={'rw-tab' + (cat === key ? ' on' : '')} onClick={() => setCat(cat === key ? 'all' : key)}>
              <i style={{ background: m.color }} />{m.label} {n}
            </button>
          )
        })}
      </div>
      {wheel ? (
        <ReqCarousel list={list} filterKey={filterKey} />
      ) : isMobile ? (
        <div className="rq-list">
          {list.map((r) => <MobileReqCard key={r.id} req={r} index={reqs.findIndex((x) => x.id === r.id)} total={reqs.length} />)}
        </div>
      ) : (
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="req">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th>功能名稱</th>
              <th>分類（決定版面）</th>
              <th>優先</th>
              <th>確認</th>
              <th>工時</th>
              <th>報價</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <RequirementRow key={r.id} req={r} index={reqs.findIndex((x) => x.id === r.id)} total={reqs.length} />
            ))}
          </tbody>
        </table>
      </div>
      )}
      <div className="muted" style={{ fontSize: 12 }}>
        提示：變更「分類」後，按該列的「↻ 版面」可依新分類重新產生 wireframe；修改名稱／順序會即時反映到流程文件。
      </div>
    </div>
  )
}
