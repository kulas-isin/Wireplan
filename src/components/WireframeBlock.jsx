// 將單一 wireframe 元件以 Ant Design 高保真渲染。
import { COMPONENT_TYPES } from '../lib/wireframeTemplates.js'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Copy, X } from 'lucide-react'
import {
  Button, Input, Select, Table, Tabs, Steps, Breadcrumb, Menu, Card, Statistic,
  List, Pagination, Divider, Typography, Space, Switch, Avatar, Badge,
} from 'antd'

const WIDTH_CLASS = { full: 'w-full', half: 'w-half', third: 'w-third', quarter: 'w-quarter' }

// 取出陣列型屬性的 key（不同元件用不同欄位名）
export const ARRAY_PROP = {
  nav: 'items',
  breadcrumb: 'items',
  buttonRow: 'buttons',
  table: 'columns',
  filter: 'fields',
  statcards: 'cards',
  steps: 'steps',
  tabs: 'tabs',
  list: 'items',
  cardlist: 'cards',
}

function arr(cmp, fallback = []) {
  const key = ARRAY_PROP[cmp.type]
  const v = key ? cmp[key] : null
  return v && v.length ? v : fallback
}

function splitLabel(label, fallback) {
  const parts = String(label || '').split(/[,，/›>|]/).map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts : fallback
}

function Visual({ cmp }) {
  const align = cmp.align || 'left'
  const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'

  switch (cmp.type) {
    case 'header':
      return (
        <div className="wb-ad-header" style={{ textAlign: align }}>
          <Typography.Title level={5} style={{ margin: 0 }}>{cmp.label || '頁面標題'}</Typography.Title>
        </div>
      )
    case 'nav': {
      const items = arr(cmp, splitLabel(cmp.label, ['首頁', '功能一', '功能二', '功能三'])).map((t, i) => ({ key: String(i), label: t }))
      return <Menu mode="horizontal" selectedKeys={['0']} items={items} style={{ borderRadius: 8, lineHeight: '40px' }} />
    }
    case 'breadcrumb': {
      const items = arr(cmp, splitLabel(cmp.label, ['首頁', '列表', '詳情'])).map((t) => ({ title: t }))
      return <Breadcrumb items={items} />
    }
    case 'searchbar':
      return <Input.Search placeholder={cmp.label || '搜尋關鍵字…'} enterButton allowClear />
    case 'filter': {
      const fields = arr(cmp, ['狀態', '日期區間', '分類'])
      return (
        <Space wrap>
          {fields.map((f, i) => <Select key={i} placeholder={f} style={{ minWidth: 130 }} options={[]} />)}
        </Space>
      )
    }
    case 'field': {
      const ctrl = cmp.control || 'input'
      const control =
        ctrl === 'textarea' ? <Input.TextArea rows={2} placeholder={cmp.label} />
        : ctrl === 'select' ? <Select style={{ width: '100%' }} placeholder={cmp.label} options={[]} />
        : ctrl === 'password' ? <Input.Password placeholder={cmp.label} />
        : ctrl === 'toggle' ? <Switch defaultChecked />
        : <Input placeholder={cmp.label} />
      return (
        <div style={{ textAlign: align }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{cmp.label}</Typography.Text>
          {control}
        </div>
      )
    }
    case 'buttonRow': {
      const buttons = arr(cmp, ['主要動作', '次要'])
      return (
        <div style={{ display: 'flex', gap: 8, justifyContent: justify, flexWrap: 'wrap' }}>
          {buttons.map((b, i) => <Button key={i} type={i === 0 ? 'primary' : 'default'}>{b}</Button>)}
        </div>
      )
    }
    case 'table': {
      const cols = arr(cmp, ['名稱', '狀態', '建立時間', '操作']).map((c, i) => ({ title: c, dataIndex: `c${i}`, key: i }))
      const rows = [0, 1, 2].map((r) => {
        const row = { key: r }
        cols.forEach((c) => { row[c.dataIndex] = '—' })
        return row
      })
      return <Table size="small" pagination={false} columns={cols} dataSource={rows} />
    }
    case 'pagination':
      return <div style={{ textAlign: 'center' }}><Pagination size="small" total={50} defaultCurrent={1} /></div>
    case 'statcards': {
      const cards = arr(cmp, ['指標一', '指標二', '指標三', '指標四'])
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {cards.map((c, i) => (
            <Card size="small" key={i} style={{ flex: '1 1 120px' }}>
              <Statistic title={c} value={[1280, 53, 92, 4.6][i % 4]} />
            </Card>
          ))}
        </div>
      )
    }
    case 'chart':
      return (
        <Card size="small" title={cmp.label || '圖表'}>
          <div className="wb-ad-chart">
            {[45, 70, 55, 90, 60, 80, 50].map((h, i) => <div key={i} style={{ height: `${h}%` }} />)}
          </div>
        </Card>
      )
    case 'cardlist': {
      const cards = arr(cmp, ['卡片一', '卡片二', '卡片三'])
      return (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {cards.map((c, i) => (
            <Card size="small" key={i} style={{ flex: '1 1 140px' }}>
              <Typography.Text strong>{c}</Typography.Text>
              <div style={{ height: 28 }} />
            </Card>
          ))}
        </div>
      )
    }
    case 'steps': {
      const steps = arr(cmp, ['填寫', '確認', '完成']).map((s) => ({ title: s }))
      return <Steps size="small" current={0} items={steps} />
    }
    case 'tabs': {
      const items = arr(cmp, ['頁籤一', '頁籤二', '頁籤三']).map((t, i) => ({ key: String(i), label: t }))
      return <Tabs items={items} size="small" />
    }
    case 'list': {
      const items = arr(cmp, ['項目一', '項目二', '項目三'])
      return <List size="small" bordered dataSource={items} renderItem={(it) => <List.Item>{it}</List.Item>} />
    }
    case 'image':
      return (
        <div style={{ display: 'flex', justifyContent: justify }}>
          <Avatar shape="square" size={48} style={{ background: '#e7eae8', color: '#69756e' }}>{cmp.label || 'Logo'}</Avatar>
        </div>
      )
    case 'divider':
      return <Divider style={{ margin: '6px 0' }} />
    case 'text':
    default:
      return <Typography.Paragraph style={{ textAlign: align, margin: 0, color: '#5a6b62' }}>{cmp.label || COMPONENT_TYPES[cmp.type]?.label}</Typography.Paragraph>
  }
}

export default function WireframeBlock({ cmp, selected, onSelect, onDuplicate, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cmp.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    outline: selected ? '2px solid var(--primary)' : 'none',
    borderRadius: 8,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`wf-item ${WIDTH_CLASS[cmp.width] || 'w-full'}${isDragging ? ' dragging' : ''}`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      {/* 內容設為不可互動，讓點擊用於選取、避免誤觸 antd 控制項 */}
      <div className="wb-ad" style={{ pointerEvents: 'none' }}>
        <Visual cmp={cmp} />
      </div>
      <span className="drag-handle" title="拖曳排序" {...attributes} {...listeners}>
        <GripVertical size={13} />
      </span>
      <div className="wb-tools">
        <button title="複製" onClick={(e) => { e.stopPropagation(); onDuplicate() }}><Copy size={12} /></button>
        <button title="刪除" onClick={(e) => { e.stopPropagation(); onDelete() }}><X size={13} /></button>
      </div>
    </div>
  )
}
