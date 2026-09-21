import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/StoreContext.jsx'
import { statusOfReq } from '../lib/units.js'
import Mermaid from './Mermaid.jsx'
import QuoteText from './QuoteText.jsx'
import { X, Plus, Pencil, Trash2, GitBranch, Stamp, ListChecks, ChevronDown, ChevronUp, ScrollText, PanelRightClose, PanelRightOpen, Upload } from 'lucide-react'

// 定稿前檢查清單：把防漏心法變成強制動作（全勾才能蓋章）
const SEAL_CHECKS = [
  '每個分支、每個箭頭都有去處，沒有沒下文的節點',
  '失敗／例外路徑已畫出，或已另開一張「例外」圖',
  '每個關鍵轉換都知道由誰觸發（人員／系統／排程）',
  '圖上沒有還沒跟客戶對完的懸念',
]

// 圖型分類（分頁籤）＋各自的整潔起手範本
export const FLOW_KINDS = [
  ['main', '主流程'],
  ['alt', '例外／失敗'],
  ['state', '狀態機'],
  ['edge', '系統邊界'],
  ['sched', '排程作業'],
  ['other', '其他'],
]
const KIND_LABEL = Object.fromEntries(FLOW_KINDS)
const TEMPLATES = {
  main: (scope) => `flowchart TD
  %% ${scope}：主流程（節點字保持短，細節寫在邊上）
  A["開始"] --> B{"條件判斷？"}
  B -->|"是"| C["處理"]
  B -->|"否"| D["替代路徑"]
  C --> E["完成"]
  D --> E
`,
  alt: (scope) => `flowchart TD
  %% ${scope}：例外／失敗路徑（每個失敗都要有去處）
  A["正常步驟"] -->|"失敗"| B{"可重試？"}
  B -->|"是"| C["自動重試"] --> A
  B -->|"否"| D["記錄並通知"] --> E["人工處理"]
`,
  state: (scope) => `stateDiagram-v2
  %% ${scope}：狀態機（誰能觸發轉換、能否回頭）
  [*] --> 待處理
  待處理 --> 處理中 : 人員接手
  處理中 --> 已完成 : 完成條件
  處理中 --> 已取消 : 取消（不可回復）
  已完成 --> [*]
`,
  edge: (scope) => `flowchart LR
  %% ${scope}：系統邊界（箭頭標資料方向與內容）
  subgraph OUR["我們的系統"]
    A["核心模組"]
  end
  subgraph EXT["外部系統"]
    B["第三方服務"]
  end
  A -->|"推送：資料類型"| B
  B -->|"回傳：狀態"| A
`,
  sched: (scope) => `flowchart LR
  %% ${scope}：排程作業（頻率＋失敗處理）
  T["排程：每 N 分鐘"] --> A["作業內容"]
  A -->|"成功"| L["寫入作業記錄"]
  A -->|"失敗"| R["自動重試"] -->|"仍失敗"| N["通知"]
`,
  other: (scope) => TEMPLATES.main(scope),
}

