import axiosInstance from './axiosInstance'
import { mockDoctorProfile, mockDoctorProfileExtra } from '@/mock/doctor-stats'
import type { ApiResponse, DoctorStats, DoctorReview, DoctorTodayOverview } from '@/types'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

let profile = { ...mockDoctorProfile, ...mockDoctorProfileExtra }

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
  specialties?: string[]
  services?: string[]
}

export const doctorProfileService = {
  async get() {
    await delay()
    return { ...profile }
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<Record<string, unknown>>>('/doctor/profile')
    // return res.data.data
  },

  async update(data: ProfileUpdateData) {
    await delay()
    profile = { ...profile, ...data }
    return { ...profile }
    // Real API:
    // const res = await axiosInstance.put<ApiResponse<Record<string, unknown>>>('/doctor/profile', data)
    // return res.data.data
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
