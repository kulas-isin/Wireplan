// 將單一 wireframe 元件以 Ant Design 高保真渲染（涵蓋 antd 主要元件集）。
import { COMPONENT_TYPES } from '../lib/wireframeTemplates.js'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, X, Image as ImageIcon, Check } from 'lucide-react'
import {
  Button, Input, Select, Table, Tabs, Steps, Breadcrumb, Menu, Card, Statistic,
  List, Pagination, Divider, Typography, Space, Switch, Avatar, Badge,
  Checkbox, Radio, DatePicker, InputNumber, Slider, Rate, Upload, Segmented,
  Tag, Descriptions, Timeline, Progress, Collapse, Tree, Calendar, Empty,
  Alert, Result, Skeleton,
} from 'antd'

const { RangePicker } = DatePicker
const WIDTH_CLASS = { full: 'w-full', half: 'w-half', third: 'w-third', quarter: 'w-quarter', fill: 'w-fill' }
const TAG_COLORS = ['green', 'blue', 'gold', 'red', 'purple', 'cyan']

// 取出陣列型屬性的 key（不同元件用不同欄位名）
export const ARRAY_PROP = {
  nav: 'items',
  sidenav: 'items',
  breadcrumb: 'items',
  buttonRow: 'buttons',
  table: 'columns',
  filter: 'fields',
  formgrid: 'fields',
  statcards: 'cards',
  steps: 'steps',
  tabs: 'tabs',
  list: 'items',
  cardlist: 'cards',
  checkbox: 'options',
  radio: 'options',
  segmented: 'options',
  descriptions: 'items',
  tags: 'tags',
  timeline: 'items',
  collapse: 'items',
  dropdown: 'items',
}

function arr(cmp, fallback = []) {
  const key = ARRAY_PROP[cmp.type]
  const v = key ? cmp[key] : null
  return v && v.length ? v : fallback
}

// 將元件的外觀樣式覆寫（cmp.style）轉成 CSS。圖層/樣式面板與渲染共用。
export function styleFromCmp(cmp) {
  const st = cmp.style || {}
  const s = {}
  if (st.mt != null && st.mt !== '') s.marginTop = Number(st.mt)
  if (st.mb != null && st.mb !== '') s.marginBottom = Number(st.mb)
  if (st.p != null && st.p !== '') s.padding = Number(st.p)
  if (st.fontSize) s.fontSize = Number(st.fontSize)
  if (st.fontWeight) s.fontWeight = st.fontWeight
  if (st.color) s.color = st.color
  if (st.bg) s.background = st.bg
  if (st.radius != null && st.radius !== '') s.borderRadius = Number(st.radius)
  if (st.borderW) s.border = `${Number(st.borderW)}px solid ${st.borderColor || '#d9d9d9'}`
  return s
}

function splitLabel(label, fallback) {
  const parts = String(label || '').split(/[,，/›>|]/).map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts : fallback
}

