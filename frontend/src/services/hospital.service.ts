import { mockHospitals, mockSpecialties } from '@/mock/hospitals'
import type { HospitalItem, SpecialtyItem } from '@/types'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

let specialties = [...mockSpecialties]

// Phòng khám tư 1 cơ sở — getHospitals/toggleHospital giữ lại để không phá vỡ UI placeholder C3.
export const hospitalService = {
  async getHospitals(): Promise<HospitalItem[]> {
    await delay()
    return [...mockHospitals]
  },

  async toggleHospital(_id: number): Promise<HospitalItem | null> {
    await delay()
    return null
  },

  async getSpecialties(): Promise<SpecialtyItem[]> {
    await delay()
    return [...specialties]
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<SpecialtyItem[]>>('/admin/specialties')
    // return res.data.data
  },

  async toggleSpecialty(id: string): Promise<SpecialtyItem> {
    await delay()
    const item = specialties.find(s => String(s.id) === String(id))
    if (!item) throw new Error('Không tìm thấy chuyên khoa')
    item.status = item.status === 'active' ? 'hidden' : 'active'
    return { ...item }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<SpecialtyItem>>(`/admin/specialties/${id}/toggle`)
    // return res.data.data
  },
}
