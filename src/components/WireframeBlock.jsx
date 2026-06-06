// 將單一 wireframe 元件渲染成「線框視覺」。
import { COMPONENT_TYPES } from '../lib/wireframeTemplates.js'
import { ChevronUp, ChevronDown, X, Search } from 'lucide-react'

// 取出陣列型屬性的 key（不同元件用不同欄位名）
export const ARRAY_PROP = {
  buttonRow: 'buttons',
  table: 'columns',
  filter: 'fields',
  statcards: 'cards',
  steps: 'steps',
  tabs: 'tabs',
  list: 'items',
  cardlist: 'cards',
}

function arr(cmp) {
  const key = ARRAY_PROP[cmp.type]
  return key ? cmp[key] || [] : []
}

function Visual({ cmp }) {
  const items = arr(cmp)
  switch (cmp.type) {
    case 'header':
      return <div className="wb wb-header">{cmp.label}</div>
    case 'nav':
      return <div className="wb wb-nav">{(cmp.label || '選單一,選單二,選單三').split(',').map((s, i) => <span key={i}>{s.trim() || `選單${i + 1}`}</span>)}</div>
    case 'breadcrumb':
      return <div className="wb" style={{ background: 'transparent', border: 'none', padding: 2, color: '#94a3b8' }}>{cmp.label}</div>
    case 'image':
      return <div className="wb wb-image"><div className="wb-logo">{cmp.label || 'Logo'}</div></div>
    case 'searchbar':
      return <div className="wb wb-search"><Search size={13} /> <span style={{ color: '#94a3b8' }}>{cmp.label || '搜尋…'}</span></div>
    case 'field': {
      const ctrl = cmp.control || 'input'
      return (
        <div className="wb wb-field">
          <div className="lbl">{cmp.label}{ctrl === 'select' ? ' ▾' : ''}</div>
          {ctrl === 'toggle'
            ? <div style={{ width: 36, height: 20, borderRadius: 12, background: '#cbd5e1', position: 'relative' }}><div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: 2 }} /></div>
            : <div className={'box' + (ctrl === 'textarea' ? ' textarea' : '')} />}
        </div>
      )
    }
    case 'buttonRow':
      return (
        <div className="wb wb-btnrow" style={{ border: 'none', background: 'transparent', padding: 2 }}>
          {(items.length ? items : ['按鈕']).map((b, i) => (
            <span key={i} className={'wb-btn' + (i > 0 ? ' secondary' : '')}>{b}</span>
          ))}
        </div>
      )
    case 'table':
      return (
        <div className="wb wb-table">
          <div className="thead">{(items.length ? items : ['欄一', '欄二']).map((c, i) => <div key={i}>{c}</div>)}</div>
          {[0, 1, 2].map((r) => (
            <div className="trow" key={r}>{(items.length ? items : ['', '']).map((_, i) => <div key={i}>—</div>)}</div>
          ))}
        </div>
      )
    case 'pagination':
      return <div className="wb wb-pagination">◄ 1 2 3 … ► <span style={{ color: '#94a3b8', marginLeft: 6 }}>{cmp.label}</span></div>
    case 'statcards':
      return (
        <div className="wb-statcards">
          {(items.length ? items : ['指標', '指標', '指標', '指標']).map((c, i) => (
            <div className="wb-stat" key={i}><div className="num">00</div><div className="cap">{c}</div></div>
          ))}
        </div>
      )
    case 'chart':
      return (
        <div className="wb wb-chart">
          {[40, 70, 55, 90, 60, 80].map((h, i) => <div className="bar" key={i} style={{ height: `${h}%` }} />)}
        </div>
      )
    case 'cardlist':
      return <div className="wb-cardlist">{[0, 1, 2].map((i) => <div className="ci" key={i} />)}</div>
    case 'steps':
      return (
        <div className="wb-steps">
          {(items.length ? items : ['步驟一', '步驟二', '步驟三']).map((s, i) => (
            <div className={'st' + (i === 0 ? ' active' : '')} key={i}>{i + 1}. {s}</div>
          ))}
        </div>
      )
    case 'tabs':
      return (
        <div className="wb-tabs">
          {(items.length ? items : ['頁籤一', '頁籤二']).map((t, i) => (
            <div className={'tb' + (i === 0 ? ' active' : '')} key={i}>{t}</div>
          ))}
        </div>
      )
    case 'list':
      return (
        <div className="wb wb-list">
          {(items.length ? items : ['項目一', '項目二', '項目三']).map((t, i) => <div className="li" key={i}>• {t}</div>)}
        </div>
      )
    case 'divider':
      return <div className="wb wb-divider" />
    case 'text':
    default:
      return <div className="wb" style={{ background: 'transparent', borderStyle: 'dashed', color: '#475569' }}>{cmp.label || COMPONENT_TYPES[cmp.type]?.label}</div>
  }
}

export default function WireframeBlock({ cmp, selected, onSelect, onMove, onDelete }) {
  return (
    <div style={{ position: 'relative' }} onClick={(e) => { e.stopPropagation(); onSelect() }}>
      <div className={selected ? 'wb-wrap selected' : 'wb-wrap'} style={{ outline: selected ? '2px solid var(--primary)' : 'none', borderRadius: 6 }}>
        <Visual cmp={cmp} />
      </div>
      <div className="wb-tools">
        <button title="上移" onClick={(e) => { e.stopPropagation(); onMove(-1) }}><ChevronUp size={13} /></button>
        <button title="下移" onClick={(e) => { e.stopPropagation(); onMove(1) }}><ChevronDown size={13} /></button>
        <button title="刪除" onClick={(e) => { e.stopPropagation(); onDelete() }}><X size={13} /></button>
      </div>
    </div>
  )
}
