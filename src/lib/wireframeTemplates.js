// Wireframe 範本引擎：依需求分類產生「元件清單」。
// 每個 wireframe 是可編輯的元件陣列，UI 端負責渲染與增刪改排序。
import { uid } from './id.js'

// 支援的元件型別（renderer 需對應實作）。group 供元件庫面板分組。
export const COMPONENT_TYPES = {
  header: { label: '頁首/標題列', group: '版面' },
  nav: { label: '導覽列', group: '版面' },
  breadcrumb: { label: '麵包屑', group: '版面' },
  tabs: { label: '頁籤', group: '版面' },
  divider: { label: '分隔線', group: '版面' },
  searchbar: { label: '搜尋列', group: '表單' },
  filter: { label: '篩選器', group: '表單' },
  field: { label: '輸入欄位', group: '表單' },
  buttonRow: { label: '按鈕列', group: '表單' },
  table: { label: '資料表格', group: '資料' },
  pagination: { label: '分頁', group: '資料' },
  statcards: { label: '統計卡片', group: '資料' },
  chart: { label: '圖表', group: '資料' },
  cardlist: { label: '卡片清單', group: '資料' },
  list: { label: '項目清單', group: '資料' },
  steps: { label: '步驟列', group: '其他' },
  text: { label: '文字段落', group: '其他' },
  image: { label: '圖片/Logo', group: '其他' },
}

// 依 group 整理出元件庫面板用的分組清單
export const COMPONENT_GROUPS = ['版面', '表單', '資料', '其他'].map((g) => ({
  group: g,
  types: Object.entries(COMPONENT_TYPES).filter(([, v]) => v.group === g).map(([k]) => k),
}))

function c(type, label, extra = {}) {
  return { id: uid('cmp'), type, label, width: 'full', ...extra }
}

// 各分類的範本產生器。傳入 requirement，回傳元件陣列。
const TEMPLATES = {
  auth: (r) => [
    c('image', 'Logo'),
    c('header', r.name || '會員登入'),
    c('field', '帳號 / Email', { control: 'input' }),
    c('field', '密碼', { control: 'password' }),
    c('buttonRow', '', { buttons: ['登入', '忘記密碼'] }),
    c('text', '還沒有帳號？前往註冊'),
  ],
  list: (r) => [
    c('header', r.name || '資料列表'),
    c('nav', '主選單'),
    c('searchbar', '搜尋關鍵字'),
    c('filter', '狀態 / 日期 / 分類', { fields: ['狀態', '日期區間', '分類'] }),
    c('buttonRow', '', { buttons: ['新增', '匯出', '批次操作'] }),
    c('table', '資料表格', { columns: ['名稱', '狀態', '建立時間', '操作'] }),
    c('pagination', '第 1 / N 頁'),
  ],
  form: (r) => [
    c('header', r.name || '資料表單'),
    c('breadcrumb', '列表 › 新增/編輯'),
    c('field', '欄位一', { control: 'input' }),
    c('field', '欄位二', { control: 'input' }),
    c('field', '說明', { control: 'textarea' }),
    c('field', '分類', { control: 'select' }),
    c('buttonRow', '', { buttons: ['儲存', '取消'] }),
  ],
  detail: (r) => [
    c('header', r.name || '詳細資料'),
    c('breadcrumb', '列表 › 詳情'),
    c('tabs', '', { tabs: ['基本資料', '相關紀錄', '附件'] }),
    c('list', '欄位資料', { items: ['欄位 A：值', '欄位 B：值', '欄位 C：值'] }),
    c('buttonRow', '', { buttons: ['編輯', '刪除', '返回'] }),
  ],
  dashboard: (r) => [
    c('header', r.name || '儀表板'),
    c('nav', '主選單'),
    c('statcards', '', { cards: ['指標一', '指標二', '指標三', '指標四'] }),
    c('chart', '趨勢圖'),
    c('table', '最新資料', { columns: ['項目', '數值', '變化'] }),
  ],
  report: (r) => [
    c('header', r.name || '報表'),
    c('filter', '查詢條件', { fields: ['日期區間', '維度', '分類'] }),
    c('buttonRow', '', { buttons: ['查詢', '匯出 Excel', '列印'] }),
    c('chart', '統計圖表'),
    c('table', '明細資料', { columns: ['項目', '數量', '金額', '占比'] }),
  ],
  workflow: (r) => [
    c('header', r.name || '流程作業'),
    c('steps', '', { steps: ['填寫', '確認', '送審', '完成'] }),
    c('field', '申請內容', { control: 'textarea' }),
    c('list', '審核紀錄', { items: ['關卡一：待處理'] }),
    c('buttonRow', '', { buttons: ['上一步', '下一步', '送出'] }),
  ],
  payment: (r) => [
    c('header', r.name || '結帳'),
    c('list', '訂單明細', { items: ['商品 A × 1', '商品 B × 2', '運費'] }),
    c('field', '收件資訊', { control: 'input' }),
    c('field', '付款方式', { control: 'select' }),
    c('text', '金額合計：NT$ ___'),
    c('buttonRow', '', { buttons: ['確認付款', '返回購物車'] }),
  ],
  setting: (r) => [
    c('header', r.name || '設定'),
    c('tabs', '', { tabs: ['一般', '通知', '安全'] }),
    c('field', '設定項目一', { control: 'input' }),
    c('field', '啟用功能', { control: 'toggle' }),
    c('buttonRow', '', { buttons: ['儲存設定'] }),
  ],
  generic: (r) => [
    c('header', r.name || '頁面標題'),
    c('nav', '主選單'),
    c('text', r.description || '內容區塊'),
    c('buttonRow', '', { buttons: ['主要動作'] }),
  ],
}

// 為單一需求產生 wireframe 物件
export function generateWireframe(requirement) {
  const gen = TEMPLATES[requirement.category] || TEMPLATES.generic
  return {
    id: uid('wf'),
    requirementId: requirement.id,
    name: requirement.screen || requirement.name || '未命名畫面',
    device: 'desktop', // desktop | mobile
    template: requirement.category,
    components: gen(requirement),
  }
}

// 重新依需求分類產生元件（保留 wireframe id 與名稱）
export function regenerateComponents(requirement) {
  const gen = TEMPLATES[requirement.category] || TEMPLATES.generic
  return gen(requirement)
}

// 新增一個空白元件
export function newComponent(type = 'text') {
  return c(type, COMPONENT_TYPES[type]?.label || '元件')
}
