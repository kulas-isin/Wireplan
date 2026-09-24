// 把已定案的 wireframe 打包成一份交給 AI 做精緻版 HTML 的提示詞。
// 匯出 HTML 是「畫面快照」（DOM + 全部 CSS），AI 讀不動也改不動；
// 這裡產的是結構化的說明：規格 + 版面由上到下 + 全站規範，貼進對話就能開工。
import { COMPONENT_TYPES } from './wireframeTemplates.js'
import { SECTION_KINDS } from './specKinds.js'

const clean = (s) => String(s ?? '').trim()
const list = (a) => (a || []).map(clean).filter(Boolean).join('、')

// 表單欄位字串（「售價*:select」）→ 人看得懂的描述
const FIELD_TYPE = {
  select: '下拉', date: '日期', upload: '上傳', switch: '開關',
  number: '數字', textarea: '多行', radio: '單選', checkbox: '多選',
}
function fieldDesc(f) {
  const [rawName, type] = String(f).split(':')
  const required = rawName.endsWith('*')
  const name = required ? rawName.slice(0, -1) : rawName
  const tags = [required && '必填', FIELD_TYPE[type] || (type ? type : null)].filter(Boolean)
  return tags.length ? `${name}（${tags.join('、')}）` : name
}

// 單一元件 → 一行描述。回 null 代表不值得寫進提示詞。
function lineOf(c) {
  const L = clean(c.label)
  switch (c.type) {
    case 'header':
      return `標題：${L || '（未命名）'}`
    case 'sidenav': {
      const items = c.items || []
      const now = items[c.active ?? 0]
      return `側欄選單：${list(items)}${now ? `（目前停在「${now}」）` : ''}`
    }
    case 'topbar': {
      const bits = [c.showSearch && '全站搜尋', c.showNotify && '通知鈴', c.showAvatar && '使用者頭像'].filter(Boolean)
      return `頂列：${L || '（無標題）'}${bits.length ? `，右側有 ${list(bits)}` : ''}`
    }
    case 'pageHeader': {
      const crumb = clean(c.sub) ? `麵包屑「${String(c.sub).split(',').map(clean).join(' / ')}」，` : ''
      const acts = c.showActions && (c.actions || []).length ? `右上主要按鈕：${list(c.actions)}` : '右上無按鈕'
      return `頁首：${crumb}標題「${L}」，${acts}`
    }
    case 'tabs':
      return `分頁籤：${list(c.tabs)}（預設停在第 ${(c.active ?? 0) + 1} 個）`
    case 'steps':
      return `步驟列：${list(c.steps)}`
    case 'statcards':
      return `統計卡 ${(c.cards || []).length} 張：${list(c.cards)}${c.showTrend ? '，各卡附與前期比較的增減' : ''}`
    case 'toolbar': {
      const bits = []
      if (c.showSearch) bits.push(`搜尋框（提示字「${clean(c.searchText) || '關鍵字'}」）`)
      if ((c.filters || []).length) bits.push(`下拉篩選：${list(c.filters)}`)
      if ((c.actions || []).length) bits.push(`按鈕：${list(c.actions)}`)
      return `工具列 ── ${bits.join('｜') || '（空）'}`
    }
    case 'searchbar':
      return `搜尋／掃描輸入框${L ? `：${L}` : ''}`
    case 'tags':
      return `已篩選標籤列：${list(c.tags)}`
    case 'table': {
      const cols = c.columns || []
      const opt = [
        c.selectable && '每列可勾選',
        c.sortable && '欄位可排序',
        c.fixedCols && '首欄與操作欄固定不隨橫捲',
      ].filter(Boolean)
      const act = (c.actions || []).length ? `；每列操作：${list(c.actions)}` : ''
      return `表格（${cols.length} 欄${opt.length ? '，' + list(opt) : ''}）：${list(cols)}${act}`
    }
    case 'pagination':
      return `分頁列：共 ${c.total ?? 128} 筆、每頁 ${c.pageSize ?? 20} 筆${c.pageSizer ? '，可切換每頁筆數' : ''}`
    case 'formgrid':
      return `表單（${c.cols || 2} 欄排列）：${(c.fields || []).map(fieldDesc).join('、')}`
    case 'descriptions':
      return `鍵值清單：${(c.items || []).map((kv) => {
        const [k, ...v] = String(kv).split(':')
        return `${clean(k)}＝${clean(v.join(':')) || '—'}`
      }).join('、')}`
    case 'buttonRow':
      return `按鈕列：${list(c.buttons)}`
    case 'alert':
      return `提示橫幅（${c.alertType || 'info'}）：${L}`
    case 'text':
      return L ? `說明文字：${L}` : null
    case 'divider':
      return '分隔線'
    case 'empty':
      return `空狀態：${L || '（無資料）'}`
    case 'card':
      return `卡片「${L || '未命名'}」，內含：`
    default: {
      const t = COMPONENT_TYPES[c.type]?.label || c.type
      return L ? `${t}：${L}` : t
    }
  }
}

