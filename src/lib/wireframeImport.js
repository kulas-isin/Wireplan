import { uid } from './id.js'
import { COMPONENT_TYPES } from './wireframeTemplates.js'

// 匯入用的 wireframe JSON schema（PoC）
// ─────────────────────────────────────────────
// 一張畫面 = {
//   name:   string                       畫面名稱
//   device: 'desktop'|'tablet'|'mobile'  預設 desktop
//   theme:  'music'                      深色音樂主題（深底+金色），省略=預設淺色
//   layout: 'sidebar'|'stack'            sidebar = 左側欄+內容兩欄
//   components: Component[]              元件樹
// }
// Component = {
//   type:   string   ← 必須是元件庫既有 type（見 COMPONENT_TYPES）
//   label:  string   標題/主要文字
//   width:  'fill'|'hug'|'fixed'|'full'|'half'|'third'|'quarter'
//   widthPx:number   width='fixed' 時的像素
//   align:  'left'|'center'|'right'
//   region: 'sidebar'|'content'   （只有最外層、且 layout=sidebar 時有意義）
//   children: Component[]         （type='row' 列容器才有）
//   // 列容器排版：direction/wrap/gap/gapCross/padX/padY/alignMain/alignCross/clip
//   // 陣列型資料依 type 用對應 key：items/columns/buttons/fields/cards/tags/options/steps/tabs…
//   // 其餘屬性（rows/selectable/pager/chartType/percent…）直接帶上即可
//   // 表格操作欄：columns 內含「操作」欄、或設 showActions:true，搭配 actions:[...] 與 actionStyle:'link'|'button'|'icon'
//   // 表格進階：sortable / fixedCols / hoverActions / selectable / pager（皆 boolean）
//   // formgrid：cols:1~4；欄名後綴 * = 必填、:select/:date/:number/:textarea = 指定型別
//   // pageHeader：actions:[...] 右上角操作鈕（末顆或含「＋/新增」自動主要鈕）
//   // toolbar：showSearch / searchText / filters:[...] / actions:[...]（搜尋+篩選+操作一整列）
//   // card：卡片容器（type:'card'）→ label=標題、actions:[...]=右上操作、direction、gap、children:[...]（放統計/列表/表格…）
//   // 表格儲存格樣式由欄名決定：進度/評分/啟用/縮圖/連結/狀態/創作者… 自動對應進度條/星等/開關/縮圖/連結/標籤/頭像
// }
// 可傳單一物件、陣列、或 { wireframes:[...] }。

const KNOWN = new Set(Object.keys(COMPONENT_TYPES))

function normNode(node) {
  if (!node || typeof node !== 'object' || !node.type) return null
  const out = { ...node, id: uid('cmp') }
  if (!KNOWN.has(node.type)) {
    // 未知 type → 降級為文字佔位，保留原意不讓匯入失敗
    out.type = 'text'
    out.label = node.label ? `${node.label}（未支援：${node.type}）` : `未支援元件：${node.type}`
  }
  if (Array.isArray(node.children)) out.children = node.children.map(normNode).filter(Boolean)
  return out
}

export function normalizeWireframe(spec) {
  const w = spec || {}
  return {
    id: uid('wf'),
    requirementId: null,
    name: w.name || '匯入畫面',
    device: w.device || 'desktop',
    template: w.template || 'imported',
    theme: w.theme === 'music' ? 'music' : undefined,
    layout: w.layout === 'sidebar' ? 'sidebar' : undefined,
    components: Array.isArray(w.components) ? w.components.map(normNode).filter(Boolean) : [],
  }
}

export function normalizeWireframes(json) {
  const list = Array.isArray(json) ? json : (Array.isArray(json?.wireframes) ? json.wireframes : [json])
  return list.map(normalizeWireframe)
}

// PoC 範例：由上傳的「時大音樂 後台 / 歌曲管理」HTML 手刻成 JSON，
// 用來示範 AI 只要產生這種 JSON，就能用現有元件庫還原畫面。
export const SAMPLE_WIREFRAME = {
  name: '歌曲管理（匯入範例）',
  device: 'desktop',
  layout: 'sidebar',
  components: [
    { type: 'header', label: '時大音樂', region: 'sidebar' },
    {
      type: 'sidenav', region: 'sidebar', active: 1,
      items: ['1.1 儀表板', '2.1 歌曲管理', '2.2 創作者管理', '2.3 歌單／專輯', '2.4 MV 管理', '3.1 首頁管理', '4.1 會員管理', '5.1 常見問題', '6.2 權限管理'],
    },
    { type: 'topbar', label: '時大音樂 後台', region: 'content', showSearch: true, showNotify: true, showAvatar: true },
    {
      type: 'pageHeader', label: '歌曲管理', region: 'content',
      sub: '首頁,內容管理,歌曲管理', showActions: true,
      primaryText: '＋ 新增歌曲', secondaryText: '匯出 Excel',
    },
    {
      type: 'row', region: 'content', direction: 'row', wrap: true, gap: 8,
      alignMain: 'start', alignCross: 'center',
      children: [
        { type: 'searchbar', label: '搜尋歌曲 / 創作者…', width: 'fill', enterButton: true },
        { type: 'filter', width: 'hug', fields: ['狀態', '所屬歌單', '創作者'] },
      ],
    },
    { type: 'buttonRow', region: 'content', buttons: ['批量上架', '批量下架', '刪除'] },
    {
      type: 'table', region: 'content', size: 'small', selectable: true, pager: true, rows: 8,
      columns: ['歌曲', '歌曲編號', '創作者', '所屬歌單', '時長', '播放數', '狀態', '操作'],
      // 操作欄：命名為「操作」的欄會渲染這些按鈕；actionStyle = link | button | icon
      actions: ['編輯', '下架', '刪除'], actionStyle: 'link',
    },
  ],
}
