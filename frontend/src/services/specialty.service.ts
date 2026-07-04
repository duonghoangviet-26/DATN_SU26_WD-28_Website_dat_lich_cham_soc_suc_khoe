import { mockSpecialties } from '@/mock/hospitals'
import { mockDoctors } from '@/mock/doctors'

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

export interface SpecialtyOption {
  id: string
  ten: string
}

// ViewModel cho trang duyệt dịch vụ (client) — nhiều field hơn SpecialtyOption
export interface SpecialtyBrowseItem {
  id: string
  ten: string
  mo_ta: string
  icon_url: string
  slug: string
  so_bac_si: number
}

function countApprovedDoctors(specialtyTen: string): number {
  return mockDoctors.filter(
    (d) => d.trang_thai_duyet === 'approved' && d.chuyen_khoa === specialtyTen,
  ).length
}

export const specialtyService = {
  async getAll(): Promise<SpecialtyOption[]> {
    await delay()
    return mockSpecialties
      .filter(s => s.status === 'active')
      .map(s => ({ id: String(s.id), ten: s.ten }))
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<SpecialtyOption[]>>('/admin/specialties')
    // return res.data.data
  },

  // Tầng 2 — danh sách chuyên khoa cho trang duyệt dịch vụ (client)
  async getAllActive(): Promise<SpecialtyBrowseItem[]> {
    await delay()
    return mockSpecialties
      .filter((s) => s.status === 'active')
      .sort((a, b) => a.thu_tu - b.thu_tu)
      .map((s) => ({
        id: String(s.id),
        ten: s.ten,
        mo_ta: s.mo_ta,
        icon_url: s.icon_url,
        slug: s.slug,
        so_bac_si: countApprovedDoctors(s.ten),
      }))
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<SpecialtyBrowseItem[]>>('/specialties')
    // return res.data.data
  },

  // Tầng 3 — chi tiết 1 chuyên khoa theo slug (dùng làm tiêu đề trang danh sách bác sĩ)
  async getBySlug(slug: string): Promise<SpecialtyBrowseItem | null> {
    await delay()
    const found = mockSpecialties.find((s) => s.slug === slug && s.status === 'active')
    if (!found) return null
    return {
      id: String(found.id),
      ten: found.ten,
      mo_ta: found.mo_ta,
      icon_url: found.icon_url,
      slug: found.slug,
      so_bac_si: countApprovedDoctors(found.ten),
    }
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<SpecialtyBrowseItem>>(`/specialties/${slug}`)
    // return res.data.data
  },
}
