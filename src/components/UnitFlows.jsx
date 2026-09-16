import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/StoreContext.jsx'
import Mermaid from './Mermaid.jsx'
import { X, Plus, Pencil, Trash2, GitBranch, Stamp } from 'lucide-react'

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
export default function UnitFlows({ unit, onClose }) {
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
  const [idx, setIdx] = useState(0)
  const cur = Math.min(idx, Math.max(0, flows.length - 1))
  const go = (d) => { const n = cur + d; if (n < 0 || n >= flows.length) return; setIdx(n) }
  const onTS = (e) => {
    if (e.target.closest && e.target.closest('.mermaid-box, .uf-code, input, textarea, button')) { window.__ufTouch = null; return }
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

  return createPortal(
    <div className="uf-wrap" onTouchStart={onTS} onTouchEnd={onTE}>
      <div className="uf-head">
        <GitBranch size={18} />
        <strong>{isProject ? '專案級流程圖' : scopeName + ' · 單元粗流'}（{scoped.length}）</strong>
        <div className="spacer" />
        <button className="uf-new" onClick={openNew}><Plus size={14} /> 新增</button>
        <button className="rd-back" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="uf-body">
        {kindsPresent.length > 1 && (
          <div className="uw-modes uf-tabs">
            <button className={kindTab === 'all' ? 'on' : ''} onClick={() => { setKindTab('all'); setIdx(0) }}>全部 {scoped.length}</button>
            {FLOW_KINDS.filter(([k]) => kindsPresent.includes(k)).map(([k, label]) => (
              <button key={k} className={kindTab === k ? 'on' : ''} onClick={() => { setKindTab(k); setIdx(0) }}>
                {label} {scoped.filter((f) => (f.kind || 'main') === k).length}
              </button>
            ))}
          </div>
        )}
        {flows.length > 1 && (
          <div className="rd-nav">
            <button disabled={cur === 0} onClick={() => go(-1)}>‹</button>
            <span>{cur + 1} / {flows.length}</span>
            <button disabled={cur === flows.length - 1} onClick={() => go(1)}>›</button>
          </div>
        )}
        {flows.length === 0 && (
          <div className="uf-empty">
            {isProject
              ? <>還沒有專案級流程圖。建議三張：<b>全站架構</b>、<b>核心價值流</b>（錢和貨的端到端主線）、<b>系統邊界</b>（我們 vs 外部系統）。</>
              : <>這個單元還沒有粗流。建議 1~3 張：<b>主流程</b>＋必要的<b>例外情境</b>；有多狀態單據的單元補一張<b>狀態機</b>。<br />粗流「定稿」後再開始長頁面；頁面級細流留到 wireframe 階段。</>}
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
                      onClick={() => save(all.map((x) => x.id === f.id ? { ...x, sealed: { v: x.versions.length, at: Date.now() } } : x))}>
                      <Stamp size={11} /> 定稿此版</button>}
                <div className="spacer" />
                <button className="uw-mini" title="改一版（保留舊版；已定稿改版後回到未定稿）" onClick={() => openEdit(f)}><Pencil size={13} /></button>
                <button className="uw-mini uf-del" title="刪除" onClick={() => remove(f)}><Trash2 size={13} /></button>
              </div>
              {vIdx !== f.versions.length - 1 && <div className="uf-oldnote">正在看 v{ver.v}（舊版）— 點最後一顆版本 chip 回到現行版</div>}
              <Mermaid code={ver.code} />
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
