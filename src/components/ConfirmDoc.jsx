import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { X, Printer } from 'lucide-react'

// 需求確認書：給客戶回簽的正式文件 — 列印友善頁，用系統「列印→儲存為 PDF」輸出
export default function ConfirmDoc({ onClose }) {
  const { current, dispatch } = useStore()
  const reqs = current.requirements || []
  const [showCost, setShowCost] = useState(false)
  const parties = current.parties || { vendor: '', client: '' }
  const setParty = (k, v) => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'parties', value: { ...parties, [k]: v } })
  const maxV = Math.max(0, ...reqs.map((r) => (r.versions || []).length))
  const changes = reqs.flatMap((r) => (r.changeLog || []).map((c) => ({ name: r.name, ...c })))
  const today = new Date().toLocaleDateString('zh-TW')

  return (
    <div className="cd-wrap">
      <div className="cd-bar">
        <strong>需求確認書</strong>
        <label className="cd-toggle"><input type="checkbox" checked={showCost} onChange={(e) => setShowCost(e.target.checked)} /> 含工時/報價</label>
        <input className="cd-party" value={parties.vendor} placeholder="提供方（你的公司）" onChange={(e) => setParty('vendor', e.target.value)} />
        <input className="cd-party" value={parties.client} placeholder="客戶方" onChange={(e) => setParty('client', e.target.value)} />
        <div className="spacer" />
        <button className="primary" onClick={() => window.print()}><Printer size={15} /> 列印 / 存 PDF</button>
        <button className="ghost sm" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="cd-scroll">
        <div className="cd-doc">
          <div className="cd-title">需求確認書</div>
          <div className="cd-meta">
            <span>專案：{current.name}</span>
            <span>版次：v{maxV || 1}{maxV === 0 ? '（草案）' : ''}</span>
            <span>日期：{today}</span>
          </div>
          <div className="cd-meta">
            <span>提供方：{parties.vendor || '＿＿＿＿＿＿＿＿'}</span>
            <span>客戶方：{parties.client || '＿＿＿＿＿＿＿＿'}</span>
          </div>
          <table className="cd-table">
            <thead>
              <tr><th style={{ width: 30 }}>#</th><th>需求</th><th>說明</th><th style={{ width: 44 }}>優先</th>{showCost && <><th style={{ width: 60 }}>工時</th><th style={{ width: 72 }}>報價</th></>}</tr>
            </thead>
            <tbody>
              {reqs.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td className="cd-nm">{r.name}{(r.versions || []).length > 0 && <span className="cd-v">（v{r.versions.length} 已確認）</span>}</td>
                  <td>{[r.description, (r.note || '').split('｜')[0]].filter(Boolean).join('；')}</td>
                  <td>{r.priority}</td>
                  {showCost && <><td>{r.estimate}</td><td>{r.price}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
          {changes.length > 0 && (
            <div className="cd-changes">
              <div className="cd-st">異動紀錄</div>
              {changes.map((c, i) => (
                <div key={i} className="cd-ch">・{new Date(c.at).toLocaleDateString('zh-TW')}　「{c.name}」：{c.note}</div>
              ))}
            </div>
          )}
          <div className="cd-sign">
            <p>上述需求內容經雙方確認無誤，同意依此進行後續設計與開發；後續如有異動，將另以異動確認記錄之。回簽本文件或以訊息回覆「確認」視為同意。</p>
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
