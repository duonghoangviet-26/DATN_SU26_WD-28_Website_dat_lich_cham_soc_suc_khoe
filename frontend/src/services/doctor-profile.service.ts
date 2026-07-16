import axiosInstance from './axiosInstance'
import type { ApiResponse, DoctorStats, DoctorReview, DoctorTodayOverview, DoctorSelfProfile } from '@/types'

interface ProfileUpdateData {
  ho_ten?: string
  so_dien_thoai?: string | null
  anh_dai_dien?: string | null
  tieu_su?: string | null
  bang_cap?: string | null
  kinh_nghiem?: string | null
  so_nam_kinh_nghiem?: number
  gia_kham?: number
  tuoi_nhan_kham_tu?: number
}

export const doctorProfileService = {
  async get(): Promise<DoctorSelfProfile> {
    const res = await axiosInstance.get<ApiResponse<DoctorSelfProfile>>('/doctor/profile')
    return res.data.data
  },

  async update(data: ProfileUpdateData): Promise<DoctorSelfProfile> {
    const res = await axiosInstance.put<ApiResponse<DoctorSelfProfile>>('/doctor/profile', data)
    return res.data.data
  },

  async getStats(): Promise<DoctorStats> {
    const res = await axiosInstance.get<ApiResponse<DoctorStats>>('/doctor/stats')
    return res.data.data
  },

  async getReviews(): Promise<DoctorReview[]> {
    const res = await axiosInstance.get<ApiResponse<DoctorReview[]>>('/doctor/stats/reviews')
    return res.data.data
  },

  async getTodayOverview(): Promise<DoctorTodayOverview> {
    const res = await axiosInstance.get<ApiResponse<DoctorTodayOverview>>('/doctor/stats/today')
    return res.data.data
  },
}
