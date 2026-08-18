import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { GoogleLogin, CredentialResponse } from '@react-oauth/google'
import { useAuth } from '@/context/AuthContext'

// Đối chiếu trực tiếp với DB (2026-07-25). LƯU Ý khi sửa danh sách này: phải kiểm tra
// truong `role` trong nguoi_dung, KHÔNG chỉ dựa vào họ tên. Mục "Bác sĩ" trước đây trỏ vào
// haiv5634@gmail.com — tài khoản tên "BS. Trần Minh Khang" nhưng role='user', nên đăng nhập
// xong bị Login.tsx đẩy về trang client (`/`) thay vì `/doctor`, gây tưởng nhầm là lỗi routing.
const demoAccounts = [
  { role: 'Admin', email: 'admin@vitafamily.vn' },
  { role: 'Bác sĩ', email: 'doctor.bao@vitafamily.vn' },
  { role: 'Bệnh nhân', email: 'lt14062006meitu@gmail.com' },
  { role: 'Lễ tân', email: 'luongtran140606@gmail.com' },
]

export default function Login() {
  const { login, loginGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const registered = (location.state as { registered?: boolean })?.registered

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) return
    setError('')
    setLoading(true)

    try {
      await loginGoogle(credentialResponse.credential)
      const fromLocation = (location.state as { from?: { pathname?: string; search?: string } })?.from
      const from = fromLocation?.pathname ? `${fromLocation.pathname}${fromLocation.search || ''}` : undefined
      navigate(from || '/', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Đăng nhập Google thất bại')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await login({ email, password })
      const fromLocation = (location.state as { from?: { pathname?: string; search?: string } })?.from
      const from = fromLocation?.pathname ? `${fromLocation.pathname}${fromLocation.search || ''}` : undefined

      if (user.role === 'admin') {
        navigate(from?.startsWith('/admin') ? from : '/admin', { replace: true })
      } else if (user.role === 'receptionist') {
        navigate(from?.startsWith('/receptionist') ? from : '/receptionist', { replace: true })
      } else if (user.role === 'doctor') {
        navigate(from?.startsWith('/doctor') ? from : '/doctor', { replace: true })
      } else {
        navigate(from || '/', { replace: true })
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Đăng nhập thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Chào mừng trở lại</h1>
        <p className="mt-1 text-sm text-slate-500">Đăng nhập để vào hệ thống ViteFamily.</p>
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
          <label className="input-label">Email hoặc Số điện thoại</label>
          <input
            type="text"
            className="input"
            placeholder="admin@vitafamily.vn hoặc 0912345678"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Mật khẩu</label>
            <Link to="/forgot-password" className="text-xs text-brand-600 hover:underline">Quên mật khẩu?</Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="input pr-10"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
              title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.959 8.959 0 013.122-.563c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21m-4.225-4.225L3 3" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
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

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold uppercase text-slate-400">Hoặc</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={() => setError('Xác thực với Google thất bại. Vui lòng thử lại.')}
          shape="circle"
          text="signin_with"
        />
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="font-semibold text-brand-600 hover:underline">
          Đăng ký ngay
        </Link>
      </p>

      <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">Tài khoản demo</p>
        <div className="space-y-1.5 text-xs">
          {demoAccounts.map(({ role, email }) => (
            <div key={role} className="flex items-center justify-between">
              <span className="font-medium text-brand-800">{role}</span>
              {/* Chi hien email — demoAccounts khong co truong `password`, truoc day render
                  {password} nen luon ra "email / " cut duoi. Khong hardcode mat khau doan mo. */}
              <span className="font-mono text-slate-500">{email}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