function Visual({ cmp }) {
  const align = cmp.align || 'left'
  const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
  const T = Typography

  switch (cmp.type) {
    // ── 版面 ──
    case 'header':
      return (
        <div className="wb-ad-header" style={{ textAlign: align }}>
          <T.Title level={5} style={{ margin: 0 }}>{cmp.label || '頁面標題'}</T.Title>
        </div>
      )
    case 'pageHeader': {
      const crumbs = splitLabel(cmp.sub, ['首頁', '管理']).map((t) => ({ title: t }))
      const showActions = cmp.showActions ?? true
      return (
        <div>
          <Breadcrumb items={crumbs} style={{ marginBottom: 6 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <T.Title level={4} style={{ margin: 0 }}>{cmp.label || '頁面標題'}</T.Title>
            {showActions && (
              <Space>
                <Button>{cmp.secondaryText || '次要'}</Button>
                <Button type="primary">{cmp.primaryText || '主要動作'}</Button>
              </Space>
            )}
          </div>
        </div>
      )
    }
    case 'topbar':
      return (
        <div className="wb-ad-appbar">
          <T.Title level={5} style={{ margin: 0 }}>{cmp.label || '系統名稱'}</T.Title>
          <Space size="middle">
            {(cmp.showSearch ?? true) && <Input.Search placeholder="搜尋…" style={{ width: 160 }} />}
            {(cmp.showNotify ?? true) && <Badge dot><Avatar size="small" style={{ background: '#e7eae8', color: '#69756e' }}>🔔</Avatar></Badge>}
            {(cmp.showAvatar ?? true) && <Avatar style={{ background: '#2e9e5b' }}>U</Avatar>}
          </Space>
        </div>
      )
    case 'divider':
      return <Divider style={{ margin: '6px 0' }}>{cmp.label || null}</Divider>
    case 'image':
      return (
        <div className="wb-ph" style={{ minHeight: cmp.height || 130 }}>
          <ImageIcon size={30} strokeWidth={1.6} />
          {cmp.label && cmp.label !== '圖片/Logo' ? <span className="wb-ph-cap">{cmp.label}</span> : null}
        </div>
      )

    // ── 導覽 ──
    case 'nav': {
      const items = arr(cmp, splitLabel(cmp.label, ['首頁', '功能一', '功能二', '功能三'])).map((t, i) => ({ key: String(i), label: t }))
      return <Menu mode="horizontal" selectedKeys={[String(cmp.active ?? 0)]} items={items} style={{ borderRadius: 8, lineHeight: '40px' }} />
    }
    case 'sidenav': {
      const items = arr(cmp, ['儀表板', '訂單管理', '商品管理', '會員', '報表', '設定']).map((t, i) => ({ key: String(i), label: t }))
      return <Menu mode="inline" selectedKeys={[String(cmp.active ?? 0)]} items={items} style={{ borderRadius: 8, maxWidth: 220 }} />
    }
    case 'breadcrumb': {
      const items = arr(cmp, splitLabel(cmp.label, ['首頁', '列表', '詳情'])).map((t) => ({ title: t }))
      return <Breadcrumb items={items} />
    }
    case 'tabs': {
      const items = arr(cmp, ['頁籤一', '頁籤二', '頁籤三']).map((t, i) => ({ key: String(i), label: t }))
      return <Tabs items={items} size="small" activeKey={String(cmp.active ?? 0)} />
    }
    case 'steps': {
      const steps = arr(cmp, ['填寫', '確認', '完成']).map((s) => ({ title: s }))
      return <Steps size="small" current={cmp.active ?? 0} items={steps} />
    }
    case 'pagination':
      return <div style={{ textAlign: 'center' }}><Pagination size="small" total={50} defaultCurrent={1} /></div>
    case 'dropdown':
      return <Button>{cmp.label || '更多操作'} ▾</Button>

    // ── 資料輸入 ──
    case 'field': {
      const ctrl = cmp.control || 'input'
      const st = cmp.status
      const ph = cmp.placeholder || cmp.label
      const ip = { variant: 'underlined', placeholder: ph, status: st === 'error' ? 'error' : undefined, disabled: st === 'disabled' }
      const control =
        ctrl === 'textarea' ? <Input.TextArea rows={2} {...ip} />
        : ctrl === 'select' ? <Select style={{ width: '100%' }} variant="underlined" placeholder={ph} status={st === 'error' ? 'error' : undefined} disabled={st === 'disabled'} options={[]} />
        : ctrl === 'password' ? <Input.Password {...ip} />
        : ctrl === 'toggle' ? <Switch defaultChecked disabled={st === 'disabled'} />
        : <Input {...ip} />
      return (
        <div style={{ textAlign: align }}>
          <T.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{cmp.label}{cmp.required && <span style={{ color: '#cf1322' }}> *</span>}</T.Text>
          {control}
          {cmp.help && <T.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>{cmp.help}</T.Text>}
          {st === 'error' && <T.Text style={{ fontSize: 11, color: '#cf1322' }}>此欄位有誤</T.Text>}
        </div>
      )
    }
    case 'formgrid': {
      const fields = arr(cmp, ['姓名', '電話', 'Email', '部門'])
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
          {fields.map((f, i) => (
            <div key={i}>
              <T.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{f}</T.Text>
              <Input variant="underlined" placeholder={f} />
            </div>
          ))}
        </div>
      )
    }
    case 'searchbar':
      return <Input.Search placeholder={cmp.label || '搜尋關鍵字…'} enterButton={cmp.enterButton ?? true} allowClear />
    case 'filter': {
      const fields = arr(cmp, ['狀態', '日期區間', '分類'])
      return <Space wrap>{fields.map((f, i) => <Select key={i} placeholder={f} style={{ minWidth: 130 }} options={[]} />)}</Space>
    }
    case 'checkbox': {
      const options = arr(cmp, ['選項一', '選項二', '選項三'])
      return (
        <div style={{ textAlign: align }}>
          {cmp.label && <T.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{cmp.label}</T.Text>}
          <Checkbox.Group options={options} defaultValue={[options[0]]} />
        </div>
      )
    }
    case 'radio': {
      const options = arr(cmp, ['選項一', '選項二', '選項三'])
      return (
        <div style={{ textAlign: align }}>
          {cmp.label && <T.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{cmp.label}</T.Text>}
          <Radio.Group options={options} value={options[cmp.active ?? 0]} />
        </div>
      )
    }
    case 'segmented': {
      const segs = arr(cmp, ['全部', '進行中', '已完成'])
      return <Segmented options={segs} value={segs[cmp.active ?? 0]} />
    }
    case 'datepicker':
      return (
        <div>
          {cmp.label && <T.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{cmp.label}</T.Text>}
          <DatePicker style={{ width: '100%' }} />
        </div>
      )
    case 'daterange':
      return (
        <div>
          {cmp.label && <T.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{cmp.label}</T.Text>}
          <RangePicker style={{ width: '100%' }} />
        </div>
      )
    case 'number':
      return (
        <div>
          {cmp.label && <T.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{cmp.label}</T.Text>}
          <InputNumber style={{ width: '100%' }} defaultValue={0} />
        </div>
      )
    case 'slider':
      return (
        <div>
          {cmp.label && <T.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>{cmp.label}</T.Text>}
          <Slider defaultValue={40} />
        </div>
      )
    case 'rate':
      return (
        <div style={{ textAlign: align }}>
          {cmp.label && <T.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{cmp.label}</T.Text>}
          <Rate defaultValue={3} />
        </div>
      )
    case 'upload':
      return <Upload><Button>{cmp.label || '上傳檔案'}</Button></Upload>
    case 'buttonRow': {
      const buttons = arr(cmp, ['主要動作', '次要'])
      return (
        <div style={{ display: 'flex', gap: 8, justifyContent: justify, flexWrap: 'wrap' }}>
          {buttons.map((b, i) => <Button key={i} type={i === 0 ? 'primary' : 'default'}>{b}</Button>)}
        </div>
      )
    }

    // ── 資料展示 ──
    case 'table': {
      const cols = arr(cmp, ['名稱', '狀態', '建立時間', '操作']).map((c, i) => ({ title: c, dataIndex: `c${i}`, key: i }))
      const rowN = Math.max(0, Math.min(12, cmp.rows ?? 3))
      const rows = Array.from({ length: rowN }, (_, r) => r).map((r) => {
        const row = { key: r }
        cols.forEach((c) => { row[c.dataIndex] = '—' })
        return row
      })
      return (
        <Table
          size={cmp.size || 'small'}
          pagination={cmp.pager ? { pageSize: rowN, total: 50, simple: true } : false}
          rowSelection={cmp.selectable ? {} : undefined}
          columns={cols}
          dataSource={rows}
        />
      )
    }
    case 'statcards': {
      const cards = arr(cmp, ['指標一', '指標二', '指標三', '指標四'])
      const nums = ['82%', '1,280', '100+', '$3.75']
      const trends = ['▲ 12%', '▲ 5%', '▼ 3%', '▲ 8%']
      return (
        <div className="wb-stats">
          {cards.map((c, i) => (
            <div className="wb-stat2" key={i}>
              <div className="n">{nums[i % nums.length]}</div>
              <div className="cap">{c}</div>
              {cmp.showTrend && <div className="cap" style={{ color: '#3f9b5b' }}>{trends[i % trends.length]}</div>}
            </div>
          ))}
        </div>
      )
    }
    case 'chart': {
      const ct = cmp.chartType || 'bar'
      return (
        <Card size="small" title={cmp.label || '圖表'}>
          {ct === 'pie' ? (
            <div className="wb-ad-pie" />
          ) : (
            <div className={'wb-ad-chart' + (ct === 'line' || ct === 'area' ? ' line' : '')}>
              {[45, 70, 55, 90, 60, 80, 50].map((h, i) => <div key={i} style={{ height: `${h}%` }} />)}
            </div>
          )}
        </Card>
      )
    }
    case 'cardlist': {
      const cards = arr(cmp, ['卡片一', '卡片二', '卡片三'])
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {cards.map((c, i) => (
            <Card size="small" key={i} style={{ flex: '1 1 140px' }}>
              <T.Text strong>{c}</T.Text>
              <div style={{ height: 28 }} />
            </Card>
          ))}
        </div>
      )
    }
    case 'list': {
      const items = arr(cmp, ['項目一', '項目二', '項目三'])
      return (
        <div className="wb-checklist">
          {items.map((it, i) => (
            <div className="wb-check" key={i}><Check size={15} strokeWidth={2.4} /> <span>{it}</span></div>
          ))}
        </div>
      )
    }
    case 'descriptions': {
      const items = arr(cmp, ['姓名:王小明', '狀態:啟用', '建立日:2026-01-01']).map((kv, i) => {
        const [k, ...v] = String(kv).split(':')
        return { key: i, label: k, children: v.join(':') || '—' }
      })
      return <Descriptions bordered size="small" column={1} items={items} title={cmp.label || null} />
    }
    case 'tags': {
      const tags = arr(cmp, ['啟用', '待審', '停用'])
      return <Space wrap>{tags.map((t, i) => <Tag key={i} color={TAG_COLORS[i % TAG_COLORS.length]}>{t}</Tag>)}</Space>
    }
    case 'avatar':
      return (
        <div style={{ display: 'flex', justifyContent: justify, alignItems: 'center', gap: 8 }}>
          <Avatar shape={cmp.shape || 'circle'} size={cmp.size || 'default'} style={{ background: '#2e9e5b' }}>U</Avatar>
          {cmp.label && <T.Text>{cmp.label}</T.Text>}
        </div>
      )
    case 'timeline': {
      const items = arr(cmp, ['建立訂單', '付款完成', '已出貨']).map((c) => ({ children: c }))
      return <Timeline items={items} />
    }
    case 'progress':
      return (
        <div>
          {cmp.label && <T.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>{cmp.label}</T.Text>}
          <Progress percent={Number(cmp.percent) || 60} status={cmp.status && cmp.status !== 'normal' ? cmp.status : undefined} />
        </div>
      )
    case 'collapse': {
      const items = arr(cmp, ['區段一', '區段二']).map((t, i) => ({ key: i, label: t, children: <T.Text type="secondary">內容…</T.Text> }))
      return <Collapse items={items} size="small" defaultActiveKey={[0]} />
    }
    case 'tree':
      return (
        <Tree
          defaultExpandAll
          treeData={[{ title: cmp.label || '根節點', key: '0', children: [{ title: '子項一', key: '0-0' }, { title: '子項二', key: '0-1', children: [{ title: '孫項', key: '0-1-0' }] }] }]}
        />
      )
    case 'calendar':
      return <div style={{ border: '1px solid #f0f0f0', borderRadius: 8 }}><Calendar fullscreen={false} /></div>
    case 'empty':
      return <Empty description={cmp.label || '尚無資料'} />

    // ── 回饋 ──
    case 'alert':
      return <Alert message={cmp.label || '提示訊息'} type={cmp.alertType || 'info'} showIcon={cmp.showIcon ?? true} />
    case 'modal':
      return (
        <div className="wb-ad-overlay">
          <div className="wb-ad-modal">
            <T.Title level={5} style={{ marginTop: 0 }}>{cmp.label || '對話框標題'}</T.Title>
            <T.Paragraph type="secondary" style={{ marginBottom: 16 }}>{cmp.sub || '對話框內容說明…'}</T.Paragraph>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button>取消</Button><Button type="primary">確定</Button>
            </div>
          </div>
        </div>
      )
    case 'drawer':
      return (
        <div className="wb-ad-overlay">
          <div className="wb-ad-drawer">
            <T.Title level={5} style={{ marginTop: 0 }}>{cmp.label || '抽屜標題'}</T.Title>
            <T.Paragraph type="secondary">{cmp.sub || '抽屜內容…'}</T.Paragraph>
            <Input placeholder="欄位" style={{ marginBottom: 8 }} />
            <Button type="primary" block>送出</Button>
          </div>
        </div>
      )
    case 'result':
      return <Result status="success" title={cmp.label || '操作成功'} subTitle={cmp.sub || '已完成此操作'} />
    case 'skeleton':
      return <Skeleton active />

    case 'text':
    default:
      return <T.Paragraph style={{ textAlign: align, margin: 0, color: '#5a6b62' }}>{cmp.label || COMPONENT_TYPES[cmp.type]?.label}</T.Paragraph>
  }
}

