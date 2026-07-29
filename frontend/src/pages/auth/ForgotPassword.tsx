import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authService } from '@/services/auth.service'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setError('Vui long nhap dia chi email')
      return
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError('Email khong dung dinh dang')
      return
    }

    setLoading(true)
    setError('')
    try {
      await authService.forgotPassword(normalizedEmail)
      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Gui yeu cau that bai')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Quên Mật Khẩu</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Nhập email đã đăng ký để nhận liên kết khôi phục mật khẩu.
        </p>
      </div>

      {success ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
            Hệ thống đã nhận yêu cầu khôi phục mật khẩu. Vui lòng kiểm tra hộp thư đến và thư rác.
          </div>
          <div className="text-center pt-2">
            <Link to="/login" className="text-sm font-semibold text-brand-600 hover:text-brand-800">
              Quay lại đăng nhập
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="input-label">Địa chỉ email</label>
            <input
              type="email"
              className="input"
              placeholder="example@gmail.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full py-2.5 text-base" disabled={loading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner h-4 w-4" />
                Đang gửi...
              </span>
            ) : 'Gui yeu cau dat lai mat khau'}
          </button>

          <div className="flex items-center justify-between border-t border-slate-50 pt-4 text-xs">
            <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-800">
              Quay lại đăng nhập
            </Link>
            <Link to="/register" className="font-semibold text-slate-500 hover:text-slate-800">
              Đăng ký tài khoản
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