// 流程圖檢視器：scope 由 unit 決定（'' ＝ 專案級，字串＝單元級；頁面級預留 pageId 欄位）。
// 每張圖：kind 分類、版本履歷（變更原因＋時間）、定稿標記；左右滑切換上下張。
export default function UnitFlows({ unit, onClose, focusId }) {
  const { current, dispatch } = useStore()
  const isProject = !unit
  const scopeName = isProject ? '專案級' : unit
  const all = current.unitFlows || []
  const scoped = all.filter((f) => (f.unit || '') === (unit || ''))
  const [kindTab, setKindTab] = useState('all')
  const flows = kindTab === 'all' ? scoped : scoped.filter((f) => (f.kind || 'main') === kindTab)
  const kindsPresent = [...new Set(scoped.map((f) => f.kind || 'main'))]
  const save = (next) => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'unitFlows', value: next })
  const [viewVer, setViewVer] = useState({})
  const [idx, setIdx] = useState(() => { // focusId：從需求卡/規格頁的流程 chip 直達指定圖
    if (!focusId) return 0
    const i = all.filter((f) => (f.unit || '') === (unit || '')).findIndex((f) => f.id === focusId)
    return i >= 0 ? i : 0
  })
  const cur = Math.min(idx, Math.max(0, flows.length - 1))
  const go = (d) => { const n = cur + d; if (n < 0 || n >= flows.length) return; setIdx(n) }
  // 桌機鍵盤：←→ 換流程圖（輸入中不搶）、Esc 逐層關（編輯器 → 整頁）
  const keyRef = useRef({})
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
      const k = keyRef.current
      if (e.key === 'Escape') { k.editing ? k.setEditing(null) : onClose() }
      else if (!k.editing && e.key === 'ArrowLeft') k.go(-1)
      else if (!k.editing && e.key === 'ArrowRight') k.go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line
  const onTS = (e) => {
    if (e.target.closest && e.target.closest('.mermaid-box, .uf-code, .uf-check, .uf-cov, .uf-sealask, .uf-rev, input, textarea, button')) { window.__ufTouch = null; return }
    window.__ufTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTE = (e) => {
    const t = window.__ufTouch
    window.__ufTouch = null
    if (!t || editing) return
    const dx = e.changedTouches[0].clientX - t.x
    const dy = e.changedTouches[0].clientY - t.y
    if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 2) go(dx < 0 ? 1 : -1)
  }
  const [editing, setEditing] = useState(null) // { flowId|null, name, code, note, kind, pristine }
  keyRef.current = { go, editing, setEditing }
  const [preview, setPreview] = useState('')
  useEffect(() => {
    if (!editing) return
    const t = setTimeout(() => setPreview(editing.code), 600)
    return () => clearTimeout(t)
  }, [editing?.code]) // eslint-disable-line

  const openNew = () => {
    const kind = kindTab !== 'all' ? kindTab : 'main'
    setPreview('')
    setEditing({ flowId: null, name: '', code: TEMPLATES[kind](scopeName), note: '', kind, pristine: true })
  }
  const pickKind = (k) => setEditing((s) => ({
    ...s, kind: k,
    code: s.pristine ? TEMPLATES[k](scopeName) : s.code, // 還沒動過內容才換範本
  }))
  const openEdit = (f) => {
    const curV = f.versions[f.versions.length - 1]
    setPreview('')
    setEditing({ flowId: f.id, name: f.name, code: curV.code, note: '', kind: f.kind || 'main', pristine: false })
  }
  const commit = () => {
    const { flowId, name, code, note, kind } = editing
    if (!code.trim()) return
    if (!flowId) {
      if (!name.trim()) { alert('幫這張流程圖取個名字'); return }
      save([...all, { id: 'uf_' + Math.random().toString(36).slice(2, 10), unit: unit || '', kind, name: name.trim(), versions: [{ v: 1, at: Date.now(), note: '初版', code }] }])
    } else {
      if (!note.trim()) { alert('寫一句變更原因 — 之後回看才知道為什麼改'); return }
      save(all.map((f) => f.id === flowId ? { ...f, kind, sealed: null, versions: [...f.versions, { v: f.versions.length + 1, at: Date.now(), note: note.trim(), code }] } : f))
      setViewVer((m) => ({ ...m, [flowId]: undefined }))
    }
    setEditing(null)
  }
  const remove = (f) => {
    if (!confirm(`刪除流程圖「${f.name}」與其全部 ${f.versions.length} 個版本？`)) return
    save(all.filter((x) => x.id !== f.id))
  }

  // 匯入流程檔：只新增（id 已存在的略過），既有圖與定稿完全不動
  const flowFileRef = useRef(null)
  const importFlows = (file) => {
    if (!file) return
    const rd = new FileReader()
    rd.onload = () => {
      try {
        const parsed = JSON.parse(rd.result)
        const inc = Array.isArray(parsed) ? parsed : parsed.unitFlows
        if (!Array.isArray(inc)) { alert('檔案裡找不到 unitFlows 陣列') ; return }
        const have = new Set(all.map((f) => f.id))
        const add = inc.filter((f) => f && f.id && f.name && Array.isArray(f.versions) && f.versions.length && !have.has(f.id))
        if (!add.length) { alert('沒有可新增的流程圖（全部已存在或格式不符）'); return }
        save([...all, ...add])
        alert(`已新增 ${add.length} 張流程圖草稿${inc.length - add.length ? `（略過已存在 ${inc.length - add.length} 張）` : ''}，既有圖與定稿不受影響`)
      } catch { alert('不是有效的 JSON 檔') }
    }
    rd.readAsText(file)
  }

  // 定稿檢查清單：sealAsk = 流程圖 id，checks = 已勾的索引
  const [sealAsk, setSealAsk] = useState(null)
  const [sealChecks, setSealChecks] = useState([])
  const doSeal = (f) => {
    save(all.map((x) => x.id === f.id ? { ...x, sealed: { v: x.versions.length, at: Date.now() } } : x))
    setSealAsk(null)
  }

  // 修改備註：先記方向、不動圖 —— 累積後「複製給 AI」改 mermaid，回來再存新版
  // flow.revNotes = [{ id, text, assess, at, done }]；assess = 需評估（超出目前範圍，用詞刻意不寫「規格外」）
  const [revAdd, setRevAdd] = useState('')
  const [revAssess, setRevAssess] = useState(false)
  const [copiedAI, setCopiedAI] = useState(false)
  const patchFlow = (fid, p) => save(all.map((x) => x.id === fid ? { ...x, ...p } : x))
  const addRevNote = (f) => {
    if (!revAdd.trim()) return
    patchFlow(f.id, { revNotes: [...(f.revNotes || []), { id: 'rn' + Math.random().toString(36).slice(2, 9), text: revAdd.trim(), assess: revAssess, at: Date.now(), done: false }] })
    setRevAdd(''); setRevAssess(false)
  }
  const copyForAI = async (f, ver) => {
    const open = (f.revNotes || []).filter((n) => !n.done)
    const lines = open.map((n, i) => `${i + 1}. ${n.text}${n.assess ? '（需評估）' : ''}`).join('\n')
    const txt = `請幫我修改這張 mermaid 流程圖（維持整潔：節點字短、細節寫在邊標籤、文字用引號、失敗路徑要有去處）：\n\n【流程圖】${f.name}（${scopeName}・目前 v${ver.v}）\n【修改方向】\n${lines}\n\n【目前的 mermaid】\n\`\`\`mermaid\n${ver.code.trim()}\n\`\`\`\n\n請回傳完整修改後的 mermaid 程式碼。`
    try { await navigator.clipboard.writeText(txt); setCopiedAI(f.id); setTimeout(() => setCopiedAI(false), 2500) } catch { alert('複製失敗，請手動選取') }
  }

  // 需求涵蓋盤點（單元級才有）：flow.covers = 需求 id 陣列；盤點是記錄不是規格，定稿後仍可勾
  const unitReqs = isProject ? [] : (current.requirements || []).filter((r) => (r.unit || '').trim() === unit)
  const coveredAnywhere = new Set(scoped.flatMap((f) => f.covers || []))
  const orphans = unitReqs.filter((r) => !coveredAnywhere.has(r.id))
  const isDesk = typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches
  // 桌機側欄可收合（收起時圖吃滿整寬），偏好記在裝置
  const [sideOpen, setSideOpen] = useState(() => { try { return localStorage.getItem('wp-uf-side') !== 'off' } catch { return true } })
  const toggleSide = () => setSideOpen((o) => { try { localStorage.setItem('wp-uf-side', o ? 'off' : 'on') } catch {} return !o })
  const [covOpen, setCovOpen] = useState(null) // null=預設（桌機側欄展開/手機收合）、'closed'=收、id=展開
  const [quoteOpen, setQuoteOpen] = useState(null) // 展開報價原文的需求 id
  const quoteItems = current.quote?.items || []
  const quotesOfReq = (reqId) => quoteItems.filter((it) => (it.reqIds || []).includes(reqId))
  const toggleCover = (f, reqId) => {
    const cov = new Set(f.covers || [])
    cov.has(reqId) ? cov.delete(reqId) : cov.add(reqId)
    save(all.map((x) => x.id === f.id ? { ...x, covers: [...cov] } : x))
  }
  const ST_COLOR = ['#2E5F96', '#4E7A2E', '#B0691F'] // 待確認/已蓋章/異動中

  return createPortal(
    <div className="uf-wrap" onTouchStart={onTS} onTouchEnd={onTE}>
      <div className="uf-head">
        <GitBranch size={18} />
        <strong>{isProject ? '專案級流程圖' : scopeName + ' · 單元流程'}（{scoped.length}）</strong>
        <div className="spacer" />
        <input ref={flowFileRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={(e) => { importFlows(e.target.files?.[0]); e.target.value = '' }} />
        <button className="uw-mini" title="匯入流程檔（只新增草稿，不動既有圖與定稿）" onClick={() => flowFileRef.current?.click()}><Upload size={14} /></button>
        <button className="uf-new" onClick={openNew}><Plus size={14} /> 新增</button>
        <button className="rd-back" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="uf-body">
        {(kindsPresent.length > 1 || flows.length > 1) && (
          <div className="uw-modes uf-tabs">
            {kindsPresent.length > 1 && (<>
              <button className={kindTab === 'all' ? 'on' : ''} onClick={() => { setKindTab('all'); setIdx(0) }}>全部 {scoped.length}</button>
              {FLOW_KINDS.filter(([k]) => kindsPresent.includes(k)).map(([k, label]) => (
                <button key={k} className={kindTab === k ? 'on' : ''} onClick={() => { setKindTab(k); setIdx(0) }}>
                  {label} {scoped.filter((f) => (f.kind || 'main') === k).length}
                </button>
              ))}
            </>)}
            {flows.length > 1 && (
              <span className="uf-pager">
                <button disabled={cur === 0} onClick={() => go(-1)}>‹</button>
                <span>{cur + 1}/{flows.length}</span>
                <button disabled={cur === flows.length - 1} onClick={() => go(1)}>›</button>
              </span>
            )}
          </div>
        )}
        {flows.length === 0 && (
          <div className="uf-empty">
            {isProject
              ? <>還沒有專案級流程圖。建議三張：<b>全站架構</b>、<b>核心價值流</b>（錢和貨的端到端主線）、<b>系統邊界</b>（我們 vs 外部系統）。</>
              : <>這個單元還沒有流程圖。建議 1~3 張：<b>主流程</b>＋必要的<b>例外情境</b>；有多狀態單據的單元補一張<b>狀態機</b>。<br />流程「定稿」後再開始長頁面；頁面級細流留到 wireframe 階段。</>}
          </div>
        )}
        {flows.filter((_, i) => i === cur).map((f) => {
          const vIdx = viewVer[f.id] ?? f.versions.length - 1
          const ver = f.versions[vIdx]
          return (
            <div key={f.id} className="uf-card">
              <div className="uf-card-head">
                <strong>{f.name}</strong>
                <span className="uf-kind">{KIND_LABEL[f.kind || 'main']}</span>
                <span className="uf-vchips">
                  {f.versions.map((v, i) => (
                    <button key={v.v} className={'uf-vchip' + (i === vIdx ? ' on' : '')}
                      onClick={() => setViewVer((m) => ({ ...m, [f.id]: i }))}>v{v.v}{f.sealed?.v === v.v ? ' ✓' : ''}</button>
                  ))}
                </span>
                {f.sealed
                  ? <span className="uf-sealed"><Stamp size={11} /> v{f.sealed.v} 已定稿</span>
                  : <button className="uf-sealbtn" title="流程定下來了 — 之後可以進下一階段"
                      onClick={() => { setSealChecks([]); setSealAsk(sealAsk === f.id ? null : f.id) }}>
                      <Stamp size={11} /> 定稿此版</button>}
                <div className="spacer" />
                <button className="uw-mini uf-sidebtn" title={sideOpen ? '收起側欄，圖吃滿整寬' : '展開盤點側欄'} onClick={toggleSide}>
                  {sideOpen ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}</button>
                <button className="uw-mini" title="改一版（保留舊版；已定稿改版後回到未定稿）" onClick={() => openEdit(f)}><Pencil size={13} /></button>
                <button className="uw-mini uf-del" title="刪除" onClick={() => remove(f)}><Trash2 size={13} /></button>
              </div>
              {vIdx !== f.versions.length - 1 && <div className="uf-oldnote">正在看 v{ver.v}（舊版）— 點最後一顆版本 chip 回到現行版</div>}
              {sealAsk === f.id && !f.sealed && (
                <div className="uf-sealask">
                  <div className="uf-sealask-title">定稿前過一遍（全勾才能蓋章）</div>
                  {SEAL_CHECKS.map((txt, i) => (
                    <label key={i} className="uf-check">
                      <input type="checkbox" checked={sealChecks.includes(i)}
                        onChange={() => setSealChecks((s) => s.includes(i) ? s.filter((x) => x !== i) : [...s, i])} />
                      <span>{txt}</span>
                    </label>
                  ))}
                  <div className="uf-sealask-btns">
                    <button className="uf-sealbtn" onClick={() => setSealAsk(null)}>先不定稿</button>
                    <button className="uf-sealgo" disabled={sealChecks.length < SEAL_CHECKS.length}
                      onClick={() => doSeal(f)}><Stamp size={12} /> 蓋章定稿 v{f.versions.length}</button>
                  </div>
                </div>
              )}
              <div className={'uf-cols' + (sideOpen ? '' : ' side-off')}>{/* 桌機雙欄：左圖、右盤點＋履歷；手機維持直排 */}
              <div className="uf-main"><Mermaid code={ver.code} /></div>
              <div className="uf-side">
              <div className="uf-rev">
                <div className="uf-rev-head"><Pencil size={12} /> 修改備註<span className="ps-kind">先記方向，改好再存新版</span></div>
                {(f.revNotes || []).map((n) => (
                  <div key={n.id} className={'uf-rev-note' + (n.done ? ' done' : '')}>
                    <input type="checkbox" checked={n.done} title="已反映到新版"
                      onChange={() => patchFlow(f.id, { revNotes: f.revNotes.map((x) => x.id === n.id ? { ...x, done: !x.done, doneAt: x.done ? null : Date.now() } : x) })} />
                    <span className="uf-rev-text">{n.text}</span>
                    {n.assess && <span className="uf-rev-tag">需評估</span>}
                    <button className="qr-note-del" onClick={() => patchFlow(f.id, { revNotes: f.revNotes.filter((x) => x.id !== n.id) })}>✕</button>
                  </div>
                ))}
                <div className="uf-rev-add">
                  <input value={revAdd} placeholder="要往哪個方向改…" onChange={(e) => setRevAdd(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addRevNote(f)} />
                  <button className="uw-mini" onClick={() => addRevNote(f)}><Plus size={13} /></button>
                </div>
                <div className="uf-rev-row">
                  <label className="qr-qtoggle"><input type="checkbox" checked={revAssess} onChange={() => setRevAssess(!revAssess)} /> 需評估</label>
                  <div className="spacer" />
                  {(f.revNotes || []).some((n) => !n.done) && (
                    <button className="uf-sealbtn" onClick={() => copyForAI(f, ver)}>
                      {copiedAI === f.id ? '已複製' : '複製修改指示'}</button>
                  )}
                </div>
              </div>
              {!isProject && unitReqs.length > 0 && (
                <div className="uf-cov">
                  <button className="uf-cov-head" onClick={() => setCovOpen((covOpen === null ? isDesk : covOpen === f.id) ? 'closed' : f.id)}>
                    <ListChecks size={13} />
                    <span>需求涵蓋 {(f.covers || []).filter((id) => unitReqs.some((r) => r.id === id)).length}/{unitReqs.length}</span>
                    {orphans.length > 0 && <span className="uf-cov-gap">單元缺口 {orphans.length}</span>}
                    <div className="spacer" />
                    {(covOpen === null ? isDesk : covOpen === f.id) ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  {(covOpen === null ? isDesk : covOpen === f.id) && (
                    <div className="uf-cov-body">
                      {unitReqs.map((r) => {
                        const qts = quotesOfReq(r.id)
                        return (
                          <div key={r.id}>
                            <div className="uf-covrow">
                              <label className="uf-check">
                                <input type="checkbox" checked={(f.covers || []).includes(r.id)} onChange={() => toggleCover(f, r.id)} />
                                <i className="uf-cov-dot" style={{ background: ST_COLOR[statusOfReq(r)] }} />
                                <span>{r.name}</span>
                              </label>
                              {qts.length > 0 && (
                                <button className={'uf-quotebtn' + (quoteOpen === r.id ? ' on' : '')} title="報價原文"
                                  onClick={() => setQuoteOpen(quoteOpen === r.id ? null : r.id)}><ScrollText size={12} /></button>
                              )}
                            </div>
                            {quoteOpen === r.id && qts.map((it) => (
                              <div key={it.id} className="uf-quote">
                                <div className="uf-quote-name"><ScrollText size={11} /> {it.name}｜報價原文</div>
                                <QuoteText text={it.text} />
                              </div>
                            ))}
                          </div>
                        )
                      })}
                      {orphans.length > 0
                        ? <div className="uf-cov-note">還有 {orphans.length} 條需求未被任何流程涵蓋：{orphans.map((r) => r.name).join('、')} — 是漏畫流程，還是需求本身多餘？</div>
                        : <div className="uf-cov-note ok">此單元所有需求都已被流程涵蓋 — 可以開始長頁面。</div>}
                    </div>
                  )}
                </div>
              )}
              <div className="ht-wrap">
                <span className="ht-title">版本履歷</span>
                {f.versions.map((v) => (
                  <div key={v.v} className="ht-row ht-seal">
                    <span className="ht-dot" style={{ fontSize: 10, fontWeight: 800 }}>v{v.v}</span>
                    <span className="ht-txt">{v.note}{f.sealed?.v === v.v ? '（定稿）' : ''}</span>
                    <span className="ht-date">{new Date(v.at).toLocaleDateString('zh-TW')}</span>
                  </div>
                ))}
              </div>
              </div>{/* /uf-side */}
              </div>{/* /uf-cols */}
            </div>
          )
        })}
      </div>

      {editing && (
        <div className="uf-editor">
          <div className="uf-head">
            <strong>{editing.flowId ? '改一版：' + editing.name : '新增流程圖（' + scopeName + '）'}</strong>
            <div className="spacer" />
            <button className="rd-back" onClick={() => setEditing(null)}><X size={16} /></button>
          </div>
          <div className="uf-editor-body">
            <div className="uw-modes">
              {FLOW_KINDS.map(([k, label]) => (
                <button key={k} className={editing.kind === k ? 'on' : ''} onClick={() => pickKind(k)}>{label}</button>
              ))}
            </div>
            {!editing.flowId && (
              <input className="uf-input" autoFocus value={editing.name} placeholder="流程圖名稱（如：訂單到出貨主流程）"
                onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))} />
            )}
            {editing.flowId && (
              <input className="uf-input" autoFocus value={editing.note} placeholder="變更原因（必填，如：客戶要求加入退款分支）"
                onChange={(e) => setEditing((s) => ({ ...s, note: e.target.value }))} />
            )}
            <textarea className="uf-code" rows={12} value={editing.code} spellCheck={false}
              onChange={(e) => setEditing((s) => ({ ...s, code: e.target.value, pristine: false }))} />
            <div className="uf-tips">
              整潔要領：直向流程用 <b>TD</b>、管線/串接用 <b>LR</b>；節點字短、細節寫在邊標籤；
              角色/系統邊界用 <b>subgraph</b> 當泳道；失敗與例外路徑一定要畫；狀態機用 <b>stateDiagram-v2</b>；文字一律用引號包住。
            </div>
            {preview && <><div className="ht-title" style={{ padding: '4px 2px' }}>預覽</div><Mermaid code={preview} /></>}
            <button className="tg-big primary" onClick={commit}>{editing.flowId ? '存為 v' + ((all.find((x) => x.id === editing.flowId)?.versions.length || 0) + 1) : '建立流程圖'}</button>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
