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
    `text-sm font-bold transition-colors duration-200 ${isActive ? 'text-brand-600 border-b-2 border-brand-600 pb-1' : 'text-slate-650 hover:text-brand-500'
    }`

  const mobileActiveClass = ({ isActive }: { isActive: boolean }) =>
    `block px-4 py-2.5 rounded-lg text-base font-bold transition-colors ${isActive ? 'bg-brand-50 text-brand-600 font-bold' : 'text-slate-600 hover:bg-slate-50'
    }`

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-left">
      {/* 1. TOP UTILITY BAR (Hospital-style) */}
      <div className="bg-brand-900 text-[11px] text-brand-100 py-2.5 border-b border-brand-850">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5">
              📍 123 Nguyễn Trãi, Thanh Xuân, Hà Nội
            </span>
            <span className="hidden sm:inline">
              ⏰ Làm việc: 08:00 - 17:30 (Thứ 2 - Thứ 7)
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-bold text-white">
              📞 Hotline hỗ trợ 24/7: 0365 747888
            </span>
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER & NAVBAR */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500 shadow-md shadow-brand-100">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div>
              <span className="block text-base font-extrabold leading-none text-slate-800 tracking-tight sm:text-lg">VITAFAMILY</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tai Mũi Họng Chuyên Khoa</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6">
            <NavLink to="/" className={activeClass}>Trang chủ</NavLink>
            <NavLink to="/bac-si" className={activeClass}>Đội ngũ bác sĩ</NavLink>
            <NavLink to="/dich-vu" className={activeClass}>Dịch vụ điều trị</NavLink>
            <NavLink to="/tin-tuc" className={activeClass}>Tin tức</NavLink>
            {user && <NavLink to="/profile" className={activeClass}>Hồ sơ bệnh nhân</NavLink>}
          </nav>

          {/* User Auth Controls & Booking Button */}
          <div className="hidden lg:flex items-center gap-3">
            {user ? (
              <>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {user.ho_ten}
                </span>
                {user.role === 'doctor' && (
                  <Link to="/doctor" className="btn-secondary py-1.5 text-xs font-bold">
                    Trang bác sĩ
                  </Link>
                )}
                <button onClick={handleLogout} className="btn-ghost py-1.5 text-xs text-slate-500 hover:text-red-500 font-semibold">
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost px-3 py-1.5 text-xs font-bold">
                  Đăng nhập
                </Link>
                <Link to="/register" className="btn-secondary px-3 py-1.5 text-xs font-bold">
                  Đăng ký
                </Link>
              </>
            )}
            <Link to="/booking" className="btn-primary px-5 py-2 text-xs font-bold shadow-md shadow-brand-150 rounded-full">
              Đặt lịch khám
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
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-64 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-5 text-left">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <span className="font-bold text-slate-800">Danh mục chính</span>
                <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Mobile Navigation Links */}
              <nav className="flex flex-col gap-2">
                <NavLink to="/" onClick={() => setMobileMenuOpen(false)} className={mobileActiveClass}>Trang chủ</NavLink>
                <NavLink to="/bac-si" onClick={() => setMobileMenuOpen(false)} className={mobileActiveClass}>Đội ngũ bác sĩ</NavLink>
                <NavLink to="/dich-vu" onClick={() => setMobileMenuOpen(false)} className={mobileActiveClass}>Dịch vụ điều trị</NavLink>
                <NavLink to="/tin-tuc" onClick={() => setMobileMenuOpen(false)} className={mobileActiveClass}>Tin tức</NavLink>
                {user && <NavLink to="/profile" onClick={() => setMobileMenuOpen(false)} className={mobileActiveClass}>Hồ sơ bệnh nhân</NavLink>}
              </nav>

              <div className="border-t border-slate-100 pt-4">
                {user ? (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-850 px-4">Bệnh nhân: {user.ho_ten}</p>
                    {user.role === 'doctor' && (
                      <Link to="/doctor" onClick={() => setMobileMenuOpen(false)} className="btn-secondary w-full text-center text-sm py-2 block font-semibold">
                        Trang bác sĩ
                      </Link>
                    )}
                    <button onClick={handleLogout} className="btn-ghost w-full text-center text-sm text-red-500 hover:bg-red-50 py-2 font-semibold">
                      Đăng xuất
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 px-2">
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="btn-ghost text-center text-sm py-2 font-semibold">
                      Đăng nhập
                    </Link>
                    <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="btn-secondary text-center text-sm py-2 font-semibold">
                      Đăng ký
                    </Link>
                  </div>
                )}
                <div className="mt-4 px-2">
                  <Link to="/booking" onClick={() => setMobileMenuOpen(false)} className="btn-primary w-full text-center text-sm py-2.5 font-bold shadow-md rounded-full block">
                    Đặt lịch khám ngay
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

      {/* 5. DETAILED HOSPITAL FOOTER (Thu Cuc / Hong Ngoc Style) */}
      <footer className="border-t border-slate-200 bg-slate-900 text-slate-400 text-left">
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
              <p className="text-xs leading-relaxed">
                Hệ thống chuyên khoa sâu Tai Mũi Họng uy tín hàng đầu, sở hữu trang thiết bị khám chữa bệnh nội soi NBI cao cấp nhất hiện nay.
              </p>
              <div className="space-y-2 text-xs">
                <p><span className="text-slate-200 font-bold">📍 Cơ sở chính:</span> 123 Nguyễn Trãi, Thanh Xuân, Hà Nội</p>
                <p><span className="text-slate-200 font-bold">📞 Hotline:</span> 0365 747888 (Phục vụ 24/7)</p>
                <p><span className="text-slate-200 font-bold">✉️ Email:</span> contact@vitafamily.vn</p>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">Danh mục chuyên ngành</h4>
              <ul className="space-y-2 text-xs">
                <li><Link to="/bac-si" className="hover:text-white transition-colors">Đội ngũ bác sĩ trực tiếp khám</Link></li>
                <li><Link to="/dich-vu" className="hover:text-white transition-colors">Dịch vụ nội soi chuyên sâu</Link></li>
                <li><Link to="/tin-tuc" className="hover:text-white transition-colors">Cẩm nang sức khỏe Tai Mũi Họng</Link></li>
                <li><Link to="/booking" className="hover:text-white transition-colors">Đăng ký lịch khám online</Link></li>
              </ul>
            </div>

            {/* Specialties */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">Các bệnh lý chính điều trị</h4>
              <ul className="space-y-2 text-xs">
                <li>Viêm xoang cấp, viêm mũi dị ứng</li>
                <li>Viêm amidan hốc mủ, phì đại VA</li>
                <li>Viêm tai giữa cấp tính, viêm tai ngoài</li>
                <li>Hạt xơ dây thanh, khàn tiếng kéo dài</li>
                <li>Ù tai, suy giảm thính lực đột ngột</li>
              </ul>
            </div>

            {/* Google Map Embed */}
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white mb-4">Bản đồ chỉ đường</h4>
              <div className="overflow-hidden rounded-lg bg-slate-800 p-1 border border-slate-700 shadow-inner">
                <iframe
                  title="Bản đồ chỉ đường phòng khám VitaFamily"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3724.8988636128035!2d105.8080353147627!3d21.001695994246838!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3135ac9a2cf8b84d%3A0x7d3534d0b0b8e6ef!2zMTIzIE5ndXnhu4VuIFRyw6NpLCBUaGFuaCBYdcOibiwgSMOgIE7hu5lpLCBWaeG7h3QgTmFt!5e0!3m2!1svi!2s!4v1655788329431!5m2!1svi!2s"
                  width="100%"
                  height="110"
                  style={{ border: 0 }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="rounded"
                ></iframe>
              </div>
            </div>
          </div>

          {/* Copyright Bottom Bar */}
          <div className="mt-12 border-t border-slate-800 pt-6 text-center text-xs text-slate-500 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p>© 2026 VitaFamily - Phòng khám Tai Mũi Họng Chuyên Khoa. All rights reserved.</p>
            <p className="text-[10px]">Giấy phép hoạt động khám chữa bệnh số: 1245/SYT-GPHĐ.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
