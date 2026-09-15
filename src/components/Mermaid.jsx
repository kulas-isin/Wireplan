import { useEffect, useRef, useState } from 'react'

// 即時把 Mermaid 文字渲染成 SVG（mermaid 動態載入，不進主包）。
// 手勢（原生 touch 實作，雙指時 preventDefault 防瀏覽器搶手勢）：
// 雙指捏合 0.5x~3x（版面縮放，放大後單指捲動平移）；雙擊 1x↔1.8x；百分比 chip 點擊歸位。
export default function Mermaid({ code }) {
  const [svg, setSvg] = useState('')
  const [err, setErr] = useState('')
  const [nat, setNat] = useState(0)
  const [scale, setScale] = useState(1)
  const boxRef = useRef(null)
  const scaleRef = useRef(1)
  scaleRef.current = scale

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

  // 原生 touch 手勢：React 的 touch 監聽是 passive，preventDefault 無效，
  // 瀏覽器會把雙指判成捲動/系統縮放並 cancel 掉 — 這裡用非 passive 監聽自己接手。
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    let pinch = null
    let lastTap = 0
    const clamp = (v) => Math.min(3, Math.max(0.5, v))
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const ts = (e) => {
      if (e.touches.length === 2) {
        pinch = { d: dist(e.touches), s: scaleRef.current }
        e.preventDefault() // 從第一刻就接管，不給瀏覽器搶
      } else if (e.touches.length === 1) {
        const t = Date.now()
        if (t - lastTap < 300) setScale((s) => (s === 1 ? 1.8 : 1))
        lastTap = t
      }
    }
    const tm = (e) => {
      if (e.touches.length === 2) {
        if (!pinch) pinch = { d: dist(e.touches), s: scaleRef.current } // 第二指較晚落下也接得住
        e.preventDefault()
        setScale(clamp(pinch.s * dist(e.touches) / pinch.d))
      }
    }
    const te = (e) => { if (e.touches.length < 2) pinch = null }
    el.addEventListener('touchstart', ts, { passive: false })
    el.addEventListener('touchmove', tm, { passive: false })
    el.addEventListener('touchend', te)
    el.addEventListener('touchcancel', te)
    return () => {
      el.removeEventListener('touchstart', ts)
      el.removeEventListener('touchmove', tm)
      el.removeEventListener('touchend', te)
      el.removeEventListener('touchcancel', te)
    }
  }, [svg])

  if (err) return <div className="mermaid-box muted">圖表渲染失敗：{err}</div>
  if (!svg) return <div className="mermaid-box muted">渲染中…</div>
  return (
    <div ref={boxRef} className="mermaid-box" style={{ position: 'relative' }}>
      {scale !== 1 && (
        <button className="mmd-zoom" onClick={() => setScale(1)}>{Math.round(scale * 100)}% ✕</button>
      )}
      <div style={nat ? { width: Math.round(nat * scale), minWidth: Math.round(nat * scale) } : undefined}
        dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}
