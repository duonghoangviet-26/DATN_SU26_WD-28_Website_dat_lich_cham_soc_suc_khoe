import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function ClientLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function handleLogout() {
    logout()
    setMobileMenuOpen(false)
    navigate('/login')
  }

  const activeClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-semibold transition-colors duration-200 ${
      isActive ? 'text-brand-600 border-b-2 border-brand-600 pb-1' : 'text-slate-600 hover:text-brand-500'
    }`

  const mobileActiveClass = ({ isActive }: { isActive: boolean }) =>
    `block px-4 py-2.5 rounded-lg text-base font-medium transition-colors ${
      isActive ? 'bg-brand-50 text-brand-600 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* 1. TOP UTILITY BAR (Hospital-style) */}
      <div className="hidden bg-brand-900 text-xs text-brand-100 sm:block">
        <div className="mx-auto flex h-10 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              123 Nguyễn Trãi, Thanh Xuân, Hà Nội
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Giờ làm việc: 08:00 - 17:30 (Thứ 2 - Thứ 7)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-semibold text-white">
              <svg className="h-4 w-4 text-brand-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Hotline: 1900 6060
            </span>
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER & NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 py-3">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 shadow-md shadow-brand-100">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div>
              <span className="block text-base font-extrabold leading-none text-slate-800 tracking-tight sm:text-lg">VITAFAMILY</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tai Mũi Họng Chuyên Khoa</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6">
            <NavLink to="/" className={activeClass}>Trang chủ</NavLink>
            <NavLink to="/gioi-thieu" className={activeClass}>Giới thiệu</NavLink>
            <NavLink to="/bac-si" className={activeClass}>Bác sĩ</NavLink>
            <NavLink to="/dich-vu" className={activeClass}>Dịch vụ</NavLink>
            <NavLink to="/tin-tuc" className={activeClass}>Tin tức</NavLink>
            <NavLink to="/lien-he" className={activeClass}>Liên hệ</NavLink>
          </nav>

          {/* User Auth Controls & Booking Button */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <>
                <Link to="/profile" className="flex items-center gap-2 hover:opacity-80">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
                    {user.ho_ten.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-700">{user.ho_ten}</span>
                </Link>
                {user.role === 'doctor' && (
                  <Link to="/doctor" className="btn-secondary py-1.5 text-xs">
                    Trang bác sĩ
                  </Link>
                )}
                <button onClick={handleLogout} className="btn-ghost py-1.5 text-xs text-slate-500 hover:text-red-500">
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost px-3 py-1.5 text-sm font-medium">
                  Đăng nhập
                </Link>
                <Link to="/register" className="btn-secondary px-3 py-1.5 text-sm font-medium">
                  Đăng ký
                </Link>
              </>
            )}
            <Link to="/booking" className="btn-primary px-4 py-2 text-sm font-semibold shadow-md shadow-brand-150">
              Đặt lịch ngay
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* 3. MOBILE MENU DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-64 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="font-bold text-slate-800">Menu chính</span>
                <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Mobile Navigation Links */}
              <nav className="flex flex-col gap-2">
                <NavLink to="/" onClick={() => setMobileMenuOpen(false)} className={mobileActiveClass}>Trang chủ</NavLink>
                <NavLink to="/gioi-thieu" onClick={() => setMobileMenuOpen(false)} className={mobileActiveClass}>Giới thiệu</NavLink>
                <NavLink to="/bac-si" onClick={() => setMobileMenuOpen(false)} className={mobileActiveClass}>Bác sĩ</NavLink>
                <NavLink to="/dich-vu" onClick={() => setMobileMenuOpen(false)} className={mobileActiveClass}>Dịch vụ</NavLink>
                <NavLink to="/tin-tuc" onClick={() => setMobileMenuOpen(false)} className={mobileActiveClass}>Tin tức</NavLink>
                <NavLink to="/lien-he" onClick={() => setMobileMenuOpen(false)} className={mobileActiveClass}>Liên hệ</NavLink>
              </nav>

              <div className="border-t border-slate-100 pt-4">
                {user ? (
                  <div className="space-y-3">
                    <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 px-4 py-2">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
                        {user.ho_ten.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-slate-800 leading-tight">{user.ho_ten}</p>
                        <p className="text-[10px] text-slate-400">Xem hồ sơ</p>
                      </div>
                    </Link>
                    {user.role === 'doctor' && (
                      <Link to="/doctor" onClick={() => setMobileMenuOpen(false)} className="btn-secondary w-full text-center text-sm py-2">
                        Trang bác sĩ
                      </Link>
                    )}
                    <button onClick={handleLogout} className="btn-ghost w-full text-center text-sm text-red-500 hover:bg-red-50 py-2">
                      Đăng xuất
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 px-2">
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="btn-ghost text-center text-sm py-2">
                      Đăng nhập
                    </Link>
                    <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="btn-secondary text-center text-sm py-2">
                      Đăng ký
                    </Link>
                  </div>
                )}
                <div className="mt-4 px-2">
                  <Link to="/booking" onClick={() => setMobileMenuOpen(false)} className="btn-primary w-full text-center text-sm py-2.5 font-bold shadow-md">
                    Đặt lịch ngay
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. MAIN PAGE CONTENT */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* 5. HOSPITAL-STYLE DETAILED GRID FOOTER */}
      <footer className="border-t border-slate-200 bg-slate-900 text-slate-400">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Info and Address */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-500">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <span className="text-lg font-bold tracking-tight text-white">VITAFAMILY</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                Phòng khám chuyên khoa Tai Mũi Họng hàng đầu, tận tụy chăm sóc sức khỏe gia đình bạn với trang thiết bị y khoa nội soi hiện đại bậc nhất.
              </p>
              <div className="space-y-2 text-xs">
                <p className="flex items-center gap-2">
                  <span className="text-brand-500 font-bold">📍 Địa chỉ:</span> 123 Nguyễn Trãi, Hà Nội
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-brand-500 font-bold">📞 Hotline:</span> 1900 6060
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-brand-500 font-bold">✉️ Email:</span> contact@vitafamily.vn
                </p>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">Liên kết nhanh</h4>
              <ul className="space-y-2 text-xs">
                <li><Link to="/gioi-thieu" className="hover:text-white transition-colors">Giới thiệu phòng khám</Link></li>
                <li><Link to="/bac-si" className="hover:text-white transition-colors">Đội ngũ bác sĩ chuyên khoa</Link></li>
                <li><Link to="/dich-vu" className="hover:text-white transition-colors">Dịch vụ điều trị Tai Mũi Họng</Link></li>
                <li><Link to="/tin-tuc" className="hover:text-white transition-colors">Tin tức y khoa & Cảnh báo</Link></li>
                <li><Link to="/lien-he" className="hover:text-white transition-colors">Liên hệ & Chỉ đường</Link></li>
              </ul>
            </div>

            {/* Services Column */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">Dịch vụ chuyên sâu</h4>
              <ul className="space-y-2 text-xs">
                <li className="hover:text-white transition-colors">Nội soi Tai Mũi Họng ống mềm</li>
                <li className="hover:text-white transition-colors">Điều trị viêm xoang, viêm mũi dị ứng</li>
                <li className="hover:text-white transition-colors">Rửa mũi xoang bằng máy khí dung</li>
                <li className="hover:text-white transition-colors">Chẩn đoán và điều trị viêm tai giữa</li>
                <li className="hover:text-white transition-colors">Phẫu thuật Amidan & VA công nghệ mới</li>
              </ul>
            </div>

            {/* Google Map / Map Placeholder Embed */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">Vị trí phòng khám</h4>
              <div className="overflow-hidden rounded-lg bg-slate-800 p-1 border border-slate-700 shadow-inner">
                <iframe
                  title="Bản đồ chỉ đường phòng khám VitaFamily"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3724.8988636128035!2d105.8080353147627!3d21.001695994246838!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3135ac9a2cf8b84d%3A0x7d3534d0b0b8e6ef!2zMTIzIE5ndXnhu4VuIFRyw6NpLCBUaGFuaCBYdcOibiwgSMOgIE7hu5lpLCBWaeG7h3QgTmFt!5e0!3m2!1svi!2s!4v1655788329431!5m2!1svi!2s"
                  width="100%"
                  height="120"
                  style={{ border: 0 }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="rounded"
                ></iframe>
              </div>
              <p className="mt-2 text-[10px] text-slate-500 leading-tight">
                * Có chỗ đậu xe ô tô rộng rãi, bảo vệ trông giữ 24/7 hoàn toàn miễn phí.
              </p>
            </div>
          </div>

          {/* Copyright Bottom Bar */}
          <div className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p>© 2026 VitaFamily - Phòng khám Tai Mũi Họng Chuyên Khoa. All rights reserved.</p>
            <p className="text-[10px]">Giấy phép hoạt động y tế số: 1245/SYT-GPHĐ cấp ngày 20/12/2023.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

