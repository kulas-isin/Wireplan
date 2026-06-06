import { useMemo } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { generateSpec } from '../lib/specGenerator.js'
import { renderMarkdown } from '../lib/markdown.js'
import { downloadText } from '../lib/download.js'

export default function SpecView() {
  const { current, dispatch } = useStore()

  const generated = useMemo(() => generateSpec(current), [current])
  const isOverride = current.specOverride != null
  const md = isOverride ? current.specOverride : generated

  const html = useMemo(() => renderMarkdown(md), [md])

  return (
    <div>
      <div className="toolbar">
        <strong>系統規格文件</strong>
        <span className="tag" style={{ background: isOverride ? '#f59e0b' : '#10b981' }}>
          {isOverride ? '手動編輯中' : '依需求自動產生'}
        </span>
        <div className="spacer" />
        {isOverride ? (
          <button onClick={() => { if (confirm('放棄手動編輯，改回依需求自動產生？')) dispatch({ type: 'SET_SPEC_OVERRIDE', value: null }) }}>
            ↻ 重新由需求產生
          </button>
        ) : (
          <button onClick={() => dispatch({ type: 'SET_SPEC_OVERRIDE', value: generated })}>✎ 切換為手動編輯</button>
        )}
        <button className="primary" onClick={() => downloadText(`${current.name}-規格文件.md`, md, 'text/markdown')}>⬇ 匯出 Markdown</button>
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
    </div>
  )
}
