import axios from 'axios'
import { mockDoctors } from '@/mock/doctors'
import { mockSpecialties } from '@/mock/hospitals'
import type { DoctorApproval, DoctorProfileAPI, DoctorDetailAPI, DoctorAuditLog, DoctorProfile } from '@/types'

// Note: Ensure your environment variable VITE_API_URL is set correctly (e.g. http://localhost:5000/api)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const BASE_URL = `${API_URL}/admin/doctors`

const delay = (ms = 300) => new Promise<void>(r => setTimeout(r, ms))

// Mock state — chỉ dùng cho updateServiceFields/getBySpecialtySlug bên dưới, 2 hàm này
// chưa có endpoint backend thật (xem docs/DB_CHANGES_MAIN_VS_QUANLYDICHVU.md).
let mockDoctorsState = [...mockDoctors]

export const doctorService = {
  // Lấy danh sách bác sĩ (có phân trang, tìm kiếm, lọc)
  async getAll(params?: {
    trang_thai?: DoctorApproval | ''
    chuyen_khoa?: string
    keyword?: string
    page?: number
    limit?: number
  }): Promise<{ doctors: DoctorProfileAPI[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const { data } = await axios.get(BASE_URL, { params })
    return data.data
  },

  // Lấy chi tiết một bác sĩ
  async getById(id: string): Promise<DoctorDetailAPI> {
    const { data } = await axios.get(`${BASE_URL}/${id}`)
    return data.data
  },

  // Lấy lịch sử thao tác của bác sĩ
  async getLogs(id: string): Promise<DoctorAuditLog[]> {
    const { data } = await axios.get(`${BASE_URL}/${id}/logs`)
    return data.data
  },

  // Duyệt hồ sơ bác sĩ
  async approve(id: string, adminId: string): Promise<DoctorDetailAPI> {
    const { data } = await axios.put(`${BASE_URL}/${id}/approve`, { admin_id: adminId })
    return data.data
  },

  // Từ chối hồ sơ bác sĩ
  async reject(id: string, adminId: string, ly_do: string): Promise<DoctorDetailAPI> {
    const { data } = await axios.put(`${BASE_URL}/${id}/reject`, { admin_id: adminId, ly_do })
    return data.data
  },

  // Tạm ngưng bác sĩ
  async suspend(id: string, adminId: string, ly_do: string): Promise<DoctorDetailAPI & { canh_bao?: string | null }> {
    const { data } = await axios.put(`${BASE_URL}/${id}/suspend`, { admin_id: adminId, ly_do })
    return data.data
  },

  // Khôi phục bác sĩ
  async restore(id: string, adminId: string): Promise<DoctorDetailAPI> {
    const { data } = await axios.put(`${BASE_URL}/${id}/restore`, { admin_id: adminId })
    return data.data
  },

  // Cập nhật thông tin chuyên môn bác sĩ
  async update(id: string, payload: any): Promise<DoctorDetailAPI> {
    const { data } = await axios.put(`${BASE_URL}/${id}`, payload)
    return data.data
  },

  // Lấy lịch sử đặt lịch của bác sĩ
  async getAppointments(id: string, params?: {
    keyword?: string
    page?: number
    limit?: number
    date?: string
    exclude_status?: string
  }): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const { data } = await axios.get(`${BASE_URL}/${id}/appointments`, { params })
    return { data: data.data, pagination: data.pagination }
  },

  // Xóa vĩnh viễn bác sĩ
  async delete(id: string): Promise<any> {
    const { data } = await axios.delete(`${BASE_URL}/${id}`)
    return data.data
  },

  // Sửa nhanh field liên quan dịch vụ (giá khám, bảo hiểm, dịch vụ liên quan đã áp dụng)
  // — dùng từ trang Quản lý dịch vụ > chi tiết chuyên khoa. Không sửa hồ sơ bác sĩ (bằng cấp, kinh nghiệm...).
  // MOCK — chưa có endpoint backend thật.
  async updateServiceFields(id: string, data: {
    gia_kham: number
    bao_hiem: { nha_nuoc: boolean; bao_lanh: boolean }
    related_services: { id: string; ten: string; gia: number }[]
  }): Promise<DoctorProfile> {
    await delay()
    const doc = mockDoctorsState.find(d => String(d.id) === String(id))
    if (!doc) throw new Error('Không tìm thấy bác sĩ')
    doc.gia_kham = data.gia_kham
    doc.bao_hiem = data.bao_hiem
    doc.related_services = data.related_services
    return { ...doc }
    // Real API:
    // const res = await axiosInstance.patch<ApiResponse<DoctorProfile>>(`/admin/doctors/${id}/service-fields`, data)
    // return res.data.data
  },

  // Tầng 3 — danh sách bác sĩ approved theo chuyên khoa (client, dùng slug)
  // MOCK — chưa có endpoint backend thật (client public, không phải /admin/doctors).
  async getBySpecialtySlug(slug: string): Promise<DoctorProfile[]> {
    await delay()
    const specialty = mockSpecialties.find((s) => s.slug === slug && s.status === 'active')
    if (!specialty) return []
    return mockDoctorsState.filter(
      (d) => d.trang_thai_duyet === 'approved' && d.loai !== 'home_staff' && d.chuyen_khoa === specialty.ten,
    )
    // Real API:
    // const res = await axiosInstance.get<ApiResponse<DoctorProfile[]>>(`/specialties/${slug}/doctors`)
    // return res.data.data
  },

  // Toàn bộ bác sĩ (mọi trạng thái duyệt) — MOCK, dùng riêng cho trang Quản lý dịch vụ >
  // chi tiết chuyên khoa (ManageServiceSpecialtyDetail.tsx) để hiển thị cả bác sĩ suspended
  // (cần thấy để bấm "Hiện" lại). Ngày demo 2026-07-04 chưa seed đủ dữ liệu thật nên giữ mock —
  // KHÔNG dùng getAll() (đã gắn API thật, dùng cho trang Quản lý bác sĩ) để tránh xung đột.
  async getAllMock(): Promise<DoctorProfile[]> {
    await delay()
    return [...mockDoctorsState]
  },

  // Ẩn bác sĩ (approved → suspended) — MOCK, dùng riêng cho Quản lý dịch vụ (xem getAllMock).
  async suspendMock(id: string): Promise<DoctorProfile> {
    await delay()
    const doc = mockDoctorsState.find(d => String(d.id) === String(id))
    if (!doc) throw new Error('Không tìm thấy bác sĩ')
    doc.trang_thai_duyet = 'suspended'
    return { ...doc }
  },

  // Hiện lại bác sĩ (suspended → approved) — MOCK, dùng riêng cho Quản lý dịch vụ (xem getAllMock).
  async restoreMock(id: string): Promise<DoctorProfile> {
    await delay()
    const doc = mockDoctorsState.find(d => String(d.id) === String(id))
    if (!doc) throw new Error('Không tìm thấy bác sĩ')
    doc.trang_thai_duyet = 'approved'
    return { ...doc }
  },
}
