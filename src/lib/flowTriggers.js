// 從 wireframe 抽取「可觸發元件」（按鈕 / 連結 / 選單 / 頁籤 / 表格操作…），
// 給流程圖列出「這頁可以觸發哪些流程」，再讓使用者逐一指定去向。
export function extractTriggers(wf) {
  const out = []
  const push = (label, kind) => { if (label) out.push({ label: String(label), kind }) }
  const walk = (cs) => {
    for (const c of cs || []) {
      if (!c || typeof c !== 'object') continue
      switch (c.type) {
        case 'buttonRow': (c.buttons || []).forEach((b) => push(b, '按鈕')); break
        case 'link': push(c.label, '連結'); break
        case 'nav': case 'sidenav': case 'breadcrumb': (c.items || []).forEach((i) => push(i, '選單')); break
        case 'tabs': (c.tabs || []).forEach((t) => push(t, '頁籤')); break
        case 'segmented': (c.options || []).forEach((o) => push(o, '切換')); break
        case 'dropdown': (c.items || []).forEach((i) => push(i, '下拉')); break
        case 'pageHeader':
          push(c.primaryText, '主鈕'); push(c.secondaryText, '次鈕'); (c.actions || []).forEach((a) => push(a, '操作')); break
        case 'toolbar': (c.actions || []).forEach((a) => push(a, '操作')); break
        case 'table': if (Array.isArray(c.actions)) c.actions.forEach((a) => push(a, '列操作')); break
        case 'searchbar': if (c.enterButton) push(c.label || '搜尋', '搜尋'); break
        case 'pagination': push('分頁', '分頁'); break
        default: break
      }
      if (Array.isArray(c.children)) walk(c.children)
    }
  }
  walk(wf.components)
  const seen = new Set()
  return out.filter((t) => { const k = t.label + '|' + t.kind; if (seen.has(k)) return false; seen.add(k); return true })
}
