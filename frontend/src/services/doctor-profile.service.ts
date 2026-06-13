import type { DoctorProfile } from '@/types'
import { mockDoctorProfile, mockDoctorProfileExtra, mockDoctorStats, mockDoctorReviews } from '@/mock/doctor-stats'
import type { DoctorStats, DoctorReview } from '@/types'
import { delay } from '@/utils/format'

let profile = { ...mockDoctorProfile }
let extra = { ...mockDoctorProfileExtra }

interface ProfileUpdateData {
  ho_ten?: string
  chuyen_khoa?: string
  so_nam_kinh_nghiem?: number
  phi_tu_van?: number
  bang_cap?: string
  tieu_su?: string
}

export const doctorProfileService = {
  async get(): Promise<{ profile: DoctorProfile; tieu_su: string; benh_vien_chinh: string }> {
    await delay()
    return { profile: { ...profile }, tieu_su: extra.tieu_su, benh_vien_chinh: extra.benh_vien_chinh }
  },

  async update(data: ProfileUpdateData): Promise<DoctorProfile> {
    await delay(300)
    profile = { ...profile, ...data }
    if (data.tieu_su !== undefined) extra = { ...extra, tieu_su: data.tieu_su }
    return { ...profile }
  },

  async submitForReview(): Promise<DoctorProfile> {
    await delay(400)
    profile = { ...profile, trang_thai_duyet: 'pending' }
    return { ...profile }
  },

  async getStats(): Promise<DoctorStats> {
    await delay()
    return { ...mockDoctorStats }
  },

  async getReviews(): Promise<DoctorReview[]> {
    await delay()
    return [...mockDoctorReviews]
  },
}