function outline(components, depth = 0, out = []) {
  for (const c of components || []) {
    const line = lineOf(c)
    if (line) out.push(`${'  '.repeat(depth)}- ${line}`)
    if ((c.children || []).length) outline(c.children, depth + (line ? 1 : 0), out)
  }
  return out
}

// 規格清單 → Markdown 小節
function specBlock(spec) {
  const secs = spec?.sections || []
  if (!secs.length) return ''
  const lines = []
  for (const s of secs) {
    const items = (s.items || []).map((i) => clean(i.label)).filter(Boolean)
    if (!items.length) continue
    const cap = clean(s.title) || SECTION_KINDS[s.kind] || s.kind
    lines.push(items.length === 1 ? `- **${cap}**：${items[0]}` : `- **${cap}**\n${items.map((t) => `  - ${t}`).join('\n')}`)
  }
  return lines.join('\n')
}

// 專案裡若有「列表頁共用機制」那張頁，把它的規則當全站規範帶進去
function sharedRules(project) {
  const hit = (project?.wireframes || []).find(
    (w) => /共用機制|共用規範|共用元件/.test(String(w.name || '')) || w.code === 'P2-99',
  )
  if (!hit) return ''
  const body = specBlock(hit.spec)
  if (!body) return ''
  return `## 全站共用規範（所有列表頁一致，不要各頁自己發明）\n\n來源：${hit.code ? hit.code + ' ' : ''}${hit.name}\n\n${body}\n`
}

// 主題帶品牌說明時，把「主色只有一個、中性色跟客戶品牌同一系」講死，AI 才不會又做成冷灰藍後台
const brandBlock = (primary, t, brand) => `
## 品牌與配色（這組不能自己換）

- ${brand.note}
- **主色只有綠 ${primary}**：主要按鈕、選中狀態、連結、側欄選中項；淡綠 ${brand.tint} 只用在選中底與狀態標籤底
- **中性色全部用暖灰褐，不用冷灰**：頁面底 ${t.bg}、側欄底 ${t.side}、邊框 ${t.line}、表頭 ${t.thead}、次要文字 ${t.muted}、主文字 ${t.text}
- 品牌灰褐 ${brand.neutral} 只放在側欄頂端的 logo 區與次要按鈕的邊框，不要整條頂列或側欄塗成深灰褐
- 頁面底可以有極淡的漸層（左上 ${t.bg} → 右下 ${brand.tint}），卡片仍是純白、圓角 ${t.radius}px、陰影極輕，留白比一般後台多一點
- 成功／異常／待處理的狀態色照常用綠／紅／黃淡底深字；其餘看起來是「彩色」的東西都不該出現
`

