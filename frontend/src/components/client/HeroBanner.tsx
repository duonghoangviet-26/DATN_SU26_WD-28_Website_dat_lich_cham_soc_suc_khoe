import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, ArrowUpRight, Pause, Play } from 'lucide-react'
import { Link } from 'react-router-dom'

const AUTOPLAY_DELAY = 5200

const heroSlides = [
  {
    tag: 'Phòng khám chuyên khoa Tai Mũi Họng',
    headline: 'Chăm sóc đúng chuyên khoa, an tâm từ lần khám đầu tiên.',
    subheadline: 'Thăm khám kỹ lưỡng cho cả người lớn và trẻ em, với lịch hẹn chủ động và hướng điều trị được giải thích rõ ràng.',
    image: '/images/ent-clinic-hero.jpg',
    imageAlt: 'Bác sĩ thăm khám tai cho người bệnh tại phòng khám VitaFamily',
  },
  {
    tag: 'Không gian khám riêng tư, chu đáo',
    headline: 'Một buổi khám nhẹ nhàng bắt đầu từ sự thấu hiểu.',
    subheadline: 'Không gian sạch, sáng và quy trình tiếp đón gọn gàng giúp bạn an tâm chia sẻ mọi triệu chứng Tai Mũi Họng.',
    image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1800&auto=format&fit=crop&q=88',
    imageAlt: 'Không gian sạch sáng tại phòng khám chuyên khoa',
  },
  {
    tag: 'Đồng hành cùng sức khỏe cả gia đình',
    headline: 'Hiểu đúng triệu chứng, chăm sóc đúng hướng.',
    subheadline: 'Từ những dấu hiệu nhỏ ở tai, mũi, họng đến kế hoạch theo dõi rõ ràng sau buổi khám, VitaFamily luôn đồng hành cùng bạn.',
    image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1800&auto=format&fit=crop&q=88',
    imageAlt: 'Bác sĩ tư vấn và chăm sóc người bệnh',
  },
]