export default function WireframeBlock({ cmp, selected, onSelect, onDuplicate, onDelete, onDoubleClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cmp.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderRadius: 8,
    ...styleFromCmp(cmp),
  }
  // 非整列寬度時，用「對齊」決定欄位在列中的位置（靠右/置中）
  const notFull = (cmp.width || 'full') !== 'full'
  const al = cmp.align || 'left'
  if (notFull && al === 'right') style.marginLeft = 'auto'
  if (notFull && al === 'center') { style.marginLeft = 'auto'; style.marginRight = 'auto' }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`wf-item ${WIDTH_CLASS[cmp.width] || 'w-full'}${isDragging ? ' dragging' : ''}${selected ? ' selected' : ''}`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.() }}
      {...attributes}
      {...listeners}
    >
      <div className="wb-ad" style={{ pointerEvents: 'none' }}>
        <Visual cmp={cmp} />
      </div>
      {selected && <span className="wf-badge">{COMPONENT_TYPES[cmp.type]?.label || cmp.type}</span>}
      <div className="wb-tools" onPointerDown={(e) => e.stopPropagation()}>
        <button title="複製" onClick={(e) => { e.stopPropagation(); onDuplicate() }}><Copy size={13} /></button>
        <button title="刪除" onClick={(e) => { e.stopPropagation(); onDelete() }}><X size={14} /></button>
      </div>
    </div>
  )
}
