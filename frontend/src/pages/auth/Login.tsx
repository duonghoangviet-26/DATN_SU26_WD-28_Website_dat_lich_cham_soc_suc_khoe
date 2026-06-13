import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const registered = (location.state as { registered?: boolean })?.registered

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login({ email, password })
      const from = (location.state as { from?: { pathname?: string } })?.from?.pathname
      if (user.role === 'admin') {
        navigate(from?.startsWith('/admin') ? from : '/admin', { replace: true })
      } else {
        navigate(from || '/', { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Chào mừng trở lại</h1>
        <p className="mt-1 text-sm text-slate-500">Đăng nhập để vào hệ thống VitaFamily.</p>
      </div>

      {registered && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Đăng ký thành công! Vui lòng đăng nhập.
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="input-label">Email</label>
          <input
            type="email"
            className="input"
            placeholder="admin@vitafamily.vn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Mật khẩu</label>
            <a href="#" className="text-xs text-brand-600 hover:underline">Quên mật khẩu?</a>
          </div>
          <input
            type="password"
            className="input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full py-2.5 text-base" disabled={loading}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="spinner h-4 w-4" />
              Đang xử lý...
            </span>
          ) : 'Đăng nhập'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="font-semibold text-brand-600 hover:underline">
          Đăng ký ngay
        </Link>
      </p>

      {/* Demo accounts */}
      <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">Tài khoản demo</p>
        <div className="space-y-1.5 text-xs">
          {[
            { role: 'Admin', email: 'admin@vitafamily.vn' },
            { role: 'Bác sĩ', email: 'doctor@vitafamily.vn' },
            { role: 'Bệnh nhân', email: 'user@vitafamily.vn' },
          ].map(({ role, email }) => (
            <div key={role} className="flex items-center justify-between">
              <span className="font-medium text-brand-800">{role}</span>
              <span className="font-mono text-slate-500">{email} / 123456</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
