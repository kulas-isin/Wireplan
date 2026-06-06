import { useRef, useState } from 'react'
import { useStore } from '../store/StoreContext.jsx'
import { parseFile } from '../lib/importParsers.js'
import {
  buildFieldMapping,
  requirementsFromRows,
  requirementsFromText,
} from '../lib/requirementExtractor.js'
import { categoryMeta, CATEGORY_LIST } from '../lib/categories.js'

const FIELD_LABELS = {
  name: '功能名稱 *',
  description: '說明',
  category: '分類',
  priority: '優先級',
  estimate: '工時',
  price: '報價',
  note: '備註',
}

const SAMPLE = `會員登入：使用 Email 與密碼登入，支援忘記密碼
會員註冊：填寫基本資料並驗證 Email
商品列表：可搜尋、篩選分類與分頁瀏覽
商品詳情：顯示商品資訊、規格與加入購物車
購物車結帳：確認訂單明細、填寫收件與付款資訊
訂單管理後台：查詢與管理所有訂單狀態
銷售報表：依日期區間統計銷售並可匯出 Excel
請假申請流程：填寫申請、逐關主管簽核
系統參數設定：管理者設定系統參數與通知`

export default function ImportPanel({ onDone }) {
  const { current, dispatch } = useStore()
  const fileRef = useRef(null)
  const [drag, setDrag] = useState(false)
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState(null) // { kind, headers?, rows?, text? }
  const [mapping, setMapping] = useState({})
  const [preview, setPreview] = useState([])
  const [mode, setMode] = useState('replace')
  const [error, setError] = useState('')

  function recomputePreview(p, map) {
    if (!p) return setPreview([])
    if (p.kind === 'table') {
      setPreview(requirementsFromRows(p.rows, p.headers, map))
    } else {
      setPreview(requirementsFromText(p.text))
    }
  }

  async function handleFiles(files) {
    setError('')
    const file = files[0]
    if (!file) return
    try {
      const p = await parseFile(file)
      setParsed(p)
      if (p.kind === 'table') {
        const m = buildFieldMapping(p.headers)
        setMapping(m)
        recomputePreview(p, m)
      } else {
        setText(p.text)
        recomputePreview(p, null)
      }
    } catch (e) {
      console.error(e)
      setError('解析檔案失敗：' + (e.message || e))
    }
  }

  function handleTextParse() {
    setError('')
    const p = { kind: 'text', text }
    setParsed(p)
    recomputePreview(p, null)
  }

  function updateMapping(field, header) {
    const m = { ...mapping, [field]: header || undefined }
    setMapping(m)
    recomputePreview(parsed, m)
  }

  function doImport() {
    if (!preview.length) {
      setError('沒有可匯入的需求，請先解析資料。')
      return
    }
    dispatch({ type: 'IMPORT_REQUIREMENTS', requirements: preview, mode })
    onDone?.()
  }

  function loadSample() {
    setText(SAMPLE)
    const p = { kind: 'text', text: SAMPLE }
    setParsed(p)
    recomputePreview(p, null)
  }

  return (
    <div>
      <div className="panel">
        <h3>
          1. 匯入報價單需求
          <span className="hint">支援 Excel (.xlsx/.xls)、CSV、PDF，或直接貼上文字</span>
        </h3>

        <div className="grid2">
          <div>
            <div
              className={'dropzone' + (drag ? ' drag' : '')}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files) }}
            >
              <div className="big">📥</div>
              <div>點擊或拖曳檔案到此</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Excel / CSV / PDF</div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.txt"
                style={{ display: 'none' }}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          </div>

          <div>
            <label className="field">
              <span>或直接貼上需求文字（一行一項，可用「：」分隔名稱與說明）</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={'例如：\n會員登入：Email 與密碼登入\n商品列表：可搜尋與篩選'}
                style={{ height: 120 }}
              />
            </label>
            <div className="row">
              <button className="primary" onClick={handleTextParse}>解析文字</button>
              <button onClick={loadSample}>載入範例</button>
            </div>
          </div>
        </div>

        {error && <div style={{ color: 'var(--danger)', marginTop: 10 }}>{error}</div>}
      </div>

      {parsed?.kind === 'table' && (
        <div className="panel">
          <h3>2. 欄位對應 <span className="hint">確認試算表欄位對應到哪個需求屬性</span></h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
            {Object.keys(FIELD_LABELS).map((field) => (
              <label className="field" key={field}>
                <span>{FIELD_LABELS[field]}</span>
                <select value={mapping[field] || ''} onChange={(e) => updateMapping(field, e.target.value)}>
                  <option value="">（不對應）</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {parsed && (
        <div className="panel">
          <h3>3. 預覽與匯入 <span className="hint">共解析出 {preview.length} 項需求</span></h3>
          {preview.length === 0 ? (
            <div className="muted">沒有解析到需求，請確認資料格式或欄位對應。</div>
          ) : (
            <>
              <div style={{ maxHeight: 320, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table className="req">
                  <thead>
                    <tr><th>#</th><th>功能名稱</th><th>分類</th><th>說明</th></tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => {
                      const cat = categoryMeta(r.category)
                      return (
                        <tr key={r.id}>
                          <td>{i + 1}</td>
                          <td>{r.name}</td>
                          <td><span className="tag" style={{ background: cat.color }}>{cat.label}</span></td>
                          <td className="muted">{r.description || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="row" style={{ marginTop: 14 }}>
                <label className="row" style={{ gap: 6 }}>
                  <input type="radio" style={{ width: 'auto' }} checked={mode === 'replace'} onChange={() => setMode('replace')} />
                  取代現有需求
                </label>
                <label className="row" style={{ gap: 6 }}>
                  <input type="radio" style={{ width: 'auto' }} checked={mode === 'append'} onChange={() => setMode('append')} />
                  附加到現有需求
                </label>
                <div style={{ flex: 1 }} />
                <button className="primary" onClick={doImport}>
                  匯入 {preview.length} 項並產生 Wireframe / 流程
                </button>
              </div>
              {current.requirements.length > 0 && mode === 'replace' && (
                <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                  ⚠️ 取代會清除目前 {current.requirements.length} 項需求與其手動調整。
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="panel">
        <h3>分類對照</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORY_LIST.map((c) => (
            <span key={c.key} className="tag" style={{ background: c.color }}>{c.label}</span>
          ))}
        </div>
        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          系統會依需求名稱與說明自動判斷分類，並套用對應的 wireframe 範本與流程步驟。匯入後皆可手動調整。
        </div>
      </div>
    </div>
  )
}
