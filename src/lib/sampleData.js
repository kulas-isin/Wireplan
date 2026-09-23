// 擬真模式用的示意資料產生器：依欄位標題推斷型別，輸出穩定（依列索引）且像真的內容。
import React from 'react'
import { Tag, Button, Space, Avatar, Progress, Rate, Switch } from 'antd'

const PEOPLE = ['王小明', '陳怡君', '林志豪', '張雅婷', '李俊宏', '黃淑芬', '吳建德', '劉美玲', '蔡承翰', '鄭家豪', '許文彥', '周品妧']
const STATUS = [['上架', 'green'], ['下架', 'default'], ['審核中', 'gold'], ['草稿', 'default'], ['已封存', 'red'], ['啟用', 'green'], ['停用', 'red']]
// 出貨／配送類欄位另一組：用「上架／草稿」當貨況看起來很假
const SHIP_STATUS = [['可出貨', 'green'], ['部分可出', 'gold'], ['不可出貨', 'red'], ['配送中', 'blue'], ['已出貨', 'green'], ['待處理', 'default']]

// 領域資料包：示意資料要像該產業的東西，客戶看了才有代入感
const POOLS = {
  ecommerce: {
    NAME: ['純棉寬版 T 恤', '高腰直筒牛仔褲', '法式碎花洋裝', '羊毛混紡大衣', '寬鬆針織上衣', '抽繩運動短褲', '真皮樂福鞋', '亞麻長袖襯衫', '百褶中長裙', '機能防風外套', '無鋼圈舒適內衣', '厚底帆布鞋'],
    CAT: ['上身', '下身', '洋裝', '外套', '套裝', '鞋子', '配件', '內衣'],
    GROUP: ['新品上市', '人氣熱銷', '折扣出清', '春夏新款', '經典必備', '限時特惠'],
    ID: 'SKU', PRICE: [390, 690, 890, 1280, 1580, 2180, 2980, 3680],
  },
  logistics: {
    NAME: ['宅配單 - 台北內湖', '超取單 - 全家忠孝店', '冷藏單 - 台中西屯', '跨境單 - 香港九龍', '宅配單 - 高雄前鎮', '超取單 - 新竹竹北'],
    CAT: ['宅配', '超商取貨', '冷藏', '冷凍', '跨境'],
    GROUP: ['今日配送', '待取號', '已出貨', '配送中', '異常件'],
    ID: 'TW', PRICE: [60, 80, 120, 150, 200, 280],
  },
  music: {
    NAME: ['夜空中最亮的星', '起風了', '晴天', '告白氣球', '光年之外', '小幸運', '說好的幸福呢', '體面', '可惜沒如果', '演員', '七里香', '稻香'],
    CAT: ['流行', '搖滾', '電子', '嘻哈', '古典', '爵士', '民謠', 'R&B'],
    GROUP: ['城市之光', '時光留聲', '初夏', '夜行者', '原點', '海的另一端'],
    ID: 'SNG', PRICE: [150, 290, 390, 490],
  },
  generic: {
    NAME: ['項目一', '項目二', '項目三', '項目四', '項目五', '項目六'],
    CAT: ['分類 A', '分類 B', '分類 C', '分類 D'],
    GROUP: ['群組一', '群組二', '群組三'],
    ID: 'ITM', PRICE: [100, 250, 500, 1000],
  },
}

// 依專案名稱與單元名稱推斷領域；專案可用 sampleDomain 明確指定
export function detectDomain(project) {
  const explicit = project?.sampleDomain
  if (explicit && POOLS[explicit]) return explicit
  const hay = [project?.name, ...(project?.units || [])].join(' ')
  if (/物流|快遞|託運|配送|貨運/.test(hay)) return 'logistics'
  if (/音樂|歌曲|專輯|創作者/.test(hay)) return 'music'
  if (/電商|商品|訂單|庫存|採購|零售|ERP|POS/i.test(hay)) return 'ecommerce'
  return 'generic'
}
const pool = (d) => POOLS[d] || POOLS.generic

const pick = (arr, i) => arr[i % arr.length]
const n2 = (x) => String(x).padStart(2, '0')

