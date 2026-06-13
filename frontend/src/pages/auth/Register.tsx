import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '@/services/auth.service'

export default function Register() {
  const navigate = useNavigate()

  const [hoTen, setHoTen] = useState('')
  const [email, setEmail] = useState('')
  const [soDienThoai, setSoDienThoai] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự')
      return
    }

    setLoading(true)
    try {
      await authService.register({ ho_ten: hoTen, email, so_dien_thoai: soDienThoai, password })
      navigate('/login', { state: { registered: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng ký thất bại')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-800">Tạo tài khoản</h1>
        <p className="mt-1 text-sm text-slate-500">Đăng ký để sử dụng dịch vụ chăm sóc sức khỏe gia đình.</p>
      </div>

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
          <label className="input-label">Họ và tên</label>
          <input
            type="text"
            className="input"
            placeholder="Nguyễn Văn A"
            value={hoTen}
            onChange={(e) => setHoTen(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="input-label">Email</label>
          <input
            type="email"
            className="input"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="input-label">Số điện thoại</label>
          <input
            type="tel"
            className="input"
            placeholder="0901234567"
            value={soDienThoai}
            onChange={(e) => setSoDienThoai(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Mật khẩu</label>
            <input
              type="password"
              className="input"
              placeholder="Tối thiểu 6 ký tự"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="input-label">Xác nhận</label>
            <input
              type="password"
              className="input"
              placeholder="Nhập lại"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full py-2.5 text-base" disabled={loading}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="spinner h-4 w-4" />
              Đang xử lý...
            </span>
          ) : 'Tạo tài khoản'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Đã có tài khoản?{' '}
        <Link to="/login" className="font-semibold text-brand-600 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </>
  )
}
