import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/StoreContext.jsx'
import { downloadText } from '../lib/download.js'
import {
  Q_STATUS, Q_BASIS, Q_OWNER, statusLabel, basisLabel, ownerLabel,
  latest, statusOf, groupByFlow, sortQuestions, mergeQuestions, nextCode, questionsMarkdown,
} from '../lib/questions.js'
import { X, Plus, Pencil, Trash2, HelpCircle, Upload, Download, FileText, ChevronUp, ArrowUpRight, GitBranch } from 'lucide-react'

// 待釐清問題清單：unit＝null 看全專案、字串＝只看該單元；flowId 給定時先只看那張流程圖的題目。
// 依流程分組，一眼看出哪張圖還有懸念；答覆每存一次加一版。
export default function QuestionsPanel({ unit = null, flowId = null, focusId = null, onClose }) {
  const { current, dispatch } = useStore()
  const all = current.questions || []
  const flows = current.unitFlows || []
  const units = useMemo(() => {
    const s = new Set([...(current.units || []), ...all.map((q) => q.unit).filter(Boolean)])
    return [...s]
  }, [current.units, all])

  const [unitPick, setUnitPick] = useState(unit) // null＝全部
  const [flowPick, setFlowPick] = useState(flowId)
  const [st, setSt] = useState(focusId ? 'all' : 'open')
  const [openId, setOpenId] = useState(focusId)
  const [adding, setAdding] = useState(false)
  const fileRef = useRef(null)
  const [msg, setMsg] = useState('')
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 2600) }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // eslint-disable-line
  useEffect(() => {
    if (!focusId) return
    setTimeout(() => document.getElementById('qs-' + focusId)?.scrollIntoView({ block: 'center' }), 60)
  }, [focusId])

  const inScope = all.filter((q) => (unitPick === null || (q.unit || '') === unitPick) && (!flowPick || q.flowId === flowPick))
  const count = (k) => inScope.filter((q) => statusOf(q) === k).length
  const shown = sortQuestions(st === 'all' ? inScope : inScope.filter((q) => statusOf(q) === st))
  const groups = groupByFlow(shown, flows)
  const flowName = (id) => flows.find((f) => f.id === id)?.name || ''

  const exportJSON = () => {
    downloadText(`${current.name}.questions.json`, JSON.stringify({ questions: inScope }, null, 2), 'application/json')
  }
  const exportMD = () => downloadText(`${current.name}.待釐清問題.md`, questionsMarkdown(current, inScope), 'text/markdown')
  const importFile = (file) => {
    if (!file) return
    const rd = new FileReader()
    rd.onload = () => {
      try {
        const parsed = JSON.parse(rd.result)
        const inc = Array.isArray(parsed) ? parsed : parsed.questions
        if (!Array.isArray(inc) || !inc.length) { flash('檔案裡找不到 questions 陣列'); return }
        const { added, updated } = mergeQuestions(all, inc)
        dispatch({ type: 'IMPORT_QUESTIONS', questions: inc })
        flash(`已匯入：新增 ${added} 題、更新 ${updated} 題（本機的答覆版本保留）`)
      } catch { flash('不是有效的 JSON 檔') }
    }
    rd.readAsText(file)
  }

  const scopeTitle = flowPick ? flowName(flowPick) : unitPick === null ? '全專案' : unitPick || '專案級'

  return createPortal(
    <div className="uf-wrap qs-wrap">
      <div className="uf-head">
        <HelpCircle size={18} />
        <strong>待釐清問題・{scopeTitle}（{inScope.length}）</strong>
        <div className="spacer" />
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = '' }} />
        <button className="uw-mini" title="匯入問題（JSON；同編號的題目合併，答覆版本保留）" onClick={() => fileRef.current?.click()}><Upload size={14} /></button>
        <button className="uw-mini" title="匯出目前範圍的問題（JSON，可再匯入）" onClick={exportJSON}><Download size={14} /></button>
        <button className="uw-mini" title="匯出成 Markdown 清單" onClick={exportMD}><FileText size={14} /></button>
        <button className="uf-new" title="新增問題" onClick={() => { setAdding(true); setOpenId(null) }}><Plus size={14} /><span className="qs-newtxt"> 新增</span></button>
        <button className="rd-back" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="uf-body qs-body">
        <div className="qs-pills">
          {[['open', '待釐清'], ['answered', '已答覆'], ['closed', '已結案'], ['dropped', '不處理']].map(([k, l]) => (
            (k === 'open' || count(k) > 0) && <button key={k} className={'qs-pill' + (st === k ? ' on' : '')} onClick={() => setSt(k)}>{l}<i>{count(k)}</i></button>
          ))}
          <button className={'qs-pill' + (st === 'all' ? ' on' : '')} onClick={() => setSt('all')}>全部<i>{inScope.length}</i></button>
        </div>
        {(unit === null || flowPick) && (
          <div className="qs-scope">
            {unit === null && (
              <select value={unitPick ?? '__all'} onChange={(e) => { setUnitPick(e.target.value === '__all' ? null : e.target.value); setFlowPick(null) }}>
                <option value="__all">全部單元</option>
                {units.map((u) => <option key={u} value={u}>{u}（{all.filter((q) => q.unit === u && statusOf(q) === 'open').length} 待釐清）</option>)}
                <option value="">專案級</option>
              </select>
            )}
            {flowPick && <button className="qs-chip on" onClick={() => setFlowPick(null)}><GitBranch size={11} /> 只看「{flowName(flowPick)}」 ✕</button>}
          </div>
        )}
        {msg && <div className="qs-msg">{msg}</div>}

        {adding && (
          <QuestionForm
            init={{ code: nextCode(all), unit: unitPick ?? (units[0] || ''), flowId: flowPick, title: '', detail: '', basis: '', owner: 'client' }}
            units={units} flows={flows}
            onCancel={() => setAdding(false)}
            onSave={(q) => {
              if (all.some((x) => x.code === q.code)) { alert(`編號 ${q.code} 已存在`); return }
              dispatch({ type: 'ADD_QUESTION', question: q }); setAdding(false); setSt('open')
            }} />
        )}

        {shown.length === 0 && !adding && (
          <div className="uf-empty">
            {inScope.length === 0
              ? <>這裡還沒有問題。流程或頁面上想不通、要問客戶、要等實測的事，按右上「新增」記一筆；也可以匯入整份清單（JSON）。</>
              : <>這個分類沒有題目。</>}
          </div>
        )}

        {groups.map((g) => (
          <div key={g.flowId || '_'} className="qs-group">
            <div className="qs-ghead">
              {g.flowId ? <GitBranch size={12} /> : null}
              <span>{g.name}</span>
              <i>{g.items.length}</i>
            </div>
            {g.items.map((q) => (
              <QuestionCard key={q.id} q={q} open={openId === q.id} units={units} flows={flows} showUnit={unitPick === null}
                onToggle={() => setOpenId(openId === q.id ? null : q.id)} dispatch={dispatch} />
            ))}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}

function Seg({ list, value, onChange, allowEmpty }) {
  return (
    <span className="qs-seg">
      {list.map(([k, l]) => (
        <button key={k} type="button" className={value === k ? 'on' : ''}
          onClick={() => onChange(allowEmpty && value === k ? '' : k)}>{l}</button>
      ))}
    </span>
  )
}

function QuestionForm({ init, units, flows, onSave, onCancel }) {
  const [f, setF] = useState(init)
  const set = (p) => setF((s) => ({ ...s, ...p }))
  const unitFlows = flows.filter((x) => (x.unit || '') === (f.unit || ''))
  const save = () => {
    if (!f.title.trim()) { alert('寫一句問題'); return }
    onSave({ ...f, title: f.title.trim(), code: f.code.trim() || init.code })
  }
  return (
    <div className="qs-form">
      <div className="qs-row">
        <input className="qs-code-in" value={f.code} onChange={(e) => set({ code: e.target.value })} aria-label="編號" />
        <input className="qs-title-in" autoFocus value={f.title} placeholder="要釐清的問題（一句話）" onChange={(e) => set({ title: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && save()} />
      </div>
      <textarea rows={3} value={f.detail} placeholder="說明、我方建議或推測（選填）" onChange={(e) => set({ detail: e.target.value })} />
      <div className="qs-meta">
        <label><span>單元</span>
          <select value={f.unit} onChange={(e) => set({ unit: e.target.value, flowId: null })}>
            {units.map((u) => <option key={u} value={u}>{u}</option>)}
            <option value="">專案級</option>
          </select>
        </label>
        <label><span>流程</span>
          <select value={f.flowId || ''} onChange={(e) => set({ flowId: e.target.value || null })}>
            <option value="">不掛流程</option>
            {unitFlows.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      </div>
      <div className="qs-meta">
        <span className="qs-lbl">依據</span><Seg list={Q_BASIS} value={f.basis} onChange={(v) => set({ basis: v })} allowEmpty />
      </div>
      <div className="qs-meta">
        <span className="qs-lbl">誰來解</span><Seg list={Q_OWNER} value={f.owner} onChange={(v) => set({ owner: v })} allowEmpty />
      </div>
      <div className="qs-btns">
        <button className="uf-sealbtn" onClick={onCancel}>取消</button>
        <button className="uf-sealgo" onClick={save}>{init.title ? '儲存' : '新增問題'}</button>
      </div>
    </div>
  )
}

function QuestionCard({ q, open, units, flows, showUnit, onToggle, dispatch }) {
  const cur = latest(q)
  const status = statusOf(q)
  const vers = q.versions || []
  const flowName = flows.find((f) => f.id === q.flowId)?.name
  const [editing, setEditing] = useState(false)
  const [ans, setAns] = useState('')
  const [src, setSrc] = useState('')
  const [ansSt, setAnsSt] = useState('answered')

  if (editing) {
    return (
      <QuestionForm init={q} units={units} flows={flows}
        onCancel={() => setEditing(false)}
        onSave={(p) => { dispatch({ type: 'UPDATE_QUESTION', id: q.id, patch: { code: p.code, title: p.title, detail: p.detail, unit: p.unit, flowId: p.flowId, basis: p.basis, owner: p.owner } }); setEditing(false) }} />
    )
  }
  const saveAnswer = () => {
    if (!ans.trim() && ansSt === (cur?.status || 'open')) { alert('寫下答覆或結論'); return }
    dispatch({ type: 'ANSWER_QUESTION', id: q.id, version: { answer: ans.trim(), source: src.trim(), status: ansSt } })
    setAns(''); setSrc('')
  }
  const remove = () => {
    if (!confirm(`刪除問題「${q.code} ${q.title}」${vers.length ? `與 ${vers.length} 個答覆版本` : ''}？`)) return
    dispatch({ type: 'DELETE_QUESTION', id: q.id })
  }
  // 底部 pill 右側：已答過就標版本；誰來解用卡片右下 chip；依據只有「推測」要被看見（pill 旁一點）
  const who = status === 'open' ? ownerLabel(q.owner) : statusLabel(status)

  return (
    <div id={'qs-' + q.id} className={'qs-item' + (open ? ' open' : '')}>
      <div className={'qs-c st-' + status} onClick={onToggle} role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}>
        <h3>{q.title}</h3>
        <span className="qs-go" aria-hidden="true">{open ? <ChevronUp size={15} /> : <ArrowUpRight size={15} />}</span>
        {!open && cur?.answer && <div className="qs-ans1">{cur.answer}</div>}
        <div className="qs-foot">
          <span className="qs-where" title={[showUnit && q.unit, flowName].filter(Boolean).join(' · ')}>
            {showUnit && q.unit && <span className="qs-unit">{q.unit}</span>}
            {flowName && <span className="qs-flow"><GitBranch size={11} /> {flowName}</span>}
          </span>
          {who && <span className="qs-chip">{who}</span>}
        </div>
        <span className="qs-tab">{q.code}{cur ? ` · v${cur.v}` : ''}{q.basis === 'guess' && <i className="qs-dot" title="我方推測，未經確認" />}</span>
      </div>
      {open && (
        <div className="qs-sub">
          {q.detail && <div className="qs-desc">{q.detail}</div>}
          <div className="qs-meta qs-metaline">
            {q.basis && <span className={'qs-mini b-' + q.basis}>依據：{basisLabel(q.basis)}</span>}
            {q.owner && <span className="qs-mini">{ownerLabel(q.owner)}</span>}
            {flowName && <span className="qs-mini"><GitBranch size={10} /> {flowName}</span>}
          </div>
          {cur && (
            <div className="qs-cur">
              <div className="qs-cur-h">目前結論・v{cur.v}{cur.source ? `・${cur.source}` : ''}<span>{new Date(cur.at).toLocaleDateString('zh-TW')}</span></div>
              <div className="qs-cur-t">{cur.answer || '（只改了狀態）'}</div>
            </div>
          )}
          <div className="qs-answer">
            <textarea rows={3} value={ans} placeholder={cur ? '結論有變？寫下新的答覆（會存成新版本，舊版保留）' : '答覆或結論…'}
              onChange={(e) => setAns(e.target.value)} />
            <input className="qs-src" value={src} placeholder="出處（如：第 3 場、LINE 9/30）" onChange={(e) => setSrc(e.target.value)} />
            <div className="qs-meta">
              <Seg list={Q_STATUS.filter(([k]) => k !== 'open').concat([['open', '仍待釐清']])} value={ansSt} onChange={setAnsSt} />
            </div>
            <div className="qs-btns">
              <button className="uw-mini" title="編輯題目" onClick={() => setEditing(true)}><Pencil size={13} /></button>
              <button className="uw-mini uf-del" title="刪除" onClick={remove}><Trash2 size={13} /></button>
              <div className="spacer" />
              <button className="uf-sealgo" onClick={saveAnswer}>存為 v{vers.length + 1}</button>
            </div>
          </div>
          {vers.length > 0 && (
            <div className="ht-wrap">
              <span className="ht-title">答覆履歷</span>
              {[...vers].reverse().map((v) => (
                <div key={v.v} className="ht-row ht-seal">
                  <span className="ht-dot" style={{ fontSize: 10, fontWeight: 800 }}>v{v.v}</span>
                  <span className="ht-txt"><b className={'qs-st st-' + v.status}>{statusLabel(v.status)}</b> {v.answer}{v.source ? `（${v.source}）` : ''}</span>
                  <span className="ht-date">{new Date(v.at).toLocaleDateString('zh-TW')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
