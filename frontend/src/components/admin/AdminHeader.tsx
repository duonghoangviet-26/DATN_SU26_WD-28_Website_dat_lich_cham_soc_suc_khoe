import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Icon from './icons'

interface Props {
  onToggleSidebar: () => void
}

export default function AdminHeader({ onToggleSidebar }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

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
        <button className="btn-icon relative" title="Thông báo">
          <Icon name="bell" className="h-5 w-5 text-slate-500" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

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
