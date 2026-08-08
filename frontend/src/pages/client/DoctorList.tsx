import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Breadcrumb from '@/components/common/Breadcrumb'
import Empty from '@/components/common/Empty'
import Skeleton from '@/components/common/Skeleton'
import { patientBookingService, type PatientBookingDoctor } from '@/services/patient-booking.service'
import { resolveMediaUrl } from '@/utils/media'

export default function DoctorList() {
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [doctors, setDoctors] = useState<PatientBookingDoctor[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const ITEMS_PER_SLIDE = 3

  useEffect(() => {
    let ignore = false
    setLoading(true)
    patientBookingService.getDoctors()
      .then((data) => {
        if (!ignore) {
          setDoctors(data)
        }
      })
      .catch((err) => {
        console.error('Không tải được danh sách bác sĩ:', err)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  // Reset slider index when search changes
  useEffect(() => {
    setCurrentIndex(0)
  }, [searchTerm])

  // Filtering logic: search only
  const filteredDoctors = doctors.filter((d) =>
    d.ho_ten.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalSlides = Math.ceil(filteredDoctors.length / ITEMS_PER_SLIDE)

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : Math.max(0, totalSlides - 1)))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < totalSlides - 1 ? prev + 1 : 0))
  }

  const visibleDoctors = filteredDoctors.slice(
    currentIndex * ITEMS_PER_SLIDE,
    (currentIndex + 1) * ITEMS_PER_SLIDE
  )

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 space-y-8">
      <Breadcrumb items={[{ label: 'Bác sĩ Tai Mũi Họng' }]} />

      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">Đội Ngũ Bác Sĩ Chuyên Khoa</h1>
        <p className="text-sm text-slate-500">
          Các phó giáo sư, tiến sĩ và thạc sĩ y học chuyên khoa Tai Mũi Họng trực tiếp chẩn đoán và điều trị tại ViteFamily.
        </p>
      </div>

      {/* SEARCH BAR ONLY */}
      <div className="max-w-xl mx-auto">
        <div className="relative">
          <label htmlFor="doctor-search" className="sr-only">Tìm bác sĩ theo tên</label>
          <span className="absolute inset-y-0 left-3.5 flex items-center text-slate-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            id="doctor-search"
            type="text"
            placeholder="Tìm theo tên bác sĩ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 outline-none shadow-sm transition"
          />
        </div>
      </div>

      {/* DOCTORS SLIDESHOW / CAROUSEL */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 space-y-4 shadow-sm">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-8 max-w-xl mx-auto">
          <Empty title="Không tìm thấy bác sĩ nào" description="Bạn vui lòng thay đổi từ khóa tìm kiếm." icon="search" />
        </div>
      ) : (
        <div className="relative max-w-5xl mx-auto px-4 sm:px-12">
          {/* Navigation Arrow Left */}
          {totalSlides > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute -left-2 sm:left-0 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition-all hover:bg-brand-50 hover:text-brand-600 hover:scale-105 active:scale-95"
              aria-label="Bác sĩ trước"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Slide Content with Animation */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex + searchTerm}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 justify-center items-stretch"
            >
              {visibleDoctors.map((d) => (
                <div
                  key={d.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <div>
                    <div className="aspect-[4/3] w-full bg-slate-100 relative overflow-hidden">
                      {resolveMediaUrl(d.anh_dai_dien) ? (
                        <img
                          src={resolveMediaUrl(d.anh_dai_dien) || undefined}
                          alt={d.ho_ten}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-brand-50 text-3xl font-extrabold text-brand-600">
                          {d.ho_ten.split(' ').pop()?.charAt(0)}
                        </div>
                      )}
                    </div>

                    <div className="p-5 space-y-2.5 text-left">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-slate-800 text-base group-hover:text-brand-600 transition-colors line-clamp-1">
                          {d.ho_ten}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-amber-600 font-bold shrink-0">
                          <span>⭐ {d.diem_danh_gia ? Number(d.diem_danh_gia).toFixed(1) : '5.0'}</span>
                          <span className="text-[10px] text-slate-400 font-normal">({d.tong_danh_gia || 0})</span>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
                        {d.bang_cap?.split('chuyên ngành')[0] || d.bang_cap || 'Bác sĩ chuyên khoa'}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 pt-3 border-t border-slate-100 mt-auto">
                    <Link
                      to={`/bac-si/${d.id}`}
                      className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 transition-all hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200"
                    >
                      Xem chi tiết
                    </Link>
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Arrow Right */}
          {totalSlides > 1 && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute -right-2 sm:right-0 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md transition-all hover:bg-brand-50 hover:text-brand-600 hover:scale-105 active:scale-95"
              aria-label="Bác sĩ tiếp theo"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Slide Indicator Dots */}
          {totalSlides > 1 && (
            <div className="flex justify-center items-center gap-2 pt-8">
              {Array.from({ length: totalSlides }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    currentIndex === idx ? 'w-8 bg-brand-600' : 'w-2.5 bg-slate-200 hover:bg-slate-300'
                  }`}
                  aria-label={`Trang slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
