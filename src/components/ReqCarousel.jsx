import { useMemo, useRef, useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { EffectCoverflow, Mousewheel, FreeMode } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-coverflow'
import 'swiper/css/free-mode'
import { useStore } from '../store/StoreContext.jsx'
import { categoryMeta } from '../lib/categories.js'
import MobileReqCard from './MobileReqCard.jsx'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

// 轉盤模式：coverflow 快速翻滾找卡 + 即時搜尋過濾；中央卡在下方停駐區直接編輯
export default function ReqCarousel() {
  const { current } = useStore()
  const reqs = current.requirements || []
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [activeId, setActiveId] = useState(reqs[0]?.id || null)
  const [idx, setIdx] = useState(0)
  const swRef = useRef(null)

  // 分類 tab：只列實際存在的分類 + 數量
  const cats = useMemo(() => {
    const m = new Map()
    for (const r of reqs) m.set(r.category, (m.get(r.category) || 0) + 1)
    return [...m.entries()]
  }, [reqs])

  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    return reqs.filter((r) => {
      if (cat !== 'all' && r.category !== cat) return false
      if (!k) return true
      return [r.name, r.note, r.screen, r.description].some((t) => String(t || '').toLowerCase().includes(k))
    })
  }, [reqs, q, cat])
  const active = list.find((r) => r.id === activeId) || list[0]

  return (
    <div className="rw-wrap">
      <div className="rw-search">
        <Search size={16} />
        <input value={q} placeholder="搜尋需求…（或直接撥轉盤）" onChange={(e) => setQ(e.target.value)} />
        <span className="muted" style={{ fontSize: 12 }}>{list.length} 張</span>
      </div>
      <div className="rw-tabs">
        <button className={'rw-tab' + (cat === 'all' ? ' on' : '')} onClick={() => { setCat('all'); setIdx(0) }}>全部 {reqs.length}</button>
        {cats.map(([key, n]) => {
          const m = categoryMeta(key)
          return (
            <button key={key} className={'rw-tab' + (cat === key ? ' on' : '')} onClick={() => { setCat(key); setIdx(0) }}>
              <i style={{ background: m.color }} />{m.label} {n}
            </button>
          )
        })}
      </div>
      {list.length === 0 ? (
        <div className="empty"><div className="muted">這個分類沒有符合的卡</div></div>
      ) : (
        <>
          <Swiper
            key={q + '|' + cat}
            className="rw-swiper"
            modules={[EffectCoverflow, Mousewheel, FreeMode]}
            effect="coverflow"
            grabCursor
            centeredSlides
            slidesPerView="auto"
            coverflowEffect={{ rotate: 34, stretch: 0, depth: 240, modifier: 1, slideShadows: false }}
            speed={380}
            freeMode={{ enabled: true, sticky: true, momentum: true, momentumRatio: 1.7, momentumVelocityRatio: 1.5, momentumBounce: false }}
            touchRatio={1.35}
            touchAngle={60}
            longSwipesRatio={0.12}
            longSwipesMs={80}
            mousewheel={{ forceToAxis: true, sensitivity: 1.4 }}
            onSwiper={(sw) => { swRef.current = sw }}
            onSlideChange={(sw) => { setIdx(sw.activeIndex); const r = list[sw.activeIndex]; if (r) { setActiveId(r.id); navigator.vibrate?.(8) } }}
          >
            {list.map((r) => {
              const cat = categoryMeta(r.category)
              return (
                <SwiperSlide key={r.id} className="rw-slide">
                  <div className="rw-card">
                    <div className="rw-name">{r.name || '（未命名）'}</div>
                    <div className="rw-meta">
                      <span className="rw-cat" style={{ color: cat.color }}>● {cat.label}</span>
                      <span className={'tg-pchip p' + r.priority}>{r.priority}</span>
                      {(r.versions || []).length > 0 && !r.pending && <span className="st-badge st-green">v{r.versions.length} ✓</span>}
                      {r.pending && <span className="st-badge st-orange">異動中</span>}
                    </div>
                  </div>
                </SwiperSlide>
              )
            })}
          </Swiper>
          <div className="rw-nav">
            <button className="rw-arrow" disabled={idx <= 0} onClick={() => swRef.current?.slidePrev()} aria-label="上一張"><ChevronLeft size={22} /></button>
            <span className="rw-count">{Math.min(idx + 1, list.length)} / {list.length}</span>
            <button className="rw-arrow" disabled={idx >= list.length - 1} onClick={() => swRef.current?.slideNext()} aria-label="下一張"><ChevronRight size={22} /></button>
          </div>
          {active && (
            <div className="rw-dock">
              <MobileReqCard key={active.id} req={active} index={reqs.findIndex((r) => r.id === active.id)} total={reqs.length} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
