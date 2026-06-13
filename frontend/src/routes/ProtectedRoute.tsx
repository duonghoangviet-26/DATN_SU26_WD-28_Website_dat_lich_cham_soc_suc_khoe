import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { Role } from '@/types'

interface Props {
  children: React.ReactNode
  roles?: Role[]
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-slate-500">
        <span className="spinner" />
        Đang tải...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-surface text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100">
          <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v4M12 16h.01" />
          </svg>
        </div>
        <div>
          <p className="text-xl font-bold text-slate-800">Không có quyền truy cập</p>
          <p className="mt-1 text-sm text-slate-500">
            Trang này yêu cầu vai trò: <span className="font-medium text-slate-700">{roles.join(', ')}</span>
          </p>
        </div>
        <Link to="/" className="btn-primary">
          Về trang chủ
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
