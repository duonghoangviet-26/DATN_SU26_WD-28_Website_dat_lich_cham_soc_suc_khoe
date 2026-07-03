import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Icon from './icons'
import { notificationService } from '@/services/notification.service'
import { formatDateTime } from '@/utils/format'

interface Props {
  onToggleSidebar: () => void
}

export default function AdminHeader({ onToggleSidebar }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  
  const [notifications, setNotifications] = useState<any[]>([])
  const [showNotiDropdown, setShowNotiDropdown] = useState(false)
  const notiRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notiRef.current && !notiRef.current.contains(event.target as Node)) {
        setShowNotiDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadNotifications = () => {
    notificationService.getReceived(1, 5).then(({ data }) => {
      setNotifications(data)
    }).catch(err => console.error('Lỗi tải thông báo header:', err))
  }

  useEffect(() => {
    loadNotifications()
    
    window.addEventListener('RELOAD_NOTIFICATIONS', loadNotifications)
    return () => {
      window.removeEventListener('RELOAD_NOTIFICATIONS', loadNotifications)
    }
  }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const initials = (user?.ho_ten || 'Admin')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase()

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 lg:px-6">
      {/* Left: hamburger (mobile) */}
      <button
        onClick={onToggleSidebar}
        className="btn-icon lg:hidden"
        aria-label="Mở menu"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      {/* Center: search bar */}
      <div className="hidden flex-1 sm:block" style={{ maxWidth: 400 }}>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Icon name="search" className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Tìm kiếm..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      {/* Right: notification + user */}
      <div className="flex items-center gap-2">
        <div className="relative" ref={notiRef}>
          <button 
            className="btn-icon relative" 
            title="Thông báo"
            onClick={() => setShowNotiDropdown(!showNotiDropdown)}
          >
            <Icon name="bell" className="h-5 w-5 text-slate-500" />
            {notifications.length > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>

          {/* Dropdown Menu */}
          {showNotiDropdown && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white shadow-lg border border-slate-100 overflow-hidden z-50">
              <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Thông báo mới</h3>
                <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-semibold">{notifications.length}</span>
              </div>
              
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center">
                    <Icon name="bell-off" className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Chưa có thông báo nào</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {notifications.map(n => (
                      <div 
                        key={n._id} 
                        className="p-3 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => {
                          setShowNotiDropdown(false)
                          navigate('/admin/notifications', { state: { openNotification: n } })
                        }}
                      >
                        <p className="text-sm font-semibold text-slate-800 line-clamp-2">{n.tieu_de}</p>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Icon name="clock" className="w-3 h-3" />
                          {formatDateTime(n.ngay_tao)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-2 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={() => {
                    setShowNotiDropdown(false)
                    navigate('/admin/notifications')
                  }}
                  className="w-full py-2 text-sm font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors text-center inline-flex items-center justify-center gap-1"
                >
                  Xem tất cả
                  <Icon name="arrow-right" className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold leading-tight text-slate-800">
            {user?.ho_ten || 'Admin'}
          </p>
          <p className="text-xs text-slate-400">Quản trị viên</p>
        </div>

        <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-sm font-bold text-white shadow-sm">
          {initials}
        </div>

        <button
          onClick={handleLogout}
          className="btn-icon text-slate-400 hover:bg-red-50 hover:text-red-600"
          title="Đăng xuất"
        >
          <Icon name="logout" className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
