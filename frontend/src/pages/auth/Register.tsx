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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Theo dõi ô đang được click/focus trực tiếp và trạng thái đã nhấn submit chưa
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Hàm kiểm tra tính hợp lệ của từng ô dữ liệu
  function validateFields(
    ht: string,
    em: string,
    sdt: string,
    pass: string,
    cPass: string
  ) {
    const errs: { [key: string]: string } = {}

    const trimmedHoTen = ht.trim()
    const nameRegex = /^[\p{L}\s-]+$/u
    const repeatingRegex = /(.)\1{2,}/i

    if (!trimmedHoTen) {
      errs.hoTen = 'Vui lòng nhập họ và tên'
    } else if (trimmedHoTen.length < 5 || trimmedHoTen.length > 100) {
      errs.hoTen = 'Họ và tên phải từ 5 đến 100 ký tự'
    } else if (!nameRegex.test(trimmedHoTen)) {
      errs.hoTen = 'Họ và tên chỉ được chứa chữ cái, khoảng trắng và dấu gạch nối (-)'
    } else if (repeatingRegex.test(trimmedHoTen)) {
      errs.hoTen = 'Họ và tên không được chứa từ 3 ký tự giống nhau liên tiếp'
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!em.trim()) {
      errs.email = 'Vui lòng nhập địa chỉ email'
    } else if (!emailRegex.test(em)) {
      errs.email = 'Email không đúng định dạng'
    }

    const phoneRegex = /^0\d{9}$/
    if (!sdt.trim()) {
      errs.soDienThoai = 'Vui lòng nhập số điện thoại'
    } else if (!phoneRegex.test(sdt)) {
      errs.soDienThoai = 'Số điện thoại phải gồm 10 số và bắt đầu bằng số 0'
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/
    if (!pass) {
      errs.password = 'Vui lòng nhập mật khẩu'
    } else if (!passwordRegex.test(pass)) {
      errs.password = 'Mật khẩu phải tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số'
    }

    if (!cPass) {
      errs.confirmPassword = 'Vui lòng nhập lại mật khẩu xác nhận'
    } else if (pass !== cPass) {
      errs.confirmPassword = 'Mật khẩu xác nhận không khớp'
    }

    return errs
  }

  // Tính toán danh sách lỗi thời gian thực
  const fieldErrors = validateFields(hoTen, email, soDienThoai, password, confirmPassword)

  // Chỉ hiển thị viền đỏ và lỗi khi:
  // 1. Người dùng ĐANG CLICK/FOCUS trực tiếp vào ô đó và ô đó chưa đạt validate
  // HOẶC 2. Người dùng ĐÃ BẤM SUBMIT tạo tài khoản
  const isFieldError = (field: string) => {
    const isTargeted = focusedField === field || submitted
    return Boolean(isTargeted && fieldErrors[field])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSubmitted(true)

    if (Object.keys(fieldErrors).length > 0) {
      return
    }

    setLoading(true)
    try {
      await authService.register({ ho_ten: hoTen, email, so_dien_thoai: soDienThoai, password })
      navigate('/login', { state: { registered: true } })
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
        err.message ||
        'Đăng ký thất bại'
      )
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

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label className="input-label">Họ và tên</label>
          <input
            type="text"
            className={`input transition-all ${isFieldError('hoTen') ? '!border-red-500 focus:!border-red-500 focus:!ring-1 focus:!ring-red-500 bg-red-50/20' : ''}`}
            placeholder="Nguyễn Văn A"
            value={hoTen}
            onFocus={() => setFocusedField('hoTen')}
            onBlur={() => setFocusedField(null)}
            onChange={(e) => setHoTen(e.target.value)}
          />
          {isFieldError('hoTen') && (
            <p className="mt-1 text-xs text-red-500 font-medium text-left">{fieldErrors.hoTen}</p>
          )}
        </div>

        <div>
          <label className="input-label">Email</label>
          <input
            type="email"
            className={`input transition-all ${isFieldError('email') ? '!border-red-500 focus:!border-red-500 focus:!ring-1 focus:!ring-red-500 bg-red-50/20' : ''}`}
            placeholder="email@example.com"
            value={email}
            onFocus={() => setFocusedField('email')}
            onBlur={() => setFocusedField(null)}
            onChange={(e) => setEmail(e.target.value)}
          />
          {isFieldError('email') && (
            <p className="mt-1 text-xs text-red-500 font-medium text-left">{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <label className="input-label">Số điện thoại</label>
          <input
            type="tel"
            className={`input transition-all ${isFieldError('soDienThoai') ? '!border-red-500 focus:!border-red-500 focus:!ring-1 focus:!ring-red-500 bg-red-50/20' : ''}`}
            placeholder="0901234567"
            value={soDienThoai}
            onFocus={() => setFocusedField('soDienThoai')}
            onBlur={() => setFocusedField(null)}
            onChange={(e) => setSoDienThoai(e.target.value)}
          />
          {isFieldError('soDienThoai') && (
            <p className="mt-1 text-xs text-red-500 font-medium text-left">{fieldErrors.soDienThoai}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Mật khẩu</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className={`input pr-9 transition-all ${isFieldError('password') ? '!border-red-500 focus:!border-red-500 focus:!ring-1 focus:!ring-red-500 bg-red-50/20' : ''}`}
                placeholder="Tối thiểu 8 ký tự"
                value={password}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.959 8.959 0 013.122-.563c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21m-4.225-4.225L3 3" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {isFieldError('password') && (
              <p className="mt-1 text-xs text-red-500 font-medium text-left">{fieldErrors.password}</p>
            )}
          </div>

          <div>
            <label className="input-label">Xác nhận</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                className={`input pr-9 transition-all ${isFieldError('confirmPassword') ? '!border-red-500 focus:!border-red-500 focus:!ring-1 focus:!ring-red-500 bg-red-50/20' : ''}`}
                placeholder="Nhập lại"
                value={confirmPassword}
                onFocus={() => setFocusedField('confirmPassword')}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showConfirmPassword ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.959 8.959 0 013.122-.563c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21m-4.225-4.225L3 3" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {isFieldError('confirmPassword') && (
              <p className="mt-1 text-xs text-red-500 font-medium text-left">{fieldErrors.confirmPassword}</p>
            )}
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