// 由欄位標題判斷角色
export function colRole(title = '') {
  const t = String(title).toLowerCase()
  if (/操作|action|管理|編輯/.test(t)) return 'actions'
  if (/^(刪除|移除)$/.test(t)) return 'rowdel'   // 明細表最後一欄常只有一顆刪除鈕
  if (/評分|星等|評價|rating|rate/.test(t)) return 'rate'
  if (/進度|完成度|達成度|progress/.test(t)) return 'progress'
  if (/啟用|開關|是否|顯示\/隱藏|上下架|switch|toggle|enabled/.test(t)) return 'switch'
  // 後台常見欄位：放在「名稱／編號」等通用規則之前，否則會被吃掉變成 SKU、項目 N
  if (/托運編號|物流編號|追蹤號/.test(t)) return 'tracking'
  if (/訂單編號|訂單號|採購單號|進貨單號|退貨單號|單號/.test(t)) return 'order'
  if (/貨況|貨態|配送狀態|配貨狀態|出貨狀態|到貨狀態/.test(t)) return 'shipstatus'
  if (/儲位/.test(t)) return 'slot'
  if (/倉庫|倉別/.test(t)) return 'warehouse'
  if (/物流|宅配|貨運/.test(t)) return 'carrier'
  if (/通路|來源|商店/.test(t)) return 'channel'
  if (/地址|門市/.test(t)) return 'address'
  if (/備註|原因/.test(t)) return 'note'
  if (/說明|描述|摘要/.test(t)) return 'brief'
  if (/角色|職務|權限群組/.test(t)) return 'role'
  if (/等級|級別|階級/.test(t)) return 'level'
  if (/最近一次|最後一次|最後登入|登入時間/.test(t)) return 'date'
  if (/收件人|寄件人|聯絡人|人員/.test(t)) return 'person'
  if (/貨號|料品編號|規格編號|商品編號/.test(t)) return 'id'
  if (/規格|尺寸|顏色|款式|版型/.test(t)) return 'spec'   // 「廠商規格」是規格不是廠商，要排在廠商前
  if (/廠商|供應商|檔口/.test(t)) return 'vendor'
  if (/幣別|貨幣|currency/.test(t)) return 'currency'
  if (/匯率/.test(t)) return 'exrate'
  if (/順位|項次|序位/.test(t)) return 'seq'
  if (/筆數|件數|量$/.test(t)) return 'count'
  if (/連結|網址|link|url|外連/.test(t)) return 'link'
  if (/狀態|status|state/.test(t)) return 'status'
  if (/頭像|avatar|頭貼|大頭/.test(t)) return 'avatar'
  if (/縮圖|封面|圖片|相片|主圖|商品圖|料品圖|thumb|cover|image/.test(t)) return 'thumb'
  if (/編號|id|代號|序號|no\.?$|單號/.test(t)) return 'id'
  if (/時長|長度|duration/.test(t)) return 'duration'
  if (/播放|次數|數量|觀看|count|views|銷量|庫存/.test(t)) return 'count'
  if (/金額|價格|費用|價錢|成本|毛利|售價|單價|price|amount|總額|營收|\$/.test(t)) return 'price'
  if (/百分|比率|占比|percent|%|達成/.test(t)) return 'percent'
  if (/日期|時間|建立|更新|到期|date|time/.test(t)) return 'date'
  if (/email|信箱|郵件/.test(t)) return 'email'
  if (/電話|手機|phone|聯絡/.test(t)) return 'phone'
  if (/分類|類型|類別|category|type|標籤/.test(t)) return 'category'
  if (/創作者|作者|會員|用戶|使用者|姓名|負責|建立者|user|member|owner/.test(t)) return 'person'
  if (/歌曲|歌名|名稱|標題|title|name|品項|商品/.test(t)) return 'name'
  if (/歌單|專輯|album|playlist|所屬/.test(t)) return 'album'
  return 'text'
}

