import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store/StoreContext.jsx'
import { unitsOf } from '../lib/units.js'
import { SECTION_KINDS } from './SpecSheet.jsx'
import Mermaid from './Mermaid.jsx'
import { X, Mail, FileText, Image as ImageIcon } from 'lucide-react'

// 會議記錄產生器：以「單元 → 粗流」為主軸，聚合時間範圍內的系統資料成一份記錄。
// 輸出：複製郵件格式（HTML 進剪貼簿，貼 Gmail/Outlook 保留表格與標籤）／複製 Markdown（存檔用）。
// 用詞規範：定案需求（不寫蓋章）、需評估（不寫規格外）、不出現 AI 字樣。

const DAY = 86400000
const fmtT = (t) => new Date(t).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
const fmtD = (t) => new Date(t).toLocaleDateString('zh-TW')

// 聚合：回傳 { units: [{name, flows:[…], seals, talks, specs, orphans}], assess, pending, imgs }
function build(project, from, to) {
  const inWin = (t) => t && t >= from && t <= to
  const flowsAll = project.unitFlows || []
  const reqsAll = project.requirements || []
  const qItems = project.quote?.items || []
  const unitNames = ['', ...unitsOf(project)] // '' = 專案級
  const out = { units: [], assess: [], pending: [], imgs: [] }

  for (const u of unitNames) {
    const flows = flowsAll.filter((f) => (f.unit || '') === u)
    const reqs = reqsAll.filter((r) => (r.unit || '').trim() === u)
    const fb = []
    for (const f of flows) {
      const vers = (f.versions || []).filter((v) => inWin(v.at))
      const sealedNow = f.sealed && inWin(f.sealed.at)
      const done = (f.revNotes || []).filter((n) => n.done && (inWin(n.doneAt) || (!n.doneAt && inWin(n.at))))
      const open = (f.revNotes || []).filter((n) => !n.done)
      const noteAdded = (f.revNotes || []).some((n) => inWin(n.at))
      if (!(vers.length || sealedNow || done.length || noteAdded)) continue
      fb.push({ f, vers, sealedNow, done, open })
      out.imgs.push({ f, unit: u || '專案級', changed: vers.length > 0 || sealedNow })
      for (const n of open) if (n.assess) out.assess.push({ text: n.text, src: (u || '專案級') + '・' + f.name })
    }
    const covered = new Set(flows.flatMap((f) => f.covers || []))
    const orphans = u ? reqs.filter((r) => !covered.has(r.id)) : []
    const seals = reqs.filter((r) => (r.versions || []).some((v) => inWin(v.at))).map((r) => r.name)
    const talks = reqs.flatMap((r) => (r.talks || []).filter((t) => inWin(t.at)).map((t) => ({ ...t, req: r.name })))
      .sort((a, b) => a.at - b.at)
    const specs = []
    for (const w of (project.wireframes || []).filter((w) => (w.unit || '') === u)) {
      for (const s of w.spec?.sections || []) {
        for (const it of s.items || []) {
          if (inWin(it.at)) {
            specs.push({ page: w.name, sec: (SECTION_KINDS[s.kind] || s.kind) + (s.title ? '・' + s.title : ''), label: it.label, c: !!it.c })
            if (!it.c) out.assess.push({ text: `${w.name}：新增「${it.label}」`, src: (u || '專案級') + '・頁面規格' })
          }
        }
      }
    }
    for (const r of reqs) if (r.pending) out.assess.push({ text: `${r.name}：${r.pending.note || '內容異動中'}`, src: (u || '專案級') + '・需求' })
    if (fb.length || seals.length || talks.length || specs.length) {
      out.units.push({
        name: u || '專案級流程', flows: fb, seals, talks, specs, orphans: orphans.map((r) => r.name),
        stat: u ? `粗流 ${flows.length} 張・定稿 ${flows.filter((f) => f.sealed).length}・需求涵蓋 ${reqs.filter((r) => covered.has(r.id)).length}/${reqs.length}` : `流程圖 ${flows.length} 張`,
      })
    }
  }
  for (const it of qItems) {
    for (const n of it.notes || []) {
      if (n.q && inWin(n.at)) {
        const req = reqsAll.find((r) => (it.reqIds || []).includes(r.id))
        out.pending.push({ text: n.text, src: (req?.unit || it.section || '') })
      }
    }
  }
  return out
}

