import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Clock3, Menu, Phone, X, MapPin, Mail } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'

import { RouteTransition } from '@/components/client/ClientMotion'
import AIChatbot from '@/pages/client/chatbot'
import { useAuth } from '@/context/AuthContext'
import { clinicService } from '@/services/clinic.service'
import type { ClinicItem } from '@/types'

export default function ClientLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const outlet = useOutlet()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileMenuTop, setMobileMenuTop] = useState(82)
  const headerRef = useRef<HTMLElement>(null)
  
  const [clinicInfo, setClinicInfo] = useState<ClinicItem | null>(null)

  useEffect(() => {
    clinicService.getPublicClinicInfo().then(setClinicInfo).catch(console.error)
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const updateMenuPosition = () => setMobileMenuTop((headerRef.current?.getBoundingClientRect().bottom || 74) + 8)
    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, { passive: true })
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition)
    }
  }, [mobileMenuOpen])

  function closeMobileMenu() {
    setMobileMenuOpen(false)
  }

  function handleLogout() {
    logout()
    closeMobileMenu()
    navigate('/login')
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `relative py-2 text-sm font-medium transition-colors duration-200 ${
      isActive ? 'text-teal-800 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-teal-700' : 'text-slate-600 hover:text-teal-800'
    }`

  const mobileNavClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-2xl px-4 py-3 text-base font-semibold transition-colors ${isActive ? 'bg-teal-50 text-teal-800' : 'text-slate-700 hover:bg-slate-50'}`

  const patientProfileRoles = ['user', 'patient']
  const canAccessPatientProfile = Boolean(user && patientProfileRoles.includes(user.role))
  const staffArea = user?.role === 'admin'
    ? { to: '/admin', label: 'Khu vực admin' }
    : user?.role === 'receptionist'
      ? { to: '/receptionist', label: 'Khu vực lễ tân' }
      : user?.role === 'doctor'
        ? { to: '/doctor', label: 'Khu vực bác sĩ' }
        : null

  return (
    <div className="flex min-h-screen flex-col bg-[#f7faf9] text-left text-slate-900">
      <div className="border-b border-teal-900/10 bg-teal-900 text-xs text-teal-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2">
            <Clock3 size={13} aria-hidden="true" /> {clinicInfo?.gio_lam_viec || '08:00 - 17:30 Thứ 2- Thứ 7'}
          </span>
          <a href={`tel:${clinicInfo?.so_dien_thoai || '0365747888'}`} className="inline-flex items-center gap-2 font-semibold text-white hover:text-teal-200">
            <Phone size={13} aria-hidden="true" /> Hotline {clinicInfo?.so_dien_thoai || '0365 747 888'}
          </a>
        </div>
      </div>

      <header ref={headerRef} className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f7faf9]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3" onClick={closeMobileMenu}>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-800 text-white shadow-[0_8px_20px_rgba(15,118,110,0.18)]">
              <span className="text-xl font-semibold leading-none">V</span>
            </span>
            <span>
              <span className="block text-base font-semibold tracking-[-0.03em] text-slate-950 sm:text-lg">ViteFamily</span>
              <span className="block text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">Tai Mũi Họng</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 lg:flex" aria-label="Điều hướng chính">
            <NavLink to="/" end className={navClass}>Trang chủ</NavLink>
            <NavLink to="/dich-vu" className={navClass}>Dịch vụ</NavLink>
            <NavLink to="/bac-si" className={navClass}>Bác sĩ</NavLink>
            <NavLink to="/tin-tuc" className={navClass}>Cẩm nang sức khỏe</NavLink>
            {canAccessPatientProfile && <NavLink to="/profile" className={navClass}>Hồ sơ của tôi</NavLink>}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {user ? (
              <>
                <span className="max-w-[150px] truncate text-xs font-medium text-slate-600">Xin chào, {user.ho_ten}</span>
                {staffArea && <Link to={staffArea.to} className="rounded-full px-3 py-2 text-xs font-semibold text-slate-600 transition-colors duration-200 hover:bg-white hover:text-teal-800">{staffArea.label}</Link>}
                <button type="button" onClick={handleLogout} className="rounded-full px-3 py-2 text-xs font-semibold text-slate-500 hover:bg-white hover:text-red-600">Đăng xuất</button>
              </>
            ) : (
              <Link to="/login" className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-teal-800">Đăng nhập</Link>
            )}
            <Link to="/booking" className="btn-primary rounded-full px-5 py-2.5 text-sm font-semibold shadow-[0_8px_20px_rgba(15,118,110,0.16)]">
              <CalendarDays size={16} aria-hidden="true" /> Đặt lịch khám
            </Link>
          </div>

          <button type="button" onClick={() => setMobileMenuOpen((open) => !open)} className="flex h-11 w-11 items-center justify-center rounded-2xl text-slate-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 lg:hidden" aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'} aria-expanded={mobileMenuOpen}>
            {mobileMenuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
        <motion.div
          className="fixed inset-0 z-20 bg-slate-950/20 backdrop-blur-sm lg:hidden"
          onClick={closeMobileMenu}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-x-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_24px_70px_rgba(15,63,65,0.16)]"
            style={{ top: mobileMenuTop }}
            onClick={(event) => event.stopPropagation()}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <nav className="space-y-1" aria-label="Điều hướng di động">
              <NavLink to="/" end className={mobileNavClass} onClick={closeMobileMenu}>Trang chủ</NavLink>
              <NavLink to="/dich-vu" className={mobileNavClass} onClick={closeMobileMenu}>Dịch vụ</NavLink>
              <NavLink to="/bac-si" className={mobileNavClass} onClick={closeMobileMenu}>Bác sĩ</NavLink>
              <NavLink to="/tin-tuc" className={mobileNavClass} onClick={closeMobileMenu}>Cẩm nang sức khỏe</NavLink>
              {canAccessPatientProfile && <NavLink to="/profile" className={mobileNavClass} onClick={closeMobileMenu}>Hồ sơ của tôi</NavLink>}
              {staffArea && <NavLink to={staffArea.to} className={mobileNavClass} onClick={closeMobileMenu}>{staffArea.label}</NavLink>}
            </nav>
            <div className="mt-4 border-t border-slate-100 pt-4">
              {user ? (
                <div className="flex items-center justify-between gap-3 px-3">
                  <span className="min-w-0 truncate text-sm font-medium text-slate-700">{user.ho_ten}</span>
                  <button type="button" onClick={handleLogout} className="shrink-0 text-sm font-semibold text-red-600">Đăng xuất</button>
                </div>
              ) : (
                <Link to="/login" onClick={closeMobileMenu} className="block px-3 py-2 text-sm font-semibold text-slate-700">Đăng nhập</Link>
              )}
              <Link to="/booking" onClick={closeMobileMenu} className="btn-primary mt-3 w-full rounded-2xl py-3 text-sm font-semibold">Đặt lịch khám</Link>
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1">
        <AnimatePresence mode="wait" initial>
          <RouteTransition key={location.pathname}>{outlet}</RouteTransition>
        </AnimatePresence>
      </main>

      <footer className="border-t border-slate-200 bg-slate-950 text-slate-400">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] lg:px-8">
          <div className="max-w-sm">
            <Link to="/" className="inline-flex items-center gap-3 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 font-semibold">V</span>
              <span className="text-lg font-semibold tracking-[-0.03em]">ViteFamily</span>
            </Link>
            <p className="mt-5 text-sm leading-6 text-slate-400">{clinicInfo?.mo_ta || 'Phòng khám chuyên khoa Tai Mũi Họng dành cho người lớn và trẻ em. Đặt lịch dễ dàng, khám rõ ràng.'}</p>
            <a href={`tel:${clinicInfo?.so_dien_thoai || '0365747888'}`} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-300 hover:text-white">
              <Phone size={15} aria-hidden="true" /> {clinicInfo?.so_dien_thoai || '0365 747 888'}
            </a>
            
            <div className="mt-6 flex items-center gap-4">
              <a href="https://www.facebook.com/" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-all hover:bg-[#1877F2] hover:text-white" aria-label="Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3.65l.35-4H14V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
              <a href="https://www.instagram.com/" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-all hover:bg-[#E1306C] hover:text-white" aria-label="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              <a href="https://zalo.me/vi/" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-all hover:bg-[#0068FF] hover:text-white" aria-label="Zalo">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </a>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Khám và tìm hiểu</h2>
            <div className="mt-4 space-y-3 text-sm">
              <Link to="/dich-vu" className="block hover:text-white">Dịch vụ chuyên khoa</Link>
              <Link to="/tin-tuc" className="block hover:text-white">Cẩm nang sức khỏe</Link>
              <Link to="/booking" className="block hover:text-white">Đặt lịch khám</Link>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Chính sách & Phản hồi</h2>
            <div className="mt-4 space-y-3 text-sm">
              <Link to="/ve-chung-toi" className="block hover:text-white">Về chúng tôi</Link>
              <Link to="/chinh-sach" className="block hover:text-white">Chính sách</Link>
              <Link to="/phan-hoi" className="block hover:text-white">Phản hồi</Link>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Phòng khám</h2>
            <div className="mt-4 space-y-3 text-sm leading-6">
              <a 
                href={clinicInfo?.ban_do_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinicInfo?.dia_chi || '123 Nguyễn Trãi, Thanh Xuân, Hà Nội')}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="flex gap-2 items-start hover:text-white transition-colors"
              >
                <MapPin size={16} className="mt-1 shrink-0" /> 
                <span>{clinicInfo?.dia_chi || '123 Nguyễn Trãi, Thanh Xuân, Hà Nội'}</span>
              </a>
              <p className="flex gap-2 items-start"><Clock3 size={16} className="mt-1 shrink-0" /> <span>{clinicInfo?.gio_lam_viec || '08:00 - 17:30 Thứ 2- Thứ 7'}</span></p>
              <p className="flex gap-2 items-start"><Mail size={16} className="mt-1 shrink-0" /> <span>{clinicInfo?.email || 'contact@vitefamily.vn'}</span></p>
              
              <a 
                href={clinicInfo?.ban_do_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinicInfo?.dia_chi || '123 Nguyễn Trãi, Thanh Xuân, Hà Nội')}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="block mt-4 overflow-hidden rounded-xl border border-slate-800 transition-opacity hover:opacity-80"
              >
                <iframe
                  title="Bản đồ phòng khám"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(clinicInfo?.dia_chi || '123 Nguyễn Trãi, Thanh Xuân, Hà Nội')}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  width="100%"
                  height="120"
                  style={{ border: 0, pointerEvents: 'none' }}
                  allowFullScreen={false}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>© {new Date().getFullYear()} {clinicInfo?.ten || 'ViteFamily'}.</p>
            <p>Thông tin trên website không thay thế chẩn đoán y khoa trực tiếp.</p>
          </div>
        </div>
      </footer>

      <AIChatbot />
    </div>
  )
}
