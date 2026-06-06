import { useEffect, useState } from 'react'

// 即時把 Mermaid 文字渲染成 SVG（mermaid 動態載入，不進主包）
export default function Mermaid({ code }) {
  const [svg, setSvg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'loose',
          theme: 'base',
          themeVariables: {
            primaryColor: '#e7f6ec',
            primaryBorderColor: '#2e9e5b',
            primaryTextColor: '#14271c',
            lineColor: '#6b8475',
            fontFamily: 'inherit',
          },
        })
        const id = 'mmd-' + Math.random().toString(36).slice(2)
        const { svg } = await mermaid.render(id, code)
        if (alive) { setSvg(svg); setErr('') }
      } catch (e) {
        if (alive) setErr(String(e?.message || e))
      }
    })()
    return () => { alive = false }
  }, [code])

  if (err) return <div className="mermaid-box muted">圖表渲染失敗：{err}</div>
  if (!svg) return <div className="mermaid-box muted">渲染中…</div>
  return <div className="mermaid-box" dangerouslySetInnerHTML={{ __html: svg }} />
}
