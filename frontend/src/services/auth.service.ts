import axiosInstance from './axiosInstance'
import type { User, ApiResponse } from '@/types'

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
  async login({ email, password }: LoginCredentials): Promise<LoginResult> {
    const res = await axiosInstance.post<ApiResponse<LoginResult>>('/auth/login', {
      email,
      mat_khau: password,
    })
    return res.data.data
  },

  async register(data: RegisterData): Promise<void> {
    await axiosInstance.post<ApiResponse<unknown>>('/auth/register', {
      email:         data.email,
      mat_khau:      data.password,
      ho_ten:        data.ho_ten,
      so_dien_thoai: data.so_dien_thoai,
    })
  },
}
