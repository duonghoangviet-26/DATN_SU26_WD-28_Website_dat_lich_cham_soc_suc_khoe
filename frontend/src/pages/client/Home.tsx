import { useEffect, useState } from 'react'
import { ArrowUpRight, CalendarDays, Check, ChevronRight, Clock3, Ear, MapPin, Phone, ShieldCheck, Stethoscope } from 'lucide-react'
import { Link } from 'react-router-dom'

import Skeleton from '@/components/common/Skeleton'
import { newsService } from '@/services/news.service'
import { serviceService } from '@/services/service.service'
import type { NewsArticle, ServiceItem } from '@/types'

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
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
      <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
    </span>
  )
}

export default function Home() {
  const [clinicServices, setClinicServices] = useState<ServiceItem[]>([])
  const [latestNews, setLatestNews] = useState<NewsArticle[]>([])
  const [loadingServices, setLoadingServices] = useState(true)

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

    return () => {
      ignore = true
    }
  }, [])

  const featuredService = clinicServices[0]
  const secondaryServices = clinicServices.slice(1, 4)

  return (
    <div className="overflow-hidden bg-[#f7faf9] text-slate-900">
      <section className="relative border-b border-slate-200/80 bg-[#eef7f5]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16 lg:px-8 lg:pb-20 lg:pt-16">
          <div className="relative z-10 max-w-xl animate-rise-in">
            <p className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-800">
              <span className="h-2 w-2 rounded-full bg-teal-600" aria-hidden="true" />
              Phòng khám chuyên khoa Tai Mũi Họng
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[4.25rem]">
              Chăm sóc Tai Mũi Họng, rõ ràng từ lần khám đầu tiên.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
              Một địa chỉ chuyên khoa dành cho cả gia đình, với quy trình khám dễ hiểu và lịch hẹn chủ động.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/booking" className="btn-primary rounded-full px-6 py-3.5 text-sm font-semibold shadow-[0_12px_28px_rgba(15,118,110,0.2)]">
                Đặt lịch khám
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              <a href="tel:0365747888" className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-white hover:text-teal-800">
                <Phone size={16} strokeWidth={1.8} aria-hidden="true" />
                0365 747 888
              </a>
            </div>

            <div className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-teal-900/10 pt-5 text-sm">
              <div>
                <p className="font-semibold text-slate-900">Tai Mũi Họng</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Chuyên khoa duy nhất</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Cho cả nhà</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Người lớn và trẻ em</p>
              </div>
              <div>
                <p className="font-semibold text-slate-900">Đặt lịch online</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Chọn giờ trước khi đến</p>
              </div>
            </div>
          </div>

          <div className="relative min-h-[360px] lg:min-h-[540px]">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border-[36px] border-white/60" aria-hidden="true" />
            <div className="relative h-full min-h-[360px] overflow-hidden rounded-[2rem] bg-slate-200 shadow-[0_24px_70px_rgba(15,63,65,0.18)] lg:min-h-[540px]">
              <img
                src="/images/ent-clinic-hero.png"
                alt="Bác sĩ thăm khám tai cho người bệnh tại phòng khám"
                className="h-full w-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent" aria-hidden="true" />
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-4 sm:bottom-7 sm:left-7 sm:right-7">
                <div className="rounded-2xl border border-white/50 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-sm">
                  <p className="text-xs font-semibold text-teal-800">Lịch hẹn chủ động</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">Phòng khám tự sắp xếp bác sĩ phù hợp</p>
                </div>
                <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white shadow-lg sm:flex" aria-hidden="true">
                  <Ear size={22} strokeWidth={1.7} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8 lg:py-24">
        <div className="max-w-md">
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
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {bookingSteps.map((item, index) => {
            const Icon = item.icon
            return (
              <article key={item.title} className={`relative rounded-3xl p-6 ${index === 1 ? 'bg-teal-800 text-white' : 'bg-white text-slate-900 shadow-[0_10px_35px_rgba(21,54,56,0.06)]'}`}>
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${index === 1 ? 'bg-white/15 text-white' : 'bg-teal-50 text-teal-700'}`}>
                  <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <p className={`mt-12 text-xs font-semibold ${index === 1 ? 'text-teal-100' : 'text-teal-700'}`}>0{index + 1}</p>
                <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em]">{item.title}</h3>
                <p className={`mt-3 text-sm leading-6 ${index === 1 ? 'text-teal-50/80' : 'text-slate-500'}`}>{item.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="border-y border-slate-200/80 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-24">
          <div className="relative overflow-hidden rounded-[2rem] bg-slate-100">
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
          </div>
          <div className="max-w-lg">
            <p className="text-sm font-semibold text-teal-700">Phòng khám VitaFamily</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-4xl">
              Chẩn đoán kỹ, giải thích dễ hiểu, đồng hành đến khi ổn hơn.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Chúng tôi tập trung vào trải nghiệm khám rõ ràng: lắng nghe triệu chứng, kiểm tra cẩn thận và thống nhất hướng chăm sóc cùng người bệnh.
            </p>
            <div className="mt-8 space-y-4">
              {benefits.map((benefit) => {
                const Icon = benefit.icon
                return (
                  <div key={benefit.title} className="flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                      <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{benefit.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{benefit.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-teal-700">Dịch vụ và triệu chứng</p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950 sm:text-4xl">Bắt đầu từ điều bạn đang khó chịu.</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">Tìm hiểu các hướng thăm khám thường gặp tại phòng khám Tai Mũi Họng.</p>
          </div>
          <Link to="/dich-vu" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950">
            Xem tất cả dịch vụ
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>

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
              <Link to={`/dich-vu/${featuredService.id}`} className="group flex min-h-[300px] flex-col justify-between rounded-[2rem] bg-teal-800 p-7 text-white transition-transform duration-300 hover:-translate-y-1 sm:p-9">
                <div className="flex items-start justify-between gap-4">
                  <ServiceMark index={0} />
                  <ArrowUpRight className="text-teal-200 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" size={22} aria-hidden="true" />
                </div>
                <div className="mt-14 max-w-md">
                  <p className="text-sm font-medium text-teal-100">Dịch vụ nổi bật</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">{featuredService.ten}</h3>
                  <p className="mt-3 text-sm leading-6 text-teal-50/80">{featuredService.mo_ta_ngan || 'Khám và tư vấn chuyên khoa theo tình trạng cụ thể của bạn.'}</p>
                </div>
              </Link>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {secondaryServices.map((service, index) => (
                <Link key={service.id} to={`/dich-vu/${service.id}`} className="group flex min-h-[142px] flex-col justify-between rounded-3xl bg-white p-5 shadow-[0_10px_35px_rgba(21,54,56,0.06)] transition-transform duration-300 hover:-translate-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <ServiceMark index={index + 1} />
                    <ChevronRight className="text-slate-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-teal-700" size={18} aria-hidden="true" />
                  </div>
                  <h3 className="mt-7 text-sm font-semibold leading-5 text-slate-900">{service.ten}</h3>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="border-t border-slate-200/80 bg-[#eef7f5]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-teal-700">Cẩm nang sức khỏe</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-4xl">Thông tin hữu ích cho cả gia đình.</h2>
            </div>
            <Link to="/tin-tuc" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950">
              Xem cẩm nang
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
          </div>

          {latestNews.length > 0 && (
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {latestNews.map((article) => (
                <Link key={article.id} to={`/tin-tuc/${article.url_slug || article.id}`} className="group overflow-hidden rounded-3xl bg-white shadow-[0_10px_35px_rgba(21,54,56,0.05)] transition-transform duration-300 hover:-translate-y-1">
                  <div className="aspect-[1.45/1] overflow-hidden bg-slate-100">
                    <img src={article.image} alt={article.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-medium text-slate-400">{new Date(article.created_at).toLocaleDateString('vi-VN')}</p>
                    <h3 className="mt-3 line-clamp-2 text-base font-semibold leading-6 text-slate-900 group-hover:text-teal-800">{article.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{article.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-teal-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-16">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-teal-200">Bạn đang cần được thăm khám?</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Đặt một khung giờ phù hợp cho hôm nay.</h2>
          </div>
          <Link to="/booking" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-teal-900 transition-colors hover:bg-teal-50">
            Đặt lịch khám
            <ArrowUpRight size={17} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl flex-wrap gap-x-8 gap-y-3 px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-2"><MapPin size={14} className="text-teal-700" aria-hidden="true" /> 123 Nguyễn Trãi, Thanh Xuân, Hà Nội</span>
        <span className="inline-flex items-center gap-2"><Clock3 size={14} className="text-teal-700" aria-hidden="true" /> 08:00 - 17:30, thứ 2 đến thứ 7</span>
      </div>
    </div>
  )
}
