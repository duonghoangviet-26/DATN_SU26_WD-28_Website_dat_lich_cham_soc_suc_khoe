import { Link } from 'react-router-dom'
import { mockDoctors } from '@/mock/doctors'
import { mockServices } from '@/mock/services'
import { mockNews } from '@/mock/news'

export default function Home() {
  // Get active specialists
  const specialists = mockDoctors.filter((d) => d.trang_thai_duyet === 'approved' && d.loai === 'specialist')
  const clinicServices = mockServices.filter((s) => s.status === 'active')
  const latestNews = mockNews.slice(0, 3)

  return (
    <div className="space-y-20 pb-16">
      {/* 1. HERO BANNER */}
      <section className="relative overflow-hidden bg-slate-950 py-20 text-white rounded-3xl mx-4 sm:mx-0 min-h-[420px] flex items-center justify-center">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://thienhanhhospital.com/wp-content/uploads/2024/09/lienkhoa-Noi-soi-tai-mui-hong-1-768x480.webp"
            alt="Tai Mũi Họng Chuyên Khoa"
            className="w-full h-full object-cover opacity-25 object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-brand-950/90 via-brand-900/85 to-slate-950/80" />
        </div>
        
        <div className="relative z-10 mx-auto max-w-4xl px-6 text-center space-y-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/25 px-4 py-1 text-sm font-semibold text-brand-300 ring-1 ring-brand-500/30">
            🏥 Phòng khám chuyên khoa Tai Mũi Họng
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl leading-tight">
            Chăm sóc sức khỏe Tai Mũi Họng <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-brand-300 to-sky-200 bg-clip-text text-transparent">
              Chu đáo cho cả gia đình bạn
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-base text-slate-300 leading-relaxed">
            Đặt lịch khám trực tuyến với các bác sĩ đầu ngành, chụp nội soi ống mềm thế hệ mới không đau và nhận kết quả hồ sơ bệnh án số hóa tức thì.
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-4">
            <Link to="/booking" className="btn-primary bg-white text-brand-900 hover:bg-slate-100 px-6 py-3 text-base shadow-lg shadow-brand-950/20">
              Đặt lịch khám ngay
            </Link>
          </div>
        </div>
      </section>

      {/* 2. CLINIC INTRODUCTION */}
      <section className="mx-auto max-w-6xl px-4 grid gap-10 lg:grid-cols-2 items-center">
        <div className="space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Giới thiệu chung</span>
            <h2 className="text-2xl font-extrabold text-slate-800 sm:text-3xl leading-tight">
              Phòng Khám Tai Mũi Họng VitaFamily
            </h2>
          </div>
          <p className="text-slate-600 text-sm leading-relaxed">
            Được thành lập với sứ mệnh mang đến dịch vụ chăm sóc tai mũi họng tiêu chuẩn quốc tế, VitaFamily tự hào là đơn vị tiên phong ứng dụng công nghệ nội soi ống mềm không đau tại Hà Nội. Chúng tôi tập trung tối đa nguồn lực vào một chuyên khoa duy nhất để mang lại chất lượng chẩn đoán chính xác tuyệt đối.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
              <p className="text-2xl font-extrabold text-brand-600">100%</p>
              <p className="text-xs font-semibold text-slate-500">Nội soi bằng ống mềm</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
              <p className="text-2xl font-extrabold text-brand-600">15+ Năm</p>
              <p className="text-xs font-semibold text-slate-500">Kinh nghiệm y tế trung bình</p>
            </div>
          </div>
        </div>
        <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-video bg-slate-100 border border-slate-200">
          <img
            src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&auto=format&fit=crop&q=60"
            alt="Trang thiết bị phòng khám"
            className="h-full w-full object-cover"
          />
        </div>
      </section>

      {/* 3. FEATURED SERVICES */}
      <section className="mx-auto max-w-6xl px-4 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Dịch vụ nổi bật</span>
          <h2 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">Điều Trị Chuyên Khoa</h2>
          <p className="mx-auto max-w-md text-sm text-slate-500">
            Các kỹ thuật lâm sàng thế mạnh hỗ trợ điều trị nhanh chóng và triệt để.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {clinicServices.map((s) => (
            <div key={s.id} className="group relative flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-brand-100">
              <div className="space-y-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 group-hover:bg-brand-500 group-hover:text-white transition-colors duration-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-bold text-slate-800 text-base">{s.ten}</h3>
                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{s.mo_ta_ngan}</p>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">
                  {s.gia === 0 ? 'Miễn phí' : `${s.gia.toLocaleString('vi-VN')} đ`}
                </span>
                <Link to={`/dich-vu/${s.id}`} className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1">
                  Chi tiết
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. DOCTORS SECTION */}
      <section className="mx-auto max-w-6xl px-4 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Đội ngũ của chúng tôi</span>
          <h2 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">Bác Sĩ Tai Mũi Họng Đầu Ngành</h2>
          <p className="mx-auto max-w-md text-sm text-slate-500">
            Các phó giáo sư, thạc sĩ y khoa giàu tâm huyết và trực tiếp thực hiện thăm khám.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {specialists.map((d) => (
            <div key={d.id} className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all duration-300">
              <div>
                {/* Doctor Avatar */}
                <div className="aspect-square w-full bg-slate-100 relative overflow-hidden">
                  {d.anh_dai_dien ? (
                    <img
                      src={d.anh_dai_dien}
                      alt={d.ho_ten}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center bg-brand-50 text-brand-600 font-extrabold text-3xl">
                      {d.ho_ten.split(' ').pop()?.charAt(0)}
                    </div>
                  )}
                  {/* Rating Badge */}
                  <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-md px-2 py-0.5 text-xs font-bold text-slate-800 shadow-sm">
                    ⭐ {d.diem_danh_gia.toFixed(1)}
                  </span>
                </div>

                {/* Doctor Details */}
                <div className="p-4 space-y-2">
                  <h3 className="font-bold text-slate-800 text-sm group-hover:text-brand-600 transition-colors">{d.ho_ten}</h3>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{d.bang_cap.split('—')[0]}</p>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{d.kinh_nghiem}</p>
                </div>
              </div>

              {/* Booking Actions */}
              <div className="p-4 pt-3 border-t border-slate-50 flex items-center justify-center mt-2">
                <Link
                  to={`/booking?doctor_id=${d.id}`}
                  className="btn-primary w-full text-center py-2 text-xs font-bold shadow-sm shadow-brand-100"
                >
                  Đặt lịch khám
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. WHY CHOOSE US */}
      <section className="bg-slate-100/50 py-16 rounded-3xl mx-4 sm:mx-0">
        <div className="mx-auto max-w-5xl px-6 space-y-12">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Vì sao chọn chúng tôi</span>
            <h2 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">Cam Kết Chất Lượng Vượt Trội</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-md">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-800 text-sm">Chẩn Đoán Chuẩn Xác</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Đội ngũ phó giáo sư, thạc sĩ trực tiếp nội soi và điều trị dứt điểm.</p>
            </div>
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-md">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-800 text-sm">Nội Soi Ống Mềm Không Đau</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Thiết bị siêu nhỏ, không gây kích thích nhợn ói, hoàn toàn thoải mái cho bé.</p>
            </div>
            <div className="text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-md">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-800 text-sm">Khám Đúng Giờ Hẹn</h3>
              <p className="text-xs text-slate-500 leading-relaxed">Đặt khung giờ trước trực tuyến giúp tiết kiệm 100% thời gian chờ đợi xếp hàng.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. LATEST NEWS */}
      <section className="mx-auto max-w-6xl px-4 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600">Cẩm nang y khoa</span>
            <h2 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">Tin Tức & Cảnh Báo Sức Khỏe</h2>
          </div>
          <Link to="/tin-tuc" className="text-sm font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 shrink-0">
            Xem tất cả bài viết
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {latestNews.map((n) => (
            <Link key={n.id} to={`/tin-tuc/${n.slug}`} className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-all duration-300">
              <div>
                <div className="aspect-video w-full bg-slate-100 overflow-hidden">
                  <img
                    src={n.anh_dai_dien}
                    alt={n.tieu_de}
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold uppercase">
                    <span>{n.nguoi_viet}</span>
                    <span>•</span>
                    <span>{new Date(n.ngay_tao).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm group-hover:text-brand-600 transition-colors line-clamp-2 leading-snug">
                    {n.tieu_de}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                    {n.noi_dung_ngan}
                  </p>
                </div>
              </div>
              <div className="p-5 pt-0 text-xs font-semibold text-brand-600 flex items-center gap-1 group-hover:text-brand-800">
                Đọc bài viết
                <svg className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}

