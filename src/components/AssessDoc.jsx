import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { X, Printer } from 'lucide-react'

// 需求評估單：新需求 / 異動進來後，我方評估「可吸收（不另收費）」或「需報價」，
// 印給客戶逐條勾選 同意執行 / 暫緩 並回簽 —— 決定哪些走報價、哪些直接吸收開發。
// 收錄範圍：待確認的新需求（未蓋章）+ 異動中（已拆封）的卡。
export default function AssessDoc({ onClose }) {
  const { current, dispatch } = useStore()
  const eligible = (current.requirements || []).filter((r) => r.pending || (r.versions || []).length === 0)
  const [excluded, setExcluded] = useState(() => new Set())
  const rows = eligible.filter((r) => !excluded.has(r.id))
  const parties = current.parties || { vendor: '', client: '' }
  const setParty = (k, v) => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'parties', value: { ...parties, [k]: v } })
  const patch = (id, p) => dispatch({ type: 'UPDATE_REQUIREMENT', id, patch: p })
  const today = new Date().toLocaleDateString('zh-TW')
  const VERDICT = { absorb: '可吸收', quote: '需報價', '': '評估中' }
  const num = (s) => { const m = String(s || '').replace(/[,，]/g, '').match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : 0 }
  const total = rows.filter((r) => r.assess === 'quote').reduce((a, r) => a + num(r.price), 0)

  return (
    <div className="cd-wrap">
      <div className="cd-bar">
        <strong>需求評估單</strong>
        <input className="cd-party" value={parties.vendor} placeholder="提供方（你的公司）" onChange={(e) => setParty('vendor', e.target.value)} />
        <input className="cd-party" value={parties.client} placeholder="客戶方" onChange={(e) => setParty('client', e.target.value)} />
        <div className="spacer" />
        <button className="primary" onClick={() => window.print()}><Printer size={15} /> 列印 / 存 PDF</button>
        <button className="ghost sm" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="cd-scroll">
        <div className="cd-doc">
          <div className="cd-title">需求評估單</div>
          <div className="cd-meta">
            <span>專案：{current.name}</span>
            <span>日期：{today}</span>
          </div>
          <div className="cd-meta">
            <span>提供方：{parties.vendor || '＿＿＿＿＿＿＿＿'}</span>
            <span>客戶方：{parties.client || '＿＿＿＿＿＿＿＿'}</span>
          </div>
          <p style={{ fontSize: 12.5, color: '#333' }}>
            以下為近期提出之新需求／異動項目，經我方評估結果如下。標示「可吸收」者納入現行範圍開發、不另收費；標示「需報價」者請於「客戶決定」欄勾選，同意執行之項目將依報價（或另出正式報價單）進行。
          </p>

          {rows.length === 0 && <p style={{ color: '#98a49d' }}>目前沒有待評估的新需求或異動項目。</p>}

          {rows.length > 0 && (
            <table className="cd-table">
              <thead>
                <tr>
                  <th style={{ width: 26 }}>#</th><th>需求</th><th style={{ width: 52 }}>類型</th>
                  <th style={{ width: 78 }}>評估結果</th><th style={{ width: 56 }}>工時</th><th style={{ width: 70 }}>報價</th>
                  <th style={{ width: 118 }}>客戶決定</th>
                  <th className="noprint" style={{ width: 30 }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td className="cd-nm">{r.name}</td>
                    <td>{r.pending ? '異動' : '新需求'}</td>
                    <td>{VERDICT[r.assess || '']}{r.assess === 'absorb' && <span className="cd-v">　免費</span>}</td>
                    <td>{r.assess === 'quote' ? r.estimate : '—'}</td>
                    <td>{r.assess === 'quote' ? r.price : '—'}</td>
                    <td>{r.assess === 'quote' ? '□ 同意執行　□ 暫緩' : '□ 知悉'}</td>
                    <td className="noprint"><button className="ad-x" title="這次先不列入" onClick={() => setExcluded(new Set([...excluded, r.id]))}><X size={13} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {total > 0 && <div style={{ fontSize: 12.5, fontWeight: 700, textAlign: 'right' }}>需報價項目合計：{total.toLocaleString()}（以正式報價為準）</div>}

          {rows.length > 0 && <div className="cd-st" style={{ marginTop: 14 }}>項目說明與評估</div>}
          {rows.map((r, i) => (
            <div key={r.id} className="cd-item">
              <div className="cd-item-h">{i + 1}. {r.name}<span className="cd-item-tag">{r.pending ? '異動' : '新需求'}</span></div>
              {r.pending?.note && <div className="cd-quote">異動內容：{r.pending.note}</div>}
              {r.description && <div className="cd-desc">{r.description}</div>}
              {/* 評估編輯：只在螢幕上顯示，列印時隱藏 */}
              <div className="ad-edit noprint">
                <span className="ad-seg">
                  {[['absorb', '可吸收'], ['quote', '需報價'], ['', '評估中']].map(([k, label]) => (
                    <button key={k || 'na'} className={(r.assess || '') === k ? 'on' : ''} onClick={() => patch(r.id, { assess: k })}>{label}</button>
                  ))}
                </span>
                {r.assess === 'quote' && (
                  <span className="ad-cost">
                    工時<input value={r.estimate || ''} placeholder="如 3天" onChange={(e) => patch(r.id, { estimate: e.target.value })} />
                    報價<input value={r.price || ''} placeholder="如 15000" onChange={(e) => patch(r.id, { price: e.target.value })} />
                  </span>
                )}
              </div>
            </div>
          ))}

          <div className="cd-sign">
            <p>客戶確認上述評估結果：「需報價」項目以勾選為準，同意執行者依報價進行；「可吸收」項目由提供方納入現行範圍開發，不另收費。回簽本文件或以訊息回覆「確認」視為同意。</p>
            <div className="cd-sig-row">
              <span>客戶簽名：＿＿＿＿＿＿＿＿＿＿</span>
              <span>日期：＿＿＿＿＿＿＿＿</span>
            </div>
          </div>
          <div className="cd-foot">本文件由 Wireplan 產出 · {today}</div>
        </div>
      </div>
    </div>
  )
}
