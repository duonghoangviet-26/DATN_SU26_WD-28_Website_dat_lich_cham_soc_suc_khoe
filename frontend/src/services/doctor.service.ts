import axios from 'axios'
import type { DoctorApproval, DoctorProfileAPI, DoctorDetailAPI, DoctorAuditLog } from '@/types'

// Note: Ensure your environment variable VITE_API_URL is set correctly (e.g. http://localhost:5000/api)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const BASE_URL = `${API_URL}/admin/doctors`

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
  }): Promise<{ data: any[]; pagination: { total: number; page: number; limit: number; totalPages: number } }> {
    const { data } = await axios.get(`${BASE_URL}/${id}/appointments`, { params })
    return { data: data.data, pagination: data.pagination }
  }
}