// —— Markdown 版 ——
function toMd(p, data, meta, range) {
  const L = [`# ${p.name}・需求確認會議記錄`]
  const m = [meta.session, range, meta.attend].filter(Boolean).join('｜')
  if (m) L.push(m)
  for (const u of data.units) {
    L.push(`\n## ${u.name}`, `單元進度：${u.stat}`)
    for (const { f, vers, sealedNow, done, open } of u.flows) {
      L.push(`\n### ${f.name}`)
      for (const v of vers) L.push(`- ${v.v === 1 ? '建立初版 v1' : `v${v.v - 1} → v${v.v}`}：${v.note}（${fmtT(v.at)}${sealedNow && f.sealed.v === v.v ? '，會中定稿 ✓' : ''}）`)
      if (!vers.length) L.push(`- 本次無改版，維持 v${f.versions.length}${f.sealed ? '（已定稿）' : ''}${sealedNow ? '，會中定稿 ✓' : ''}`)
      if (done.length) { L.push('- 決議事項：'); done.forEach((n) => L.push(`  - ${n.text}`)) }
      if (open.length) { L.push('- 待辦：'); open.forEach((n) => L.push(`  - ${n.text}${n.assess ? '【需評估】' : ''}`)) }
    }
    if (u.talks.length) { L.push('\n對話重點：'); u.talks.forEach((t) => L.push(`> ${t.who === 'client' ? '客戶' : '我方'}：「${t.text}」（${t.req}，${fmtT(t.at)}）`)) }
    if (u.specs.length) { L.push('\n頁面規格調整：'); u.specs.forEach((s) => L.push(`- ${s.page}・${s.sec}：新增「${s.label}」${s.c ? '' : '【需評估】'}`)) }
    if (u.orphans.length) L.push(`\n單元備註：尚有 ${u.orphans.length} 條需求未被粗流涵蓋（${u.orphans.join('、')}）`)
    if (u.seals.length) L.push(`本次定案需求：${u.seals.join('、')}`)
  }
  if (data.assess.length) { L.push('\n## 需評估彙整'); data.assess.forEach((a, i) => L.push(`${i + 1}. ${a.text}（${a.src}）`)) }
  if (data.pending.length) { L.push('\n## 待確認事項（下次會議）'); data.pending.forEach((q, i) => L.push(`Q${i + 1}. ${q.text}${q.src ? `（${q.src}）` : ''}`)) }
  L.push(`\n${meta.foot}`)
  return L.join('\n')
}