const DOMAIN_HINT = (project) => {
  const hay = [project?.name, ...(project?.units || [])].join(' ')
  if (/服飾|電商|零售|商品|訂單/.test(hay)) return '服飾電商後台（商品名、SKU、倉庫、廠商、金額、收件資訊）'
  if (/物流|快遞|託運|配送/.test(hay)) return '物流後台（託運單號、配送狀態、門市、路線）'
  if (/音樂|歌曲|專輯/.test(hay)) return '音樂平台後台（曲名、專輯、播放數）'
  return `「${clean(project?.name) || '這個系統'}」的後台`
}

function pageBlock(wf, project) {
  const head = `## ${wf.code ? wf.code + '　' : ''}${wf.name}${wf.unit ? `（${wf.unit}）` : ''}`
  const spec = specBlock(wf.spec)
  const body = outline(wf.components).join('\n')
  const parts = [head]
  if (spec) parts.push(`### 規格\n\n${spec}`)
  if (body) parts.push(`### 版面（由上到下，請照這個順序）\n\n${body}`)
  if (!spec && !body) parts.push('（這頁還沒有內容）')
  return parts.join('\n\n')
}

/**
 * @param {object[]} wireframes 要交接的頁（1 張或整個單元）
 * @param {object}   project    目前專案（取名稱、單元、共用機制頁）
 * @param {string|object} palette wireframe 主色字串，或 WF_PALETTES 的整個主題（含 tones／brand 時會連中性色與品牌說明一起交代）
 */
