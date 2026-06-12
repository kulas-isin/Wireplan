// 業務流程模式庫：可重用的標準流程（含判斷點與失敗回圈）。
// page 節點的 page 欄位是「要綁定的頁面關鍵詞」，會比對既有 wireframe；找不到 → 待補紅框。
import { uid } from './id.js'
import { autoLayout } from './flowGraph.js'

export const ROLE_COLORS = {
  訪客: '#0891b2', 會員: '#2563eb', 管理員: '#9333ea', 系統: '#64748b',
}

// 每個模式：role + nodes(key/type/label/page) + edges([from, to, label?])
export const FLOW_PATTERNS = [
  {
    id: 'login', name: '登入', role: '訪客',
    nodes: [
      { key: 's', type: 'start', label: '開始' },
      { key: 'login', type: 'page', page: '登入' },
      { key: 'chk', type: 'decision', label: '帳號密碼正確？' },
      { key: 'home', type: 'page', page: '首頁' },
      { key: 'e', type: 'end', label: '完成' },
    ],
    edges: [['s', 'login'], ['login', 'chk'], ['chk', 'home', '是'], ['chk', 'login', '否'], ['home', 'e']],
  },
  {
    id: 'register', name: '註冊', role: '訪客',
    nodes: [
      { key: 's', type: 'start', label: '開始' },
      { key: 'reg', type: 'page', page: '註冊' },
      { key: 'chk', type: 'decision', label: '驗證碼正確？' },
      { key: 'home', type: 'page', page: '首頁' },
      { key: 'e', type: 'end', label: '完成' },
    ],
    edges: [['s', 'reg'], ['reg', 'chk'], ['chk', 'home', '是'], ['chk', 'reg', '否'], ['home', 'e']],
  },
  {
    id: 'forgot', name: '忘記密碼', role: '訪客',
    nodes: [
      { key: 's', type: 'start', label: '開始' },
      { key: 'fp', type: 'page', page: '忘記密碼' },
      { key: 'chk', type: 'decision', label: '帳號存在？' },
      { key: 'reset', type: 'page', page: '重設密碼' },
      { key: 'login', type: 'page', page: '登入' },
      { key: 'e', type: 'end', label: '完成' },
    ],
    edges: [['s', 'fp'], ['fp', 'chk'], ['chk', 'reset', '是'], ['chk', 'fp', '否'], ['reset', 'login'], ['login', 'e']],
  },
  {
    id: 'purchase', name: '購買 / 訂閱', role: '會員',
    nodes: [
      { key: 's', type: 'start', label: '開始' },
      { key: 'plan', type: 'page', page: '購買方案' },
      { key: 'pay', type: 'decision', label: '付款成功？' },
      { key: 'ok', type: 'page', page: '付款結果' },
      { key: 'e', type: 'end', label: '完成' },
    ],
    edges: [['s', 'plan'], ['plan', 'pay'], ['pay', 'ok', '是'], ['pay', 'plan', '否'], ['ok', 'e']],
  },
  {
    id: 'crud', name: '資料增刪改查', role: '管理員',
    nodes: [
      { key: 's', type: 'start', label: '開始' },
      { key: 'list', type: 'page', page: '列表' },
      { key: 'form', type: 'page', page: '表單' },
      { key: 'chk', type: 'decision', label: '欄位驗證通過？' },
      { key: 'e', type: 'end', label: '完成' },
    ],
    edges: [['s', 'list'], ['list', 'form'], ['form', 'chk'], ['chk', 'list', '是'], ['chk', 'form', '否'], ['list', 'e']],
  },
  {
    id: 'approval', name: '審核 / 簽核', role: '管理員',
    nodes: [
      { key: 's', type: 'start', label: '開始' },
      { key: 'fill', type: 'page', page: '申請' },
      { key: 'l1', type: 'decision', label: '主管核准？' },
      { key: 'l2', type: 'decision', label: '財務核准？' },
      { key: 'done', type: 'page', page: '完成' },
      { key: 'e', type: 'end', label: '結束' },
    ],
    edges: [['s', 'fill'], ['fill', 'l1'], ['l1', 'l2', '是'], ['l1', 'fill', '退回'], ['l2', 'done', '是'], ['l2', 'fill', '退回'], ['done', 'e']],
  },
  {
    id: 'search', name: '搜尋瀏覽', role: '會員',
    nodes: [
      { key: 's', type: 'start', label: '開始' },
      { key: 'search', type: 'page', page: '搜尋' },
      { key: 'chk', type: 'decision', label: '有結果？' },
      { key: 'detail', type: 'page', page: '詳情' },
      { key: 'e', type: 'end', label: '完成' },
    ],
    edges: [['s', 'search'], ['search', 'chk'], ['chk', 'detail', '是'], ['chk', 'search', '否'], ['detail', 'e']],
  },
  {
    id: 'play', name: '播放 / 收藏', role: '會員',
    nodes: [
      { key: 's', type: 'start', label: '開始' },
      { key: 'pick', type: 'page', page: '歌單' },
      { key: 'chk', type: 'decision', label: '是會員？' },
      { key: 'player', type: 'page', page: '播放器' },
      { key: 'trial', type: 'page', page: '試聽' },
      { key: 'e', type: 'end', label: '完成' },
    ],
    edges: [['s', 'pick'], ['pick', 'chk'], ['chk', 'player', '是'], ['chk', 'trial', '否'], ['player', 'e'], ['trial', 'e']],
  },
]

const coreName = (l) => String(l || '')
  .replace(/^[wWＷ]?\s*[.\d]+[a-zA-Z]?\s*/, '').replace(/[（(【[].*?[）)】\]]/g, '').replace(/\s+/g, '').trim()

// 模式 → 圖（綁定既有頁面、套角色色、自動排版）
export function buildPatternFlow(pattern, wireframes) {
  const wfs = wireframes || []
  const find = (kw) => {
    const k = coreName(kw)
    return wfs.find((w) => { const c = coreName(w.name); return c && (c.includes(k) || k.includes(c)) })
  }
  const idOf = new Map()
  const nodes = pattern.nodes.map((n) => {
    const id = uid('node'); idOf.set(n.key, id)
    let label = n.label, page
    if (n.type === 'page') {
      const wf = find(n.page)
      label = wf ? wf.name : n.page
      page = wf ? wf.name : n.page
    }
    return {
      id, type: n.type, label, page, role: pattern.role, flow: pattern.name,
      color: n.type === 'page' ? ROLE_COLORS[pattern.role] : undefined,
    }
  })
  const edges = pattern.edges.map(([s, t, label]) => ({ id: uid('e'), source: idOf.get(s), target: idOf.get(t), label }))
  return { nodes: autoLayout(nodes, edges), edges }
}

// 把 JSON 的 flows（多條業務流程，格式同 pattern：nodes/edges/role）組成一張圖，
// 每條流程往右排開，綁定既有頁面、套角色色。給「匯入 JSON」用。
export function buildFlowsGraph(flows, wireframes) {
  const nodes = []
  const edges = []
  ;(flows || []).forEach((f, i) => {
    if (!f || !Array.isArray(f.nodes)) return
    const g = buildPatternFlow(f, wireframes)
    const offX = i * 520
    nodes.push(...g.nodes.map((n) => ({ ...n, x: (n.x || 0) + offX, y: n.y || 0 })))
    edges.push(...g.edges)
  })
  return { nodes, edges }
}
