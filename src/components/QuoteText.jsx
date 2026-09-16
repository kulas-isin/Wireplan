// 報價原文排版器：資料照存逐字原文，顯示時拆解結構
// 規則：【…】→ 小節標題章；• → 條列；（1）（2）→ 子條列；「功能說明：」等前綴加粗
const LEAD = /^(功能說明|功能流程|使用情境舉例|甲方需提供)：([\s\S]*)$/

const emph = (s) => {
  const m = s.match(LEAD)
  return m ? <><b>{m[1]}：</b>{m[2]}</> : s
}

export default function QuoteText({ text }) {
  const [introRaw, ...bullets] = String(text || '').split(/\s*•\s*/)
  // 前言依【小節】切段（split 保留標題與其後文字成對）
  const intro = introRaw.split(/(?=【[^】]+】)|(?=功能說明：)|(?=功能流程：)/).map((p) => {
    const m = p.match(/^【([^】]+)】([\s\S]*)$/)
    return m ? { h: m[1], body: m[2].trim() } : { h: null, body: p.trim() }
  }).filter((s) => s.h || s.body)

  return (
    <div className="qt">
      {intro.map((s, i) => (
        <div key={i}>
          {s.h && <div className="qt-h">{s.h}</div>}
          {s.body && <p className="qt-p">{emph(s.body)}</p>}
        </div>
      ))}
      {bullets.length > 0 && (
        <ul className="qt-ul">
          {bullets.map((b, i) => {
            const parts = b.split(/(?=（\d+）)/).map((x) => x.trim()).filter(Boolean)
            return (
              <li key={i} className="qt-li">
                {emph(parts[0])}
                {parts.length > 1 && (
                  <ul className="qt-sub">{parts.slice(1).map((x, j) => <li key={j}>{x}</li>)}</ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
