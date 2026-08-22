import axiosInstance from './axiosInstance'
import type { User, ApiResponse } from '@/types'

/**
 * SERVICE: Xác thực (Đăng nhập / Đăng ký)
 */

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
  /**
   * Đăng nhập hệ thống
   */
  async login({ email, password }: LoginCredentials): Promise<LoginResult> {
    const res = await axiosInstance.post<ApiResponse<LoginResult>>('/auth/login', {
      email,
      mat_khau: password,
    })
    return res.data.data
  },

  /**
   * Đăng ký tài khoản mới (Bệnh nhân)
   */
  async register(data: RegisterData): Promise<void> {
    await axiosInstance.post<ApiResponse<unknown>>('/auth/register', {
      email:         data.email,
      mat_khau:      data.password,
      ho_ten:        data.ho_ten,
      so_dien_thoai: data.so_dien_thoai,
    })
  },

  /**
   * Quên mật khẩu - Yêu cầu cấp mã reset
   */
  async forgotPassword(email: string): Promise<any> {
    const res = await axiosInstance.post<ApiResponse<any>>('/auth/forgot-password', {
      email,
    })
    return res.data
  },

  /**
   * Đặt lại mật khẩu mới với token
   */
  async resetPassword(token: string, matKhauMoi: string): Promise<any> {
    const res = await axiosInstance.post<ApiResponse<any>>('/auth/reset-password', {
      token,
      mat_khau_moi: matKhauMoi,
    })
    return res.data
  },

  /**
   * Đăng nhập / Đăng ký bằng Google OAuth 2.0
   */
  async loginWithGoogle(credential: string): Promise<LoginResult> {
    const res = await axiosInstance.post<ApiResponse<LoginResult>>('/auth/google', {
      credential,
    })
    return res.data.data
  },

  /**
   * Cập nhật thông tin Onboarding (Bổ sung SĐT cho tài khoản Google)
   */
  async updateOnboarding(data: { so_dien_thoai: string; ho_ten?: string }): Promise<User> {
    const res = await axiosInstance.post<ApiResponse<User>>('/auth/update-onboarding', data)
    return res.data.data
  },

  async getProfile(): Promise<User> {
    const res = await axiosInstance.get<ApiResponse<User>>('/auth/profile')
    return res.data.data
  },

  async updateProfile(data: {
    ho_ten: string
    so_dien_thoai: string
    ngay_sinh?: string | null
    gioi_tinh?: 'nam' | 'nu' | 'khac' | null
    nhom_mau?: 'A' | 'B' | 'AB' | 'O' | null
    di_ung?: string | null
    benh_nen?: string | null
    dia_chi?: string | null
    ghi_chu?: string | null
  }): Promise<User> {
    const res = await axiosInstance.put<ApiResponse<User>>('/auth/profile', data)
    return res.data.data
  },

  /**
   * Đăng xuất hệ thống & thu hồi session
   */
  async logout(): Promise<void> {
    await axiosInstance.post<ApiResponse<void>>('/auth/logout')
  },

  /**
   * Đổi mật khẩu chủ động (khi đang đăng nhập)
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await axiosInstance.post('/auth/change-password', {
      oldPassword,
      newPassword,
    })
  },

  async setup2FA(): Promise<{ qrCodeUrl: string; secret: string }> {
    const res = await axiosInstance.get<ApiResponse<{ qrCodeUrl: string; secret: string }>>('/auth/2fa/setup')
    return res.data.data
  },

  async verify2FA(token: string): Promise<void> {
    await axiosInstance.post<ApiResponse<void>>('/auth/2fa/verify', { token })
  },
}
