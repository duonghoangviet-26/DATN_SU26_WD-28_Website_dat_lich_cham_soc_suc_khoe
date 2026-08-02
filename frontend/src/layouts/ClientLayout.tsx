import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Clock3, Menu, Phone, X } from 'lucide-react'
import { Link, NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'

import { RouteTransition } from '@/components/client/ClientMotion'
import AIChatbot from '@/pages/client/chatbot'
import { useAuth } from '@/context/AuthContext'

export default function ClientLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const outlet = useOutlet()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileMenuTop, setMobileMenuTop] = useState(82)
  const headerRef = useRef<HTMLElement>(null)

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
          <span className="inline-flex items-center gap-2"><Clock3 size={13} aria-hidden="true" /> 08:00 - 24:00 (theo ca bác sĩ), thứ 2 đến thứ 7</span>
          <a href="tel:0365747888" className="inline-flex items-center gap-2 font-semibold text-white hover:text-teal-200"><Phone size={13} aria-hidden="true" /> Hotline 0365 747 888</a>
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
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
          <div className="max-w-sm">
            <Link to="/" className="inline-flex items-center gap-3 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 font-semibold">V</span>
              <span className="text-lg font-semibold tracking-[-0.03em]">ViteFamily</span>
            </Link>
            <p className="mt-5 text-sm leading-6 text-slate-400">Phòng khám chuyên khoa Tai Mũi Họng dành cho người lớn và trẻ em. Đặt lịch dễ dàng, khám rõ ràng.</p>
            <a href="tel:0365747888" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-300 hover:text-white"><Phone size={15} aria-hidden="true" /> 0365 747 888</a>
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
            <h2 className="text-sm font-semibold text-white">Phòng khám</h2>
            <div className="mt-4 space-y-3 text-sm leading-6">
              <p>123 Nguyễn Trãi, Thanh Xuân, Hà Nội</p>
              <p>08:00 - 24:00 (theo ca bác sĩ)<br />Thứ 2 - Thứ 7</p>
              <p>contact@vitefamily.vn</p>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>© 2026 ViteFamily. Phòng khám Tai Mũi Họng.</p>
            <p>Thông tin trên website không thay thế chẩn đoán y khoa trực tiếp.</p>
          </div>
        </div>
      </footer>

      <AIChatbot />
    </div>
  )
}
