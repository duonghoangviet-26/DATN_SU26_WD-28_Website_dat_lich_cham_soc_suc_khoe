import { useEffect, useState } from 'react'
import { ArrowUpRight, CalendarDays, Check, ChevronRight, Clock3, Ear, MapPin, ShieldCheck, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'

import Skeleton from '@/components/common/Skeleton'
import { Reveal, StaggerContainer, StaggerItem } from '@/components/client/ClientMotion'
import HeroBanner from '@/components/client/HeroBanner'
import { newsService } from '@/services/news.service'
import { serviceService } from '@/services/service.service'
import { patientBookingService } from '@/services/patient-booking.service'
import type { NewsArticle, ServiceItem, DoctorProfile } from '@/types'
import type { PatientBookingDoctor } from '@/services/patient-booking.service'
import { getNewsImageSrcSet, getNewsImageUrl } from '@/utils/newsImage'

const benefits = [
  {
    icon: Stethoscope,
    title: 'Tập trung một chuyên khoa',
    description: 'Đội ngũ và quy trình được xây dựng riêng cho các vấn đề về tai, mũi, họng.',
  },
  {
    icon: ShieldCheck,
    title: 'Khám rõ ràng, dễ hiểu',
    description: 'Bác sĩ giải thích kết quả và hướng điều trị bằng ngôn ngữ dễ theo dõi.',
  },
  {
    icon: Clock3,
    title: 'Chủ động thời gian',
    description: 'Chọn ngày và khung giờ phù hợp. Phòng khám tự sắp xếp bác sĩ còn suất.',
  },
]

const bookingSteps = [
  { icon: CalendarDays, title: 'Chọn ngày khám', description: 'Xem khung giờ còn chỗ trong 7 ngày gần nhất.' },
  { icon: Ear, title: 'Mô tả triệu chứng', description: 'Cho chúng tôi biết điều đang khiến bạn khó chịu.' },
  { icon: Check, title: 'Đến khám đúng hẹn', description: 'Bác sĩ phù hợp sẽ được phân công theo lịch thực tế.' },
]

function ServiceMark({ index }: { index: number }) {
  const icons = [Ear, Stethoscope, ShieldCheck, Clock3]
  const Icon = icons[index % icons.length]

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition-transform duration-300 ease-out group-hover:scale-110">
      <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
    </span>
  )
}

