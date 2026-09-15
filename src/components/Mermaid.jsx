import { useEffect, useRef, useState } from 'react'

// 即時把 Mermaid 文字渲染成 SVG（mermaid 動態載入，不進主包）。
// 手勢：雙指捏合縮放 0.5x~3x（縮放採版面寬度而非 transform，放大後靠容器捲動平移）；
// 雙擊在 1x ↔ 1.8x 之間切換；縮放非 1x 時顯示百分比chip，點它歸位。
export default function Mermaid({ code }) {
  const [svg, setSvg] = useState('')
  const [err, setErr] = useState('')
  const [nat, setNat] = useState(0) // 圖的自然寬度：寬圖以原尺寸呈現＋橫向捲動，不再縮小到不能讀
  const [scale, setScale] = useState(1)
  const ptrs = useRef(new Map())
  const pinch = useRef(null)
  const lastTap = useRef(0)

  useEffect(() => {
    let alive = true
    setScale(1)
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
        if (alive) {
          const m = svg.match(/max-width:\s*([\d.]+)px/)
          setNat(m ? Math.ceil(parseFloat(m[1])) : 0)
          setSvg(svg); setErr('')
        }
      } catch (e) {
        if (alive) setErr(String(e?.message || e))
      }
    })()
    return () => { alive = false }
  }, [code])

  const clamp = (v) => Math.min(3, Math.max(0.5, v))
  const dist = () => {
    const [a, b] = [...ptrs.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }
  const onDown = (e) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (ptrs.current.size === 2) pinch.current = { d: dist(), s: scale }
    else if (ptrs.current.size === 1) {
      const t = Date.now()
      if (t - lastTap.current < 300) setScale((s) => (s === 1 ? 1.8 : 1)) // 雙擊切換
      lastTap.current = t
    }
  }
  const onMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) return
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && ptrs.current.size === 2) {
      e.preventDefault()
      setScale(clamp(pinch.current.s * dist() / pinch.current.d))
    }
  }
  const onUp = (e) => {
    ptrs.current.delete(e.pointerId)
    if (ptrs.current.size < 2) pinch.current = null
  }

  if (err) return <div className="mermaid-box muted">圖表渲染失敗：{err}</div>
  if (!svg) return <div className="mermaid-box muted">渲染中…</div>
  return (
    <div className="mermaid-box" style={{ position: 'relative', touchAction: 'pan-x pan-y' }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}>
      {scale !== 1 && (
        <button className="mmd-zoom" onClick={() => setScale(1)}>{Math.round(scale * 100)}% ✕</button>
      )}
      <div style={nat ? { width: Math.round(nat * scale), minWidth: Math.round(nat * scale) } : undefined}
        dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}
