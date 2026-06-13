// ============================================================
// SERVICE: Xác thực (Đăng nhập / Đăng ký) — chức năng A1
// ============================================================
// Hiện tại dùng tài khoản mock để vào được giao diện Admin mà chưa cần backend.
// Sau này thay phần thân bằng axios.post('/auth/login', ...).

import type { User } from '@/types'
import { delay } from '@/utils/format'
// import axios from './axiosInstance'

interface LoginCredentials {
  email: string
  password: string
}

interface RegisterData {
  ho_ten: string
  email: string
  so_dien_thoai: string
  password: string
}

interface LoginResult {
  token: string
  user: User
}

// Tài khoản demo để đăng nhập thử trong giai đoạn làm giao diện.
const DEMO_ACCOUNTS = [
  { email: 'admin@vitafamily.vn', password: '123456', ho_ten: 'Quản trị viên', role: 'admin' as const },
  { email: 'doctor@vitafamily.vn', password: '123456', ho_ten: 'BS. Demo', role: 'doctor' as const },
  { email: 'user@vitafamily.vn', password: '123456', ho_ten: 'Bệnh nhân Demo', role: 'user' as const },
]

export const authService = {
  async login({ email, password }: LoginCredentials): Promise<LoginResult> {
    await delay()

    // ── SAU NÀY thay bằng:
    // const { data } = await axios.post('/auth/login', { email, password })
    // return data.data   // { token, user }
    const found = DEMO_ACCOUNTS.find(
      (a) => a.email === email && a.password === password,
    )
    if (!found) {
      throw new Error('Email hoặc mật khẩu không đúng')
    }
    return {
      token: 'mock-token-' + found.role,
      user: {
        id: 1,
        email: found.email,
        ho_ten: found.ho_ten,
        role: found.role,
        status: 'active',
        ngay_tao: new Date().toISOString(),
      },
    }
  },

  async register(data: RegisterData): Promise<void> {
    await delay()

    // ── SAU NÀY thay bằng:
    // await axios.post('/auth/register', data)
    if (!data.email || !data.password) {
      throw new Error('Vui lòng điền đầy đủ thông tin')
    }
  },
}
