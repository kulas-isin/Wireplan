// 極簡 Markdown → HTML 渲染（足夠預覽規格 / 流程文件，無外部相依）。
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inline(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
}

export function renderMarkdown(md = '') {
  const lines = md.split(/\r?\n/)
  let html = ''
  let i = 0
  let inList = null // 'ul' | 'ol'
  let tableBuf = []

  const flushList = () => {
    if (inList) { html += `</${inList}>`; inList = null }
  }
  const flushTable = () => {
    if (!tableBuf.length) return
    const rows = tableBuf
    tableBuf = []
    const parseRow = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
    const header = parseRow(rows[0])
    const bodyRows = rows.slice(2) // 跳過分隔列
    html += '<table><thead><tr>'
    header.forEach((h) => (html += `<th>${inline(h)}</th>`))
    html += '</tr></thead><tbody>'
    bodyRows.forEach((r) => {
      html += '<tr>'
      parseRow(r).forEach((c) => (html += `<td>${inline(c)}</td>`))
      html += '</tr>'
    })
    html += '</tbody></table>'
  }

  while (i < lines.length) {
    const line = lines[i]

    // 程式碼區塊
    if (line.trim().startsWith('```')) {
      flushList(); flushTable()
      const lang = line.trim().slice(3)
      const buf = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) { buf.push(lines[i]); i++ }
      html += `<pre><code class="lang-${escapeHtml(lang)}">${escapeHtml(buf.join('\n'))}</code></pre>`
      i++
      continue
    }

    // 表格
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushList()
      tableBuf.push(line.trim())
      i++
      continue
    } else if (tableBuf.length) {
      flushTable()
    }

    // 標題
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) {
      flushList()
      const lvl = h[1].length
      html += `<h${lvl}>${inline(h[2])}</h${lvl}>`
      i++
      continue
    }

    // 引用
    if (/^>\s?/.test(line)) {
      flushList()
      html += `<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`
      i++
      continue
    }

    // 分隔線
    if (/^---+$/.test(line.trim())) {
      flushList()
      html += '<hr/>'
      i++
      continue
    }

    // 清單（含核取方塊）
    const ul = line.match(/^\s*[-*]\s+(.*)$/)
    const ol = line.match(/^\s*\d+\.\s+(.*)$/)
    if (ul || ol) {
      const want = ol ? 'ol' : 'ul'
      if (inList && inList !== want) flushList()
      if (!inList) { html += `<${want}>`; inList = want }
      let txt = (ul ? ul[1] : ol[1])
      txt = txt.replace(/^\[ \]\s/, '☐ ').replace(/^\[x\]\s/i, '☑ ')
      html += `<li>${inline(txt)}</li>`
      i++
      continue
    } else {
      flushList()
    }

    // 空行
    if (line.trim() === '') { i++; continue }

    // 段落
    html += `<p>${inline(line)}</p>`
    i++
  }
  flushList(); flushTable()
  return html
}