// —— 郵件版（行內樣式；貼進 Gmail/Outlook 保留樣式）——
function toHtml(p, data, meta, range) {
  // 信件配色：內文中性黑、表格淡藍；需評估保留語意橙
  const tag = (t, c, b) => `<span style="font-size:11px;font-weight:700;border-radius:999px;padding:1px 8px;color:${c};background:${b}">${t}</span>`
  const assessTag = tag('需評估', '#9A6B1F', '#FBF3E2')
  const TH = 'background:#EAF2FB;color:#1A1A1A;text-align:left;padding:7px 10px;border:1px solid #C9DCEF;font-size:13px'
  const TD = 'padding:7px 10px;border:1px solid #D9E5F2;font-size:13px;vertical-align:top;line-height:1.7;color:#1A1A1A'
  const table = (heads, rows) => `<table style="border-collapse:collapse;width:100%;margin:6px 0">` +
    `<tr>${heads.map((h) => `<th style="${TH}">${h}</th>`).join('')}</tr>` +
    rows.map((r) => `<tr>${r.map((c) => `<td style="${TD}">${c}</td>`).join('')}</tr>`).join('') + `</table>`
  const h2 = (t) => `<h2 style="font-size:15.5px;color:#1A1A1A;border-left:4px solid #B8D4EE;padding-left:9px;margin:20px 0 6px">${t}</h2>`
  const small = (t) => `<p style="font-size:12px;color:#666666;margin:2px 0">${t}</p>`
  const H = [`<div style="font-family:'Noto Sans TC',sans-serif;color:#1A1A1A;line-height:1.7">`,
    `<h1 style="font-size:17px;margin:0 0 2px;color:#1A1A1A">${p.name}・需求確認會議記錄</h1>`]
  const m = [meta.session, range, meta.attend].filter(Boolean).join('｜')
  if (m) H.push(small(m))
  for (const u of data.units) {
    H.push(h2(u.name), small('單元進度：' + u.stat))
    const rows = u.flows.map(({ f, vers, sealedNow, done, open }) => {
      const cell = []
      for (const v of vers) cell.push(`${v.v === 1 ? '建立初版 v1' : `v${v.v - 1} → v${v.v}`}：${v.note}（${fmtT(v.at)}${sealedNow && f.sealed.v === v.v ? '，會中定稿 ✓' : ''}）`)
      if (!vers.length) cell.push(`本次無改版，維持 v${f.versions.length}${f.sealed ? '（已定稿）' : ''}${sealedNow ? '，會中定稿 ✓' : ''}`)
      if (done.length) cell.push(`決議：${done.map((n) => n.text).join('；')}`)
      if (open.length) cell.push(`待辦：${open.map((n) => n.text + (n.assess ? ' ' + assessTag : '')).join('；')}`)
      return [`<b>${f.name}</b>`, cell.join('<br>')]
    })
    if (rows.length) H.push(table(['流程', '本次內容'], rows))
    for (const t of u.talks) H.push(`<p style="border-left:3px solid #D9E5F2;padding-left:9px;font-size:13px;color:#555555;margin:4px 0">${t.who === 'client' ? '客戶' : '我方'}：「${t.text}」（${t.req}，${fmtT(t.at)}）</p>`)
    if (u.specs.length) H.push(table(['頁面規格調整', '新增項目'], u.specs.map((s) => [`${s.page}・${s.sec}`, `「${s.label}」${s.c ? '' : ' ' + assessTag}`])))
    if (u.orphans.length) H.push(small(`單元備註：尚有 ${u.orphans.length} 條需求未被粗流涵蓋（${u.orphans.join('、')}）`))
    if (u.seals.length) H.push(small(`本次定案需求：<b>${u.seals.join('、')}</b>`))
  }
  if (data.assess.length) H.push(h2('需評估彙整'), table(['#', '內容', '出處'], data.assess.map((a, i) => [String(i + 1), a.text, a.src])))
  if (data.pending.length) H.push(h2('待確認事項（下次會議）'), table(['#', '問題', '出處'], data.pending.map((q, i) => [`Q${i + 1}`, q.text, q.src || ''])))
  H.push(small(meta.foot), '</div>')
  return H.join('')
}

// 附圖列：版本 chips 可切舊版（複製「調整前」）；預設顯示最新版
function FlowImg({ f, unit, copied, copyImg, imgRefs }) {
  const [vi, setVi] = useState(f.versions.length - 1)
  const ver = f.versions[vi]
  return (
    <div className="md-img">
      <div className="md-img-head">
        <span>{unit}・{f.name}</span>
        {f.versions.length > 1 && (
          <span className="uf-vchips">
            {f.versions.map((v, i) => (
              <button key={v.v} className={'uf-vchip' + (i === vi ? ' on' : '')} onClick={() => setVi(i)}>v{v.v}</button>
            ))}
          </span>
        )}
        <button className="uf-sealbtn" onClick={() => copyImg(f.id)}>
          <ImageIcon size={12} /> {copied === 'img' + f.id ? '已複製' : `複製 v${ver.v} 圖片`}</button>
      </div>
      <div ref={(el) => { imgRefs.current[f.id] = el }}><Mermaid code={ver.code} /></div>
    </div>
  )
}

const DEF_FOOT = '以上決議若三日內未回覆異議，視為雙方確認，列入需求基準。標示「需評估」之項目將另行提出評估結果。'
const ls = (k, d) => { try { return localStorage.getItem(k) ?? d } catch { return d } }

