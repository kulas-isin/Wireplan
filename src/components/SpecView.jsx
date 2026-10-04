import { useMemo, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { generateSpec } from '../lib/specGenerator.js'
import { renderMarkdown } from '../lib/markdown.js'
import { downloadText } from '../lib/download.js'
import { exportSpecXlsx } from '../lib/specXlsx.js'
import { RotateCw, Pencil, Download, FileSpreadsheet, ChevronDown, ChevronRight } from 'lucide-react'

export default function SpecView() {
  const { current, dispatch } = useStore()
  const [withSource, setWithSource] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [docOpen, setDocOpen] = useState(false)
  const pages = (current.wireframes || []).filter((w) => w.spec?.sections)

  const generated = useMemo(() => generateSpec(current), [current])
  const isOverride = current.specOverride != null
  const md = isOverride ? current.specOverride : generated
  const html = useMemo(() => renderMarkdown(md), [md])

  const doXlsx = async () => {
    setBusy(true); setMsg('')
    try { const r = await exportSpecXlsx(current, { withSource }); setMsg(`已產生 ${r.pages} 頁：${r.name}`) }
    catch (e) { setMsg('匯出失敗：' + (e?.message || e)) }
    setBusy(false)
  }

  return (
    <div>
      {/* 頁面規格 Excel：一頁一工作表，客戶簽範圍、工程師對欄位都用這一本；內容直接從各頁的規格清單長 */}
      <div className="panel sx-card">
        <div className="sx-head">
          <FileSpreadsheet size={18} />
          <strong>頁面規格 Excel</strong>
          <span className="ps-kind">{pages.length} 頁，一頁一工作表</span>
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          每張工作表由上往下：製作說明 → 跳轉規則 → 畫面元件清單（A. 操作／B. 預設／C. 規則／D. 狀態／E. 選項各一欄）→ 資料來源 → 邊界情境。
          內容來自各頁的規格清單（點條目填細節），這裡不另外編輯。
        </div>
        <div className="sx-bar">
          <label className="ps-chk"><input type="checkbox" checked={withSource} onChange={(e) => setWithSource(e.target.checked)} /> 含資料來源（ERP 來源、Shopline 欄位）</label>
          <div className="spacer" />
          <button className="primary" disabled={busy || !pages.length} onClick={doXlsx}><Download size={15} /> {busy ? '產生中…' : withSource ? '匯出 Excel' : '匯出 Excel（客戶版）'}</button>
        </div>
        {msg && <div className="muted" style={{ fontSize: 12 }}>{msg}</div>}
      </div>

      <button className="sx-toggle" onClick={() => setDocOpen(!docOpen)}>
        {docOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />} 系統規格文件（依需求卡自動產生的總覽 Markdown）
      </button>
      {docOpen && (<>
        <div className="toolbar">
          <strong>系統規格文件</strong>
          <span className="tag" style={{ background: isOverride ? '#f59e0b' : '#10b981' }}>
            {isOverride ? '手動編輯中' : '依需求自動產生'}
          </span>
          <div className="spacer" />
          {isOverride ? (
            <button onClick={() => { if (confirm('放棄手動編輯，改回依需求自動產生？')) dispatch({ type: 'SET_SPEC_OVERRIDE', value: null }) }}>
              <RotateCw size={14} /> 重新由需求產生
            </button>
          ) : (
            <button onClick={() => dispatch({ type: 'SET_SPEC_OVERRIDE', value: generated })}><Pencil size={14} /> 切換為手動編輯</button>
          )}
          <button className="primary" onClick={() => downloadText(`${current.name}-規格文件.md`, md, 'text/markdown')}><Download size={15} /> 匯出 Markdown</button>
        </div>

        <div className="doc-layout">
          <div className="doc-editor panel" style={{ padding: 12 }}>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              {isOverride ? 'Markdown 原始碼（可直接編輯）' : '自動產生的 Markdown（切換手動編輯後可修改）'}
            </div>
            <textarea
              value={md}
              readOnly={!isOverride}
              onChange={(e) => dispatch({ type: 'SET_SPEC_OVERRIDE', value: e.target.value })}
              style={{ opacity: isOverride ? 1 : 0.85 }}
            />
          </div>
          <div className="doc-preview panel">
            <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      </>)}
    </div>
  )
}
