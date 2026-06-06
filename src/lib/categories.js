// 需求分類定義與關鍵字偵測。
// 分類會決定要套用哪一種 wireframe 範本，以及流程文件的步驟產生方式。

export const CATEGORIES = {
  auth: {
    key: 'auth',
    label: '登入／帳號',
    color: '#6366f1',
    keywords: ['登入', '登出', '註冊', '帳號', '密碼', '驗證', '權限', 'sso', 'login', 'signin', 'sign in', 'register', 'auth', 'password', 'oauth'],
  },
  list: {
    key: 'list',
    label: '列表／查詢',
    color: '#0ea5e9',
    keywords: ['列表', '清單', '查詢', '搜尋', '管理', '一覽', 'list', 'search', 'query', 'table', 'grid', 'index', 'management'],
  },
  form: {
    key: 'form',
    label: '表單／新增編輯',
    color: '#10b981',
    keywords: ['表單', '新增', '編輯', '建立', '填寫', '申請', '送出', '維護', 'form', 'create', 'edit', 'add', 'submit', 'apply', 'input'],
  },
  detail: {
    key: 'detail',
    label: '詳情／檢視',
    color: '#14b8a6',
    keywords: ['詳情', '明細', '檢視', '查看', '內容', 'detail', 'view', 'profile', 'info'],
  },
  dashboard: {
    key: 'dashboard',
    label: '儀表板',
    color: '#f59e0b',
    keywords: ['儀表板', '首頁', '總覽', '概覽', '看板', 'dashboard', 'home', 'overview', 'summary', 'kpi'],
  },
  report: {
    key: 'report',
    label: '報表／統計',
    color: '#ef4444',
    keywords: ['報表', '統計', '分析', '圖表', '匯出', 'report', 'chart', 'statistic', 'analytics', 'export'],
  },
  workflow: {
    key: 'workflow',
    label: '流程／審核',
    color: '#a855f7',
    keywords: ['流程', '審核', '審批', '簽核', '步驟', '精靈', '關卡', 'workflow', 'approval', 'wizard', 'step', 'process', 'review'],
  },
  payment: {
    key: 'payment',
    label: '金流／結帳',
    color: '#ec4899',
    keywords: ['付款', '結帳', '金流', '訂單', '購物車', '發票', 'payment', 'checkout', 'cart', 'order', 'invoice', 'pay'],
  },
  setting: {
    key: 'setting',
    label: '設定',
    color: '#64748b',
    keywords: ['設定', '配置', '參數', '偏好', 'setting', 'config', 'preference', 'option'],
  },
  generic: {
    key: 'generic',
    label: '一般頁面',
    color: '#94a3b8',
    keywords: [],
  },
}

export const CATEGORY_LIST = Object.values(CATEGORIES)

// 依名稱與描述自動判斷分類。回傳分類 key。
export function detectCategory(text = '') {
  const lower = String(text).toLowerCase()
  let best = { key: 'generic', score: 0 }
  for (const cat of CATEGORY_LIST) {
    let score = 0
    for (const kw of cat.keywords) {
      if (lower.includes(kw.toLowerCase())) score += kw.length >= 3 ? 2 : 1
    }
    if (score > best.score) best = { key: cat.key, score }
  }
  return best.key
}

export function categoryMeta(key) {
  return CATEGORIES[key] || CATEGORIES.generic
}
