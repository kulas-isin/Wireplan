// 頁面規格的段落型別標籤。放在 lib 是因為規格清單、會議記錄、AI 交接
// 三處都要用；擺在元件檔會讓 lib 反過來相依 React。
export const SECTION_KINDS = {
  searchbar: '搜尋列', filter: '快速篩選', toolbar: '工具列', table: '表格欄',
  form: '表單欄位', desc: '詳情欄位', tabs: '頁籤', stats: '統計卡',
  actions: '動作鈕', pagination: '分頁', note: '備註',
}