export default function Home() {
  const [clinicServices, setClinicServices] = useState<ServiceItem[]>([])
  const [latestNews, setLatestNews] = useState<NewsArticle[]>([])
  const [doctors, setDoctors] = useState<PatientBookingDoctor[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [loadingDoctors, setLoadingDoctors] = useState(true)

  useEffect(() => {
    let ignore = false

    serviceService.getAll('related', '', 'active', 1, 100)
      .then((res) => {
        if (!ignore) setClinicServices(res.items)
      })
      .catch((error) => console.error('Không tải được dịch vụ phòng khám:', error))
      .finally(() => {
        if (!ignore) setLoadingServices(false)
      })

    newsService.getPublished({ page: 1, limit: 3 })
      .then((res) => {
        if (!ignore) setLatestNews(res.items)
      })
      .catch((error) => console.error('Không tải được cẩm nang sức khỏe:', error))

    patientBookingService.getDoctors()
      .then((res) => {
        if (!ignore) setDoctors(res)
      })
      .catch((error) => console.error('Không tải được bác sĩ:', error))
      .finally(() => {
        if (!ignore) setLoadingDoctors(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  const featuredService = clinicServices[0]
  const secondaryServices = clinicServices.slice(1, 4)

  return (
    <div className="overflow-hidden bg-[#f7faf9] text-slate-900">
      <HeroBanner />

      <StaggerContainer className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-24">
        <StaggerItem className="max-w-md">
          <p className="text-sm font-semibold text-teal-700">Một cuộc hẹn nhẹ nhàng hơn</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-4xl">
            Bạn không cần tự chọn bác sĩ.
          </h2>
          <p className="mt-5 text-base leading-7 text-slate-600">
            Bạn chỉ cần chọn ngày và khung giờ. Hệ thống sẽ tổng hợp suất khám của phòng khám và phân công bác sĩ còn lịch phù hợp.
          </p>
          <Link to="/booking" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-teal-800 transition-colors hover:text-teal-950">
            Bắt đầu đặt lịch
            <ChevronRight size={17} aria-hidden="true" />
          </Link>
        </StaggerItem>

        <div className="grid gap-3 sm:grid-cols-3">
          {bookingSteps.map((item, index) => {
            const Icon = item.icon
            return (
              <StaggerItem key={item.title}>
                <article className={`h-full relative rounded-3xl p-6 ${index === 1 ? 'bg-teal-800 text-white' : 'bg-white text-slate-900 shadow-[0_10px_35px_rgba(21,54,56,0.06)]'}`}>
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${index === 1 ? 'bg-white/15 text-white' : 'bg-teal-50 text-teal-700'}`}>
                    <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <p className={`mt-12 text-xs font-semibold ${index === 1 ? 'text-teal-100' : 'text-teal-700'}`}>0{index + 1}</p>
                  <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em]">{item.title}</h3>
                  <p className={`mt-3 text-sm leading-6 ${index === 1 ? 'text-teal-50/80' : 'text-slate-500'}`}>{item.description}</p>
                </article>
              </StaggerItem>
            )
          })}
        </div>
      </StaggerContainer>

      <section className="border-y border-slate-200/80 bg-white">
        <StaggerContainer className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-24">
          <StaggerItem className="relative overflow-hidden rounded-[2rem] bg-slate-100">
            <img
              src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&auto=format&fit=crop&q=80"
              alt="Không gian sạch sẽ, sáng thoáng của phòng khám"
              className="aspect-[4/3] h-full w-full object-cover"
              loading="lazy"
            />
            <div className="absolute bottom-5 left-5 max-w-[220px] rounded-2xl border border-white/70 bg-white/90 px-4 py-3 backdrop-blur-sm">
              <p className="text-sm font-semibold text-slate-900">Không gian khám riêng tư</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Thiết kế để người bệnh cảm thấy thoải mái ngay từ lúc bước vào.</p>
            </div>
          </StaggerItem>
          <div className="max-w-lg">
            <StaggerItem>
              <p className="text-sm font-semibold text-teal-700">Phòng khám ViteFamily</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-4xl">
                Chẩn đoán kỹ, giải thích dễ hiểu, đồng hành đến khi ổn hơn.
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-600">
                Chúng tôi tập trung vào trải nghiệm khám rõ ràng: lắng nghe triệu chứng, kiểm tra cẩn thận và thống nhất hướng chăm sóc cùng người bệnh.
              </p>
            </StaggerItem>
            <div className="mt-8 space-y-4">
              {benefits.map((benefit) => {
                const Icon = benefit.icon
                return (
                  <StaggerItem key={benefit.title} className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{benefit.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{benefit.description}</p>
                    </div>
                  </StaggerItem>
                )
              })}
            </div>
          </div>
        </StaggerContainer>
      </section>

      <StaggerContainer className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <StaggerItem className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-teal-700">Dịch vụ và triệu chứng</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-4xl">Bắt đầu từ điều bạn đang khó chịu.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">Tìm hiểu các hướng thăm khám thường gặp tại phòng khám Tai Mũi Họng.</p>
          </div>
          <Link to="/dich-vu" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950">
            Xem tất cả dịch vụ
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </StaggerItem>

        {loadingServices ? (
          <div className="mt-10 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <Skeleton className="min-h-[280px] rounded-[2rem]" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="min-h-[130px] rounded-3xl" />)}
            </div>
          </div>
        ) : clinicServices.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Dịch vụ đang được cập nhật.</div>
        ) : (
          <div className="mt-10 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            {featuredService && (
              <StaggerItem>
                <Link to={`/dich-vu/${featuredService.id}`} className="group flex h-full min-h-[300px] flex-col justify-between rounded-xl bg-brand-800 p-7 text-white shadow-sm hover:shadow-xl hover:shadow-brand-500/10 transition-all duration-300 ease-out hover:-translate-y-1 sm:p-9 border border-brand-700">
                  <div className="flex items-start justify-between gap-4">
                    <ServiceMark index={0} />
                    <ArrowUpRight className="text-brand-200 transition-transform duration-300 ease-out group-hover:translate-x-1" size={22} aria-hidden="true" />
                  </div>
                  <div className="mt-14 max-w-md">
                    <p className="text-sm font-medium text-brand-100">Dịch vụ nổi bật</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">{featuredService.ten}</h3>
                    <p className="mt-3 text-sm leading-6 text-brand-50/80">{featuredService.mo_ta_ngan || 'Khám và tư vấn chuyên khoa theo tình trạng cụ thể của bạn.'}</p>
                  </div>
                </Link>
              </StaggerItem>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {secondaryServices.map((service, index) => (
                <StaggerItem key={service.id}>
                  <Link to={`/dich-vu/${service.id}`} className="group flex h-full min-h-[142px] flex-col justify-between rounded-xl bg-gradient-to-br from-brand-50/60 to-white border border-gray-100 p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/10">
                    <div className="flex items-start justify-between gap-3">
                      <ServiceMark index={index + 1} />
                      <ChevronRight className="text-slate-300 transition-transform duration-300 ease-out group-hover:translate-x-1 group-hover:text-brand-700" size={18} aria-hidden="true" />
                    </div>
                    <h3 className="mt-7 text-sm font-semibold leading-5 text-slate-900">{service.ten}</h3>
                  </Link>
                </StaggerItem>
              ))}
            </div>
          </div>
        )}
      </StaggerContainer>

      <section className="bg-white py-16 sm:py-24">
        <StaggerContainer className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <StaggerItem>
            <h2 className="text-center text-3xl font-bold uppercase tracking-tight text-[#006039] sm:text-4xl">Đội ngũ bác sĩ giàu kinh nghiệm</h2>
          </StaggerItem>
          
          {loadingDoctors ? (
            <div className="mt-12 flex flex-wrap justify-center gap-6">
              {[1, 2, 3].map(item => <Skeleton key={item} className="aspect-[3/4] w-full max-w-[280px] rounded-xl" />)}
            </div>
          ) : doctors.length > 0 ? (
            <div className="mt-12 flex flex-wrap justify-center gap-8">
              {doctors.slice(0, 3).map(doctor => (
                <StaggerItem key={doctor.id} className="w-full max-w-[320px]">
                  <div className="h-full rounded-xl border border-transparent bg-[#eef7f5] p-4 text-center transition-transform hover:-translate-y-1 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] flex flex-col">
                    <div className="overflow-hidden rounded-xl bg-white">
                      <img 
                        src={doctor.anh_dai_dien ? (doctor.anh_dai_dien.startsWith('http') ? doctor.anh_dai_dien : `http://localhost:5000${doctor.anh_dai_dien.startsWith('/') ? '' : '/'}${doctor.anh_dai_dien}`) : '/images/robot-avatar.png'} 
                        alt={doctor.ho_ten} 
                        className="aspect-[4/5] w-full object-cover object-top" 
                        loading="lazy"
                      />
                    </div>
                    <div className="mt-5 pb-2 flex-1 flex flex-col">
                      <h3 className="text-[17px] font-bold text-[#ea580c]">{doctor.ho_ten}</h3>
                      {doctor.chuyen_khoa && <p className="mt-1 text-[13px] font-semibold text-[#ea580c]">{doctor.chuyen_khoa}</p>}
                      
                      <div className="mt-4 pt-4 border-t border-slate-100 flex-1">
                        <p className="text-[13px] leading-relaxed text-slate-500 line-clamp-4">
                          {doctor.kinh_nghiem || `Bác sĩ chuyên khoa tận tâm với ${doctor.so_nam_kinh_nghiem ? `${doctor.so_nam_kinh_nghiem} năm` : 'nhiều năm'} kinh nghiệm trong lĩnh vực khám và điều trị ${doctor.chuyen_khoa || 'Tai Mũi Họng'}.`}
                        </p>
                      </div>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </div>
          ) : null}
        </StaggerContainer>
      </section>

      <section className="border-t border-slate-200/80 bg-[#eef7f5]">
        <StaggerContainer className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <StaggerItem className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-teal-700">Cẩm nang sức khỏe</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">Thông tin hữu ích cho cả gia đình.</h2>
            </div>
            <Link to="/tin-tuc" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950">
              Xem cẩm nang
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </StaggerItem>

          {latestNews.length > 0 && (
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {latestNews.map((article) => (
                <StaggerItem key={article.id}>
                  <Link to={`/tin-tuc/${article.url_slug || article.id}`} className="block h-full group overflow-hidden rounded-xl bg-gradient-to-br from-brand-50/60 to-white border border-gray-100 shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/10">
                    <div className="aspect-[1.45/1] overflow-hidden bg-slate-100">
                      <img
                        src={getNewsImageUrl(article.image, { width: 720, height: 496 })}
                        srcSet={getNewsImageSrcSet(article.image, [
                          { width: 480, height: 331 },
                          { width: 720, height: 496 },
                          { width: 960, height: 662 },
                        ])}
                        sizes="(min-width: 768px) 33vw, calc(100vw - 32px)"
                        alt={article.title}
                        className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="p-5">
                      <p className="text-xs font-medium text-slate-400">{new Date(article.created_at).toLocaleDateString('vi-VN')}</p>
                      <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-slate-900 group-hover:text-brand-800 transition-colors">{article.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{article.excerpt}</p>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </div>
          )}
        </StaggerContainer>
      </section>

      <section className="bg-teal-900 text-white">
        <StaggerContainer className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-16">
          <StaggerItem className="max-w-2xl">
            <p className="text-sm font-medium text-teal-200">Bạn đang cần được thăm khám?</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Đặt một khung giờ phù hợp cho hôm nay.</h2>
          </StaggerItem>
          <StaggerItem>
            <Link to="/booking" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-teal-900 transition-colors hover:bg-teal-50">
              Đặt lịch khám
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </StaggerItem>
        </StaggerContainer>
      </section>

      <div className="mx-auto flex max-w-7xl flex-wrap gap-x-8 gap-y-3 px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-2"><MapPin size={14} className="text-teal-700" aria-hidden="true" /> 123 Nguyễn Trãi, Thanh Xuân, Hà Nội</span>
        <span className="inline-flex items-center gap-2"><Clock3 size={14} className="text-teal-700" aria-hidden="true" /> 08:00 - 24:00 (theo ca bác sĩ), thứ 2 đến thứ 7</span>
      </div>
    </div>
  )
}
