// 擬真模式用的示意資料產生器：依欄位標題推斷型別，輸出穩定（依列索引）且像真的內容。
import React from 'react'
import { Tag, Button, Space, Avatar, Progress, Rate, Switch } from 'antd'

const SONGS = ['夜空中最亮的星', '起風了', '晴天', '告白氣球', '光年之外', '小幸運', '說好的幸福呢', '體面', '可惜沒如果', '演員', '七里香', '稻香']
const PEOPLE = ['王小明', '陳怡君', '林志豪', '張雅婷', '李俊宏', '黃淑芬', '吳建德', '劉美玲', '蔡承翰', '鄭家豪', '許文彥', '周品妧']
const ALBUMS = ['城市之光', '時光留聲', '初夏', '夜行者', '原點', '海的另一端', '無限循環', '日常詩']
const CATS = ['流行', '搖滾', '電子', '嘻哈', '古典', '爵士', '民謠', 'R&B']
const STATUS = [['上架', 'green'], ['下架', 'default'], ['審核中', 'gold'], ['草稿', 'default'], ['已封存', 'red'], ['啟用', 'green'], ['停用', 'red']]

const pick = (arr, i) => arr[i % arr.length]
const n2 = (x) => String(x).padStart(2, '0')

// 由欄位標題判斷角色
export function colRole(title = '') {
  const t = String(title).toLowerCase()
  if (/操作|action|管理|編輯/.test(t)) return 'actions'
  if (/評分|星等|評價|rating|rate/.test(t)) return 'rate'
  if (/進度|完成度|達成度|progress/.test(t)) return 'progress'
  if (/啟用|開關|是否|顯示\/隱藏|上下架|switch|toggle|enabled/.test(t)) return 'switch'
  if (/連結|網址|link|url|外連/.test(t)) return 'link'
  if (/狀態|status|state/.test(t)) return 'status'
  if (/頭像|avatar|頭貼|大頭/.test(t)) return 'avatar'
  if (/縮圖|封面|圖片|相片|商品圖|thumb|cover|image/.test(t)) return 'thumb'
  if (/編號|id|代號|序號|no\.?$|單號/.test(t)) return 'id'
  if (/時長|長度|duration/.test(t)) return 'duration'
  if (/播放|次數|數量|觀看|count|views|銷量|庫存/.test(t)) return 'count'
  if (/金額|價格|費用|價錢|price|amount|總額|營收|\$/.test(t)) return 'price'
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
export function cellContent(role, i) {
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
      return `SNG-${String(10231 + i * 7).padStart(5, '0')}`
    case 'duration':
      return `${2 + (i % 4)}:${n2((i * 17 + 5) % 60)}`
    case 'count':
      return (1280 * (i + 3) + i * 137).toLocaleString()
    case 'price':
      return `$${(1280 * (i + 1)).toLocaleString()}`
    case 'percent':
      return `${50 + (i * 7) % 50}%`
    case 'date':
      return `2026-${n2(1 + (i % 9))}-${n2(1 + (i * 5) % 27)}`
    case 'email':
      return `user${100 + i}@demo.com`
    case 'phone':
      return `09${n2((i * 7) % 100)}-${String(100 + (i * 37) % 900)}-${String(100 + (i * 53) % 900)}`
    case 'category':
      return pick(CATS, i)
    case 'person':
      return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
        React.createElement(Avatar, { size: 20, style: { background: '#dfe7f5', color: '#3a5a9b', fontSize: 10, flexShrink: 0 } }, pick(PEOPLE, i).slice(0, 1)),
        pick(PEOPLE, i),
      )
    case 'album':
      return pick(ALBUMS, i)
    case 'name':
      return pick(SONGS, i)
    default:
      return `項目 ${i + 1}`
  }
}

export const SAMPLE = { SONGS, PEOPLE, ALBUMS, CATS, STATUS }
