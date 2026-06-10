// 匯出單張 wireframe：PNG 圖片 / 自包含靜態 HTML。
import { toPng } from 'html-to-image'

function triggerDownload(href, filename) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

export async function exportPng(elementId, name = 'wireframe') {
  const node = document.getElementById(elementId)
  if (!node) throw new Error('找不到畫面節點')
  const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true })
  triggerDownload(dataUrl, `${name}.png`)
}

// 收集目前頁面所有 CSS（含 antd 動態注入），讓匯出的 HTML 離線也長一樣
function collectCss() {
  let css = ''
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) css += rule.cssText + '\n'
    } catch { /* 跨來源樣式表略過 */ }
  }
  return css
}

export function exportHtml(elementId, name = 'wireframe') {
  const node = document.getElementById(elementId)
  if (!node) throw new Error('找不到畫面節點')
  const css = collectCss()
  const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>${css}</style>
<style>body{margin:0;padding:24px;background:#eef1ef;font-family:'Plus Jakarta Sans','Noto Sans TC',sans-serif;}
.wf-frame{max-width:1100px;margin:0 auto;}
.wb-tools,.wf-rowhandle,.drag-handle,.wf-resize,.wf-badge,.add-cmp-bar{display:none!important;}</style>
</head>
<body>${node.outerHTML}</body>
</html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  triggerDownload(url, `${name}.html`)
  URL.revokeObjectURL(url)
}
