import { useMemo, useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { EffectCoverflow, Mousewheel } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/effect-coverflow'
import { useStore } from '../store/StoreContext.jsx'
import { categoryMeta } from '../lib/categories.js'
import MobileReqCard from './MobileReqCard.jsx'
import { Search } from 'lucide-react'

// 轉盤模式：coverflow 快速翻滾找卡 + 即時搜尋過濾；中央卡在下方停駐區直接編輯
export default function ReqCarousel() {
  const { current } = useStore()
  const reqs = current.requirements || []
  const [q, setQ] = useState('')
  const [activeId, setActiveId] = useState(reqs[0]?.id || null)

  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    if (!k) return reqs
    return reqs.filter((r) => [r.name, r.note, r.screen, r.description].some((t) => String(t || '').toLowerCase().includes(k)))
  }, [reqs, q])
  const active = list.find((r) => r.id === activeId) || list[0]

  return (
    <div className="rw-wrap">
      <div className="rw-search">
        <Search size={16} />
        <input value={q} placeholder="搜尋需求…（或直接撥轉盤）" onChange={(e) => setQ(e.target.value)} />
        <span className="muted" style={{ fontSize: 12 }}>{list.length} 張</span>
      </div>
      {list.length === 0 ? (
        <div className="empty"><div className="muted">沒有符合「{q}」的卡</div></div>
      ) : (
        <>
          <Swiper
            key={q}
            className="rw-swiper"
            modules={[EffectCoverflow, Mousewheel]}
            effect="coverflow"
            grabCursor
            centeredSlides
            slidesPerView="auto"
            coverflowEffect={{ rotate: 34, stretch: 0, depth: 240, modifier: 1, slideShadows: false }}
            speed={380}
            mousewheel={{ forceToAxis: true }}
            onSlideChange={(sw) => { const r = list[sw.activeIndex]; if (r) { setActiveId(r.id); navigator.vibrate?.(8) } }}
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
