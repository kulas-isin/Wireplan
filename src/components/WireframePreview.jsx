// 唯讀 wireframe 預覽（給流程圖的「畫面縮圖節點」用）。
// 重用 WireframeBlock 的 Visual 渲染葉元件；row/card 容器在此遞迴，無 dnd/編輯。
import { Visual } from './WireframeBlock.jsx'

const WCLASS = { full: 'w-full', half: 'w-half', third: 'w-third', quarter: 'w-quarter', fill: 'w-fill', hug: 'w-hug', fixed: 'w-fixed' }

function PreviewItem({ cmp }) {
  const wcls = WCLASS[cmp.width] || 'w-full'
  if (cmp.type === 'row') {
    return (
      <div className={'wf-item wf-rowwrap ' + wcls}>
        <div className={'wf-row' + (cmp.direction === 'column' ? ' wf-row-col' : '')}>
          {(cmp.children || []).map((c) => <PreviewItem key={c.id} cmp={c} />)}
        </div>
      </div>
    )
  }
  if (cmp.type === 'card') {
    return (
      <div className={'wf-item wf-cardwrap ' + wcls}>
        <div className="wb-cardbox">
          {cmp.label && <div className="wb-cardbox-head">{cmp.label}</div>}
          <div className="wb-cardbox-body">{(cmp.children || []).map((c) => <PreviewItem key={c.id} cmp={c} />)}</div>
        </div>
      </div>
    )
  }
  return <div className={'wf-item ' + wcls}><Visual cmp={cmp} /></div>
}

export default function WireframePreview({ wireframe }) {
  const cmps = wireframe.components || []
  if (wireframe.layout === 'sidebar') {
    const side = cmps.filter((c) => c.region === 'sidebar')
    const content = cmps.filter((c) => c.region !== 'sidebar')
    return (
      <div className="wf-preview prev-sidebar">
        <div className="wf-canvas prev-side">{side.map((c) => <PreviewItem key={c.id} cmp={c} />)}</div>
        <div className="wf-canvas prev-content">{content.map((c) => <PreviewItem key={c.id} cmp={c} />)}</div>
      </div>
    )
  }
  return <div className="wf-preview"><div className="wf-canvas">{cmps.map((c) => <PreviewItem key={c.id} cmp={c} />)}</div></div>
}