export function buildHandoff(wireframes, project, palette = '#2563eb') {
  const pages = (wireframes || []).filter(Boolean)
  const many = pages.length > 1
  const shared = sharedRules(project)
  const pal = typeof palette === 'string' ? { primary: palette } : (palette || {})
  const primary = pal.primary || '#2563eb'
  const t = {
    bg: '#f4f5f7', side: '#f8fafc', line: '#e2e5ec', line2: '#eef1f4', thead: '#f7f9fb',
    text: '#1f2733', heading: '#101828', muted: '#667085', radius: 6, ...(pal.tones || {}),
  }
  const brand = pal.brand
  // 有頁面設成平板／手機，或規格裡提到 iPad，才要求做觸控版
  const touch = pages.some(
    (w) => w.device === 'tablet' || w.device === 'mobile'
      || /iPad|平板|手機|觸控/i.test(JSON.stringify(w.spec || {})),
  )
  const touchNote = touch ? '。有頁面要在平板上用（規格有寫的照規格），那幾頁的點擊目標至少 44px' : ''

  const preamble = `你是前端工程師。下面是已經跟客戶確認過的後台畫面規格，請做成${many ? `${pages.length} 支` : '一支'}自包含的 HTML 檔（單檔可直接用瀏覽器開，CSS 寫在 <style> 裡）。

## 技術與風格

- 純 HTML + CSS；分頁籤切換、篩選面板展開收合這類互動可用少量原生 JS，不要引入框架
- 後台版型：左側選單（固定寬 220px）＋ 頂列 ＋ 內容區
- 主色 ${primary}；頁面底色 ${t.bg}；側欄底 ${t.side}；卡片白底、圓角 ${t.radius}px、邊框 ${t.line}、陰影極輕
- 表格：表頭底 ${t.thead}、文字 ${t.muted}、列高 40px、分隔線 ${t.line2}、內文 13px
- 字型 'Noto Sans TC', system-ui；標題 ${t.heading}、內文 ${t.text}、次要文字 ${t.muted}
- 狀態用色票標籤（綠＝正常、黃＝待處理、紅＝異常、藍＝進行中）
- **表格與表單請填入像真的${DOMAIN_HINT(project)}資料**，不要用 Lorem ipsum 或「項目 1、項目 2」
${brand ? brandBlock(primary, t, brand) : ''}
## 質感要求（客戶現用的系統做得很好看，這份不能輸）

做得「正確但平庸」不算過關。以下是把後台做好看的具體規則，不是建議：

- **間距用 8px 網格**：卡片內距 20–24px、區塊間距 24px、欄位間距 16px；不要 13px、19px 這種數字
- **字級只用三檔**：頁面標題 20px／內文與表格 13–14px／輔助文字 12px。層級靠字重與顏色深淺，不靠一直換字級
- **數字對齊**：金額、數量、日期欄位靠右、用等寬數字（\`font-variant-numeric: tabular-nums\`），千分位逗號
- **一個強調色**：主色只用在主要按鈕、選中狀態、連結；其餘全部中性灰。狀態標籤用淡底深字，不用飽和色塊
- **卡片不要硬框線**：用 1px 極淡的線（黑 6% 透明）或極輕陰影擇一；卡片裡的表格不再加外框，避免框中框
- **表格**：表頭固定、不要斑馬紋、hover 換底；首欄字重 500；操作欄用圖示＋hover 顯示文字，不要一排文字按鈕
- **圖示只用一套**：Lucide，16 或 18px，線寬 1.75；不混用 emoji 或別套圖示
- **每個畫面只有一顆主要按鈕**（實心主色），其餘用線框或文字鈕；危險操作只在確認框裡是紅的
- **頁首固定結構**：麵包屑（小、灰）→ 標題（20px、700）→ 右側主要按鈕，同一條水平線
- **空狀態要設計**：置中、一個圖示、一句話、一顆按鈕；不是一行灰字
- **不要**：卡片與表格裡用漸層${brand ? '（頁面底的極淡漸層除外）' : ''}、多種強調色、預設瀏覽器控件樣式、每格都有邊框的表格、置中的整頁表單
- 若這段提示詞附有**客戶現有系統或參考畫面的截圖**，以截圖的密度、留白與質感為準，優先於上面的數值
- 畫面寬 1440px 為主；1280px 以下側欄收成只有圖示的 64px 窄欄，1024px 以下不必處理${touchNote}

## 互動與狀態（規格沒寫到的照這裡做，不要留白）

- **hover**：表格列換底 ${t.thead}；可點的儲存格文字（單號、品名）平常是主色、hover 加底線；按鈕與側欄項都要有 hover 底色
- **focus**：輸入框與下拉 focus 時邊框轉主色 ＋ 2px 淡主色外圈；整頁用鍵盤 Tab 走得完
- **disabled**：沒勾選任何一列時，批次動作是不可點的灰階，且 hover 要顯示原因（例：「請先勾選訂單」）
- **loading**：表格載入中用骨架列（灰色長條佔滿各欄，約 6 列），不要整頁轉圈；按鈕送出中顯示 spinner 並鎖住，避免重複送出
- **空狀態**：文案照規格「空狀態與錯誤」寫的，一字不改；規格沒寫的才自己補。版面置中、一句說明，接得到動作的附一顆按鈕
- **錯誤**：欄位級錯誤在該欄位下方紅字；整頁級錯誤用列表上方的紅色橫幅；文案同樣照規格
- **切換動效**：分頁籤切換、篩選面板展開收合用 150ms ease，不要更慢，也不要沒有
- 可點的東西要看得出來可點：游標 pointer，不能只靠顏色差異

> 這些狀態請在同一支 HTML 裡做得出來：把 loading／空狀態／錯誤各做一份隱藏的
> 區塊，開頭放幾顆切換鈕（正常／載入中／空／錯誤）讓我點著看，別只寫在註解裡。

## 規則

- 版面順序、欄位名稱、按鈕文字請照規格走，不要自行增刪
- 規格裡寫「（展開時）」的區塊，預設收合，點按鈕才展開
- 規格裡的「驗收條件」是給你理解用的，不用畫在畫面上
${many ? '- 每頁各自一支 HTML，共用的側欄與頂列做成一樣的\n' : ''}`

  return [preamble, shared, pages.map((w) => pageBlock(w, project)).join('\n\n---\n\n')]
    .filter(Boolean).join('\n')
}
