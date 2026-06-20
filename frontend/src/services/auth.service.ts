// ============================================================
// SERVICE: Xác thực (Đăng nhập / Đăng ký) — chức năng A1
// ============================================================

import type { User } from '@/types'
import axios from './axiosInstance'

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

export const authService = {

  // Đăng nhập hệ thống

  async login({ email, password }: LoginCredentials): Promise<LoginResult> {
    // Gọi API thật đến Backend
    const { data } = await axios.post('/auth/login', {
      email,
      mat_khau: password // Backend dùng mat_khau
    })

    return data.data // Trả về { token, user }
  },

  /**
   * Đăng ký tài khoản mới (User)
   */
  async register(registerData: RegisterData): Promise<void> {
    await axios.post('/auth/register', {
      ...registerData,
      mat_khau: registerData.password // Map password sang mat_khau
    })
  },
}
