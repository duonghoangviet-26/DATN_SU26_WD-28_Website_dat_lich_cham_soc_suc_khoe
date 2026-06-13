import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function ClientLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-500 shadow-sm shadow-brand-200">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-800">VitaFamily</span>
          </Link>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 sm:block">
                  {user.ho_ten}
                </span>
                {user.role === 'admin' && (
                  <Link to="/admin" className="btn-secondary text-sm">
                    Quản trị
                  </Link>
                )}
                <button onClick={handleLogout} className="btn-ghost text-sm">
                  Đăng xuất
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-ghost text-sm">
                  Đăng nhập
                </Link>
                <Link to="/register" className="btn-primary text-sm">
                  Đăng ký
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