export default function HeroBanner() {
  const [activeSlide, setActiveSlide] = useState(0)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [isPaused, setIsPaused] = useState(false)
  const intervalRef = useRef<number | null>(null)
  const activeHeroSlide = heroSlides[activeSlide]

  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    
    if (isLeftSwipe) {
      moveToSlide(activeSlide + 1, 1)
    } else if (isRightSwipe) {
      moveToSlide(activeSlide - 1, -1)
    }
  }

  // Keep one interval alive at a time so manual navigation cannot create competing timers.
  const clearAutoplay = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const advanceSlide = useCallback(() => {
    setDirection(1)
    setActiveSlide((current) => (current + 1) % heroSlides.length)
  }, [])

  const startAutoplay = useCallback(() => {
    clearAutoplay()
    if (isPaused) return

    intervalRef.current = window.setInterval(advanceSlide, AUTOPLAY_DELAY)
  }, [advanceSlide, clearAutoplay, isPaused])

  useEffect(() => {
    startAutoplay()
    return clearAutoplay
  }, [clearAutoplay, startAutoplay])

  function moveToSlide(index: number, nextDirection: 1 | -1) {
    setDirection(nextDirection)
    setActiveSlide((index + heroSlides.length) % heroSlides.length)
    // A manual action always receives a fresh 5.2-second viewing window.
    startAutoplay()
  }

  function selectSlide(index: number) {
    const nextDirection = index >= activeSlide ? 1 : -1
    moveToSlide(index, nextDirection)
  }

  const imageOffset = 80
  const imageVariants = {
    enter: (slideDirection: 1 | -1) => ({
      x: slideDirection === 1 ? imageOffset : -imageOffset,
      opacity: 0.35,
      scale: 1.04,
    }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (slideDirection: 1 | -1) => ({
      x: slideDirection === 1 ? -imageOffset : imageOffset,
      opacity: 0.35,
      scale: 1.02,
    }),
  }

  return (
    <section
      className="relative h-[calc(100svh-6.5rem)] min-h-[460px] max-h-[680px] overflow-hidden bg-slate-950 text-white"
      role="region"
      aria-roledescription="carousel"
      aria-label="Giới thiệu phòng khám VitaFamily"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence mode="sync" custom={direction} initial={false}>
        <motion.img
          key={activeHeroSlide.image}
          src={activeHeroSlide.image}
          alt={activeHeroSlide.imageAlt}
          className="absolute inset-0 h-full w-full object-cover object-center"
          custom={direction}
          variants={imageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            duration: 0.65,
            ease: [0.4, 0, 0.2, 1],
          }}
          loading={activeSlide === 0 ? 'eager' : 'lazy'}
          {...({ fetchpriority: activeSlide === 0 ? 'high' : 'auto' } as any)}
          decoding="async"
        />
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/65 to-slate-950/10" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-slate-950/20" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex h-full max-w-7xl items-center px-14 py-8 sm:px-20 sm:py-12 lg:px-24">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeSlide}
            className="max-w-4xl pb-14 sm:pb-10"
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{
              duration: 0.5,
              delay: 0.12,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <p className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/30 bg-slate-950/30 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm sm:gap-2.5 sm:px-4 sm:py-2 sm:text-sm">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-teal-300 motion-reduce:animate-none" aria-hidden="true" />
              <span className="truncate">{activeHeroSlide.tag}</span>
            </p>

            <h1 className="mt-4 max-w-4xl text-balance text-[clamp(2rem,4vw,4rem)] font-black leading-[1.02] tracking-[-0.035em] text-white drop-shadow-xl sm:mt-5 sm:leading-[0.98]">
              {activeHeroSlide.headline}
            </h1>
            <p className="mt-4 line-clamp-2 max-w-2xl text-pretty text-sm font-medium leading-6 text-white/90 drop-shadow-lg sm:mt-5 sm:line-clamp-none sm:text-lg sm:leading-8">
              {activeHeroSlide.subheadline}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3 sm:mt-7">
              <Link
                to="/booking"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-500 px-6 py-3.5 text-sm font-bold text-white shadow-[0_6px_8px_rgba(0,0,0,0.2)] transition-colors duration-200 hover:bg-teal-400 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Đặt lịch khám
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <a
                href="tel:0365747888"
                className="hidden items-center justify-center rounded-full border border-white/45 bg-slate-950/25 px-6 py-3.5 text-sm font-bold text-white backdrop-blur-sm transition-colors duration-200 hover:bg-white hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-white sm:inline-flex"
              >
                Gọi 0365 747 888
              </a>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <button
        type="button"
        onClick={() => moveToSlide(activeSlide - 1, -1)}
        className="hidden sm:inline-flex absolute left-6 top-1/2 z-20 h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-950 shadow-md transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-teal-300"
        aria-label="Xem nội dung trước"
      >
        <ArrowLeft size={20} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => moveToSlide(activeSlide + 1, 1)}
        className="hidden sm:inline-flex absolute right-6 top-1/2 z-20 h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-950 shadow-md transition-transform duration-200 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-teal-300"
        aria-label="Xem nội dung tiếp theo"
      >
        <ArrowRight size={20} aria-hidden="true" />
      </button>

      <div className="absolute bottom-5 left-14 right-14 z-20 flex items-center justify-between gap-5 sm:bottom-7 sm:left-20 sm:right-20 lg:left-24 lg:right-24">
        <div className="flex items-center gap-2" role="tablist" aria-label="Chọn nội dung banner">
          {heroSlides.map((slide, index) => {
            const isActive = index === activeSlide
            return (
              <button
                key={slide.image}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Xem slide ${index + 1}`}
                onClick={() => selectSlide(index)}
                className="group flex h-11 items-center justify-center rounded-full px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${isActive ? 'w-10 bg-teal-300' : 'w-5 bg-white/45 group-hover:bg-white/75'}`} aria-hidden="true" />
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3 text-sm font-bold tabular-nums text-white drop-shadow-md">
          <button
            type="button"
            onClick={() => setIsPaused((current) => !current)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-slate-950/25 text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-default disabled:opacity-70"
            aria-label={isPaused ? 'Tiếp tục tự động chuyển slide' : 'Tạm dừng tự động chuyển slide'}
            title={isPaused ? 'Tiếp tục' : 'Tạm dừng'}
          >
            {isPaused ? <Play size={15} fill="currentColor" aria-hidden="true" /> : <Pause size={15} fill="currentColor" aria-hidden="true" />}
          </button>
          <span>{String(activeSlide + 1).padStart(2, '0')}</span>
          <span className="text-white/55">/</span>
          <span className="text-white/75">{String(heroSlides.length).padStart(2, '0')}</span>
        </div>
      </div>
    </section>
  )
}
