import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '@/services/auth.service'

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function validateForm() {
    if (!token) return 'Ma token xac thuc khong tim thay hoac da het han'
    if (!password.trim()) return 'Vui long nhap mat khau moi'
    if (!PASSWORD_PATTERN.test(password)) {
      return 'Mat khau phai toi thieu 8 ky tu, gom chu hoa, chu thuong va so'
    }
    if (password !== confirmPassword) return 'Mat khau nhap lai khong trung khop'
    return ''
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setError('')
    setLoading(true)
    try {
      await authService.resetPassword(token!, password)
      navigate('/login', {
        replace: true,
        state: { message: 'Dat lai mat khau thanh cong. Vui long dang nhap lai.' },
      })
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Dat lai mat khau that bai')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-slate-800">Lien ket khong hop le</h1>
        <p className="mt-2 text-sm text-red-500">
          Duong dan dat lai mat khau bi thieu hoac khong chinh xac. Vui long gui lai yeu cau quen mat khau.
        </p>
        <div className="mt-6 border-t border-slate-50 pt-4">
          <Link to="/forgot-password" className="text-sm font-semibold text-brand-600 hover:text-brand-800">
            Yeu cau lien ket moi
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 text-left shadow-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-800">Dat lai mat khau</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Tao mat khau moi toi thieu 8 ky tu, bao gom chu hoa, chu thuong va chu so.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="input-label">Mat khau moi</label>
          <input
            type="password"
            className="input"
            placeholder="Nhap mat khau moi"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={loading}
            required
          />
        </div>

        <div>
          <label className="input-label">Xac nhan mat khau</label>
          <input
            type="password"
            className="input"
            placeholder="Nhap lai mat khau moi"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={loading}
            required
          />
        </div>

        <button type="submit" className="btn-primary w-full py-2.5 text-base" disabled={loading}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="spinner h-4 w-4" />
              Dang xu ly...
            </span>
          ) : 'Dat lai mat khau'}
        </button>

        <div className="flex items-center justify-between border-t border-slate-50 pt-4 text-xs">
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-800">
            Quay lai dang nhap
          </Link>
          <Link to="/forgot-password" className="font-semibold text-slate-500 hover:text-slate-800">
            Gui lai yeu cau
          </Link>
        </div>
      </form>
    </div>
  )
}