// 回傳該儲存格內容（字串或 React 節點）
export function cellContent(role, i, domain = 'generic') {
  const P = pool(domain)
  switch (role) {
    case 'actions':
      return React.createElement(Space, { size: 2 },
        React.createElement(Button, { type: 'link', size: 'small', style: { padding: '0 4px' } }, '編輯'),
        React.createElement(Button, { type: 'link', size: 'small', danger: true, style: { padding: '0 4px' } }, '刪除'),
      )
    case 'status': {
      const [label, color] = pick(STATUS, i * 3 + (i % 2))
      return React.createElement(Tag, { color, style: { marginInlineEnd: 0 } }, label)
    }
    case 'rowdel':
      return React.createElement(Button, { type: 'link', size: 'small', danger: true, style: { padding: 0 } }, '刪除')
    case 'shipstatus': {
      const [label, color] = pick(SHIP_STATUS, i)
      return React.createElement(Tag, { color, style: { marginInlineEnd: 0 } }, label)
    }
    case 'avatar':
      return React.createElement(Avatar, { size: 'small', style: { background: '#dfe7f5', color: '#3a5a9b', fontSize: 11 } }, pick(PEOPLE, i).slice(0, 1))
    case 'rate':
      return React.createElement(Rate, { disabled: true, value: 3 + (i % 3), style: { fontSize: 13 } })
    case 'progress':
      return React.createElement(Progress, { percent: 35 + (i * 13) % 60, size: 'small', style: { margin: 0, minWidth: 90 } })
    case 'switch':
      return React.createElement(Switch, { size: 'small', defaultChecked: i % 2 === 0 })
    case 'thumb':
      return React.createElement('span', { className: 'wb-cellthumb' })
    case 'link':
      return React.createElement('a', { style: { color: '#2563eb' } }, '檢視詳情')
    case 'id':
      return `${P.ID}-${String(10231 + i * 7).padStart(5, '0')}`
    case 'order':
      return `SO-26${n2(1 + (i % 9))}-${String(1043 + i * 3).padStart(5, '0')}`
    case 'tracking':
      return `${pick(['SF', 'HCT', 'FAMI', 'TCAT'], i)}${100238471 + i * 977}`
    case 'carrier':
      return pick(['新竹物流', '順豐速運', '全家取貨', '黑貓宅急便'], i)
    case 'warehouse':
      return pick(['CCS 總倉', '網店倉', '快閃倉 A', '瑕疵倉'], i)
    case 'slot':
      return `${pick(['A', 'B', 'C'], i)}-${n2(1 + i % 12)}-${n2(1 + (i * 3) % 24)}`
    case 'vendor':
      return pick(['立益紡織', '宏采服飾', '晟品貿易', '東大門直送', '韓星國際'], i)
    case 'channel':
      return pick(['Shopline 官網', '快閃店 POS', 'Shopline 官網', '線下門市'], i)
    case 'address':
      return pick(['台北市內湖區瑞光路 513 號', '全家 忠孝敦化店', '台中市西屯區台灣大道三段', '7-11 竹北門市'], i)
    case 'note':
      return i % 3 === 0 ? '—' : pick(['客戶指定平日配送', '缺貨待補', '贈品另寄'], i)
    case 'brief':
      return pick(['供一般作業使用', '限特定人員使用', '—', '預設設定'], i)
    case 'role':
      return pick(['管理員', '倉管人員', '客服人員', '採購人員', '出貨人員'], i)
    case 'level':
      return pick(['一般會員', '銀卡會員', '金卡會員', 'VIP'], i)
    case 'spec':
      return `${pick(['S', 'M', 'L', 'XL', 'F'], i)}／${pick(['黑', '米白', '藕粉', '深藍', '卡其'], i)}`
    case 'seq':
      return String(i + 1)
    case 'currency':
      return pick(['TWD', 'KRW', 'USD', 'TWD'], i)
    case 'exrate':
      return (0.0234 + i * 0.0007).toFixed(4)
    case 'duration':
      return `${2 + (i % 4)}:${n2((i * 17 + 5) % 60)}`
    case 'count':
      return ((i * 37 + 13) % 480 + 6).toLocaleString()
    case 'price':
      return `$${pick(P.PRICE, i).toLocaleString()}`
    case 'percent':
      return `${50 + (i * 7) % 50}%`
    case 'date':
      return `2026-${n2(1 + (i % 9))}-${n2(1 + (i * 5) % 27)}`
    case 'email':
      return `user${100 + i}@demo.com`
    case 'phone':
      return `09${n2((i * 7) % 100)}-${String(100 + (i * 37) % 900)}-${String(100 + (i * 53) % 900)}`
    case 'category':
      return pick(P.CAT, i)
    case 'person':
      return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
        React.createElement(Avatar, { size: 20, style: { background: '#dfe7f5', color: '#3a5a9b', fontSize: 10, flexShrink: 0 } }, pick(PEOPLE, i).slice(0, 1)),
        pick(PEOPLE, i),
      )
    case 'album':
      return pick(P.GROUP, i)
    case 'name':
      return pick(P.NAME, i)
    default:
      return `項目 ${i + 1}`
  }
}

export const SAMPLE = { POOLS, PEOPLE, STATUS }
