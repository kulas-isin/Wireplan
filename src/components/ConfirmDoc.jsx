import { useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { X, Printer, Sparkles } from 'lucide-react'

const DEFAULT_ACCEPT = ['使用者可正常進入此功能畫面', '主要操作流程可順利完成並儲存', '異常情況有適當提示']

// 客戶原話：note 以｜分段，濾掉合併標記後取第一段
const quoteOf = (r) => (r.note || '').split('｜').map((s) => s.trim()).filter((s) => s && !s.startsWith('（合併自'))[0] || ''

// 需求確認書：總覽表 + 逐條詳情（簽的是細節不是標題）；列印→儲存為 PDF
export default function ConfirmDoc({ onClose }) {
  const { current, dispatch } = useStore()
  const reqs = current.requirements || []
  const [showCost, setShowCost] = useState(false)
  const [copiedAI, setCopiedAI] = useState(false)
  const parties = current.parties || { vendor: '', client: '' }
  const setParty = (k, v) => dispatch({ type: 'UPDATE_PROJECT_FIELD', field: 'parties', value: { ...parties, [k]: v } })
  const maxV = Math.max(0, ...reqs.map((r) => (r.versions || []).length))
  const changes = reqs.flatMap((r) => (r.changeLog || []).map((c) => ({ name: r.name, ...c })))
  const today = new Date().toLocaleDateString('zh-TW')

  // AI 展開細節：複製「卡片＋指令」貼給 Claude → 回 requirementPatches JSON → 匯入自動回填空欄
  const copyAIPrompt = async () => {
    const cards = reqs.map((r) => ({ id: r.id, name: r.name, category: r.category, note: [quoteOf(r), ...(r.talks || []).map((t) => `${t.who === 'client' ? '客戶' : '我方'}：${t.text}`)].filter(Boolean).join('；'), description: r.description || '', acceptance: r.acceptance || '' }))
    const text = [
      '請幫我為以下需求卡片展開細節。對每張卡：',
      '1. description：2~3 句正式的功能說明（依 name 與 note 推斷合理範圍）',
      '2. acceptance：3~5 條可驗收的條件，每行一條',
      '3. name（選）：若原名稱口語/冗長，回傳更精煉的正式名稱（意思不可變；名稱清楚的不要回傳 name）',
      '4. elements：這條需求的畫面需要哪些元件，逐項列出（具體到顆，如「搜尋列」「匯出鈕」「訂單表格」「狀態篩選器」），4~10 項',
      '5. pages：這條需求涵蓋哪幾個畫面（含情境分支，如「付款失敗頁」「空狀態頁」），每頁附 bricks＝該頁該有的元件（具體到顆），1~6 頁',
      '只補「目前為空」的欄位（name、elements、pages 例外，後兩者一律回傳）；已有內容的原樣保留不要回傳。',
      '回傳格式（單一 JSON，可直接匯入 Wireplan）：',
      '{"requirementPatches":[{"id":"卡片id","description":"...","acceptance":"條件一\\n條件二","elements":["搜尋列","匯出鈕"],"pages":[{"name":"結帳頁","bricks":["訂單明細表","收件人表單","付款鈕"]},{"name":"付款失敗頁","bricks":["失敗原因","重試鈕"]}]}]}',
      '',
      '卡片：',
      JSON.stringify(cards, null, 1),
    ].join('\n')
    try { await navigator.clipboard.writeText(text) } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove()
    }
    setCopiedAI(true); setTimeout(() => setCopiedAI(false), 2400)
  }

  return (
    <div className="cd-wrap">
      <div className="cd-bar">
        <strong>需求確認書</strong>
        <label className="cd-toggle"><input type="checkbox" checked={showCost} onChange={(e) => setShowCost(e.target.checked)} /> 含工時/報價</label>
        <input className="cd-party" value={parties.vendor} placeholder="提供方（你的公司）" onChange={(e) => setParty('vendor', e.target.value)} />
        <input className="cd-party" value={parties.client} placeholder="客戶方" onChange={(e) => setParty('client', e.target.value)} />
        <div className="spacer" />
        <button onClick={copyAIPrompt} title="複製卡片＋指令貼給 AI，回傳 JSON 後用「匯入畫面 JSON」自動回填說明與驗收條件"><Sparkles size={15} /> {copiedAI ? '已複製，貼給 AI' : 'AI 展開細節'}</button>
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

          <div className="cd-st">一、需求總覽</div>
          <table className="cd-table">
            <thead>
              <tr><th style={{ width: 30 }}>#</th><th>需求</th><th style={{ width: 44 }}>優先</th><th style={{ width: 86 }}>狀態</th>{showCost && <><th style={{ width: 58 }}>工時</th><th style={{ width: 72 }}>報價</th></>}</tr>
            </thead>
            <tbody>
              {reqs.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td className="cd-nm">{r.name}</td>
                  <td>{r.priority}</td>
                  <td>{(r.versions || []).length > 0 ? `v${r.versions.length} 已確認` : '待確認'}</td>
                  {showCost && <><td>{r.estimate}</td><td>{r.price}</td></>}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="cd-st">二、需求詳情</div>
          {reqs.map((r, i) => {
            const quote = quoteOf(r)
            const accepts = r.acceptance ? r.acceptance.split('\n').map((s) => s.trim()).filter(Boolean) : DEFAULT_ACCEPT
            const isDefault = !r.acceptance
            return (
              <div key={r.id} className="cd-item">
                <div className="cd-item-h">{i + 1}. {r.name}<span className="cd-item-tag">{r.priority}</span>{(r.versions || []).length > 0 && <span className="cd-v">v{r.versions.length} 已確認</span>}</div>
                {r.description && <div className="cd-desc">{r.description}</div>}
                {(r.talks || []).length > 0 && (
                  <ul className="cd-acc">
                    {(r.talks || []).map((t, j) => <li key={j}>（{new Date(t.at).toLocaleDateString('zh-TW')} {t.who === 'client' ? '客戶' : '我方'}）{t.text}</li>)}
                  </ul>
                )}
                {quote && <div className="cd-quote">客戶原話：「{quote}」</div>}
                <div className="cd-acc-t">驗收條件{isDefault && <span className="cd-default">（預設，可再調整）</span>}</div>
                <ul className="cd-acc">{accepts.map((a, j) => <li key={j}>{a.replace(/^- \[ \] /, '')}</li>)}</ul>
              </div>
            )
          })}

          {changes.length > 0 && (
            <div className="cd-changes">
              <div className="cd-st">三、異動紀錄</div>
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
