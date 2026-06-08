// 內建版型範本（layout presets）：一鍵插入常見後台版型，由現有元件 + 卡片容器組成。
// 每個 preset 是一棵「無 id」的節點樹，插入時由 cloneTree 配發新 id。

const detail = {
  type: 'row', label: '', width: 'full', direction: 'row', gap: 16, wrap: true, alignCross: 'stretch',
  children: [
    {
      type: 'card', label: '基本資料', width: 'fill', direction: 'column', gap: 12, actions: ['編輯'],
      children: [
        {
          type: 'descriptions', label: '', width: 'full',
          items: ['訂單編號:#SO-10241', '會員:王小明', '聯絡電話:0912-345-678', '收件地址:台北市信義區松高路 1 號', '金額:$1,280', '付款方式:信用卡', '訂單狀態:已付款', '建立時間:2026-06-01 10:02'],
        },
      ],
    },
    {
      type: 'card', label: '處理歷程', width: 'fixed', widthPx: 320, direction: 'column', gap: 12,
      children: [
        { type: 'timeline', label: '', width: 'full', items: ['2026-06-01 10:02 建立訂單', '10:15 付款完成', '11:30 倉庫出貨', '06-02 14:20 已送達'] },
      ],
    },
  ],
}

const listPage = {
  type: 'row', label: '', width: 'full', direction: 'column', gap: 14,
  children: [
    { type: 'pageHeader', label: '訂單管理', width: 'full', sub: '首頁,營運,訂單管理', showActions: true, actions: ['匯出 Excel', '＋ 新增訂單'] },
    { type: 'toolbar', label: '', width: 'full', showSearch: true, searchText: '搜尋訂單編號 / 會員…', filters: ['訂單狀態', '付款方式', '日期區間'], actions: ['批量出貨'] },
    { type: 'table', label: '', width: 'full', columns: ['訂單編號', '會員', '金額', '付款方式', '狀態', '建立時間', '操作'], rows: 7, selectable: true, pager: true, sortable: true, showActions: true, actions: ['查看', '出貨', '刪除'], actionStyle: 'link' },
  ],
}

const dashboard = {
  type: 'row', label: '', width: 'full', direction: 'column', gap: 14,
  children: [
    { type: 'statcards', label: '', width: 'full', cards: ['今日營收', '訂單數', '新會員', '轉換率'], showTrend: true },
    {
      type: 'row', label: '', width: 'full', direction: 'row', gap: 16, wrap: true, alignCross: 'stretch',
      children: [
        { type: 'chart', label: '營收趨勢', width: 'fill', chartType: 'line' },
        { type: 'chart', label: '分類占比', width: 'fixed', widthPx: 300, chartType: 'pie' },
      ],
    },
  ],
}

export const LAYOUT_PRESETS = [
  { key: 'detail', name: '詳情頁（左資料＋右歷程）', node: detail },
  { key: 'listPage', name: '列表頁（頁首＋工具列＋表格）', node: listPage },
  { key: 'dashboard', name: '儀表板（統計＋圖表）', node: dashboard },
]
