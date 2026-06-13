import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Icon from '@/components/admin/icons'

interface Props {
  onToggleSidebar: () => void
}

export default function DoctorHeader({ onToggleSidebar }: Props) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const initials = (user?.ho_ten || 'BS')
    .split(' ')
    .map((w) => w[0])
    .slice(-2)
    .join('')
    .toUpperCase()

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 lg:px-6">
      <button onClick={onToggleSidebar} className="btn-icon lg:hidden" aria-label="Mở menu">
        <Icon name="menu" className="h-5 w-5" />
      </button>

      {/* Breadcrumb / Title */}
      <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
        <span className="font-medium text-brand-600">Cổng Bác sĩ</span>
        <span className="text-slate-300">/</span>
        <span>VitaFamily</span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 ml-auto">
        <button className="btn-icon relative" title="Thông báo">
          <Icon name="bell" className="h-5 w-5 text-slate-500" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold leading-tight text-slate-800">{user?.ho_ten || 'Bác sĩ'}</p>
          <p className="text-xs text-slate-400">Bác sĩ</p>
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