export default function MeetingDoc({ onClose }) {
  const { current } = useStore()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dstr = (t) => new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  const [d1, setD1] = useState(dstr(today.getTime()))
  const [d2, setD2] = useState(dstr(today.getTime()))
  const [session, setSession] = useState('')
  const [attend, setAttend] = useState(ls('wp-meet-attend', ''))
  const [foot, setFoot] = useState(ls('wp-meet-foot', DEF_FOOT))
  const [copied, setCopied] = useState('')
  const [showAllImgs, setShowAllImgs] = useState(false)
  const from = new Date(d1 + 'T00:00:00').getTime()
  const to = new Date(d2 + 'T00:00:00').getTime() + DAY - 1
  const data = useMemo(() => build(current, from, to), [current, from, to])
  const range = d1 === d2 ? fmtD(from) : `${fmtD(from)} — ${fmtD(to)}`
  const meta = { session, attend, foot }
  const flag = (k, v) => { setCopied(k); setTimeout(() => setCopied(''), 2500) }

  const copyMail = async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([toHtml(current, data, meta, range)], { type: 'text/html' }),
        'text/plain': new Blob([toMd(current, data, meta, range)], { type: 'text/plain' }),
      })])
      flag('mail')
    } catch {
      try { await navigator.clipboard.writeText(toMd(current, data, meta, range)); flag('mail') } catch { alert('複製失敗：瀏覽器未授權剪貼簿') }
    }
    try { localStorage.setItem('wp-meet-attend', attend); localStorage.setItem('wp-meet-foot', foot) } catch {}
  }
  const copyMd = async () => {
    try { await navigator.clipboard.writeText(toMd(current, data, meta, range)); flag('md') } catch { alert('複製失敗') }
  }
  const imgRefs = useRef({})
  const copyImg = async (id) => {
    try {
      const svg = imgRefs.current[id]?.querySelector('svg')
      if (!svg) throw new Error('no svg')
      const xml = new XMLSerializer().serializeToString(svg)
      const img = new Image()
      const p = new Promise((res, rej) => { img.onload = res; img.onerror = rej })
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
      await p
      const w = img.width * 2 || 1200, h = img.height * 2 || 600
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h)
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      flag('img' + id)
    } catch { alert('此瀏覽器不支援圖片複製（iOS 常見），請改用截圖') }
  }

  return createPortal(
    <div className="uf-wrap">
      <div className="uf-head">
        <FileText size={18} />
        <strong>會議記錄</strong>
        <div className="spacer" />
        <button className="rd-back" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="uf-body">
        <div className="uf-card md-ctrl">
          <div className="md-row">
            <label>日期<input type="date" value={d1} onChange={(e) => { setD1(e.target.value); if (e.target.value > d2) setD2(e.target.value) }} /></label>
            <label>至<input type="date" value={d2} min={d1} onChange={(e) => setD2(e.target.value)} /></label>
          </div>
          <div className="md-row">
            <label>場次<input type="text" value={session} placeholder="第 3 場（選填）" onChange={(e) => setSession(e.target.value)} /></label>
            <label>出席<input type="text" value={attend} placeholder="甲方窗口、乙方 PM（選填）" onChange={(e) => setAttend(e.target.value)} /></label>
          </div>
          <label className="md-foot">結尾文案<textarea rows={2} value={foot} onChange={(e) => setFoot(e.target.value)} /></label>
          <div className="md-btns">
            <button className="uf-new" onClick={copyMail}><Mail size={14} /> {copied === 'mail' ? '已複製，貼進信件內文' : '複製郵件格式'}</button>
            <button className="uf-sealbtn" onClick={copyMd}>{copied === 'md' ? '已複製' : '複製 Markdown'}</button>
          </div>
        </div>

        {data.units.length === 0 ? (
          <div className="uf-empty">這段時間沒有任何流程、需求或規格的動靜。<br />調整上方日期範圍，或先去單元裡工作再回來產記錄。</div>
        ) : (
          <div className="uf-card md-preview" dangerouslySetInnerHTML={{ __html: toHtml(current, data, meta, range) }} />
        )}

        {data.imgs.length > 0 && (
          <div className="uf-card" style={{ gap: 10 }}>
            <div className="ht-title">附圖（逐張複製貼進信件；改過版的可切舊版複製「調整前」）</div>
            {data.imgs.filter((x) => x.changed).map((x) => <FlowImg key={x.f.id} {...x} copied={copied} copyImg={copyImg} imgRefs={imgRefs} />)}
            {data.imgs.some((x) => !x.changed) && (
              <button className="ps-add" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAllImgs((v) => !v)}>
                {showAllImgs ? '收合' : `其他本期涉及的粗流 ${data.imgs.filter((x) => !x.changed).length} 張（第一次寄給客戶時全附）`}
              </button>
            )}
            {showAllImgs && data.imgs.filter((x) => !x.changed).map((x) => <FlowImg key={x.f.id} {...x} copied={copied} copyImg={copyImg} imgRefs={imgRefs} />)}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
