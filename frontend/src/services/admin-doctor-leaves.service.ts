import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'
import type { ApproveDoctorLeaveResult, PendingDoctorLeave } from '@/services/receptionist-doctor-leaves.service'

export interface AdminDoctorLeave extends PendingDoctorLeave {
  nguoi_duyet_id?: string | null
  thoi_diem_duyet?: string | null
  ghi_chu?: string | null
}

export const adminDoctorLeavesService = {
  async list(filters?: { trang_thai?: string; bac_si_id?: string }): Promise<AdminDoctorLeave[]> {
    const res = await axiosInstance.get<ApiResponse<AdminDoctorLeave[]>>('/admin/doctor-leaves', { params: filters })
    return Array.isArray(res.data.data) ? res.data.data : []
  },

  async getPendingCount(): Promise<number> {
    const res = await axiosInstance.get<ApiResponse<AdminDoctorLeave[]>>('/admin/doctor-leaves', { params: { trang_thai: 'cho_duyet' } })
    const data = Array.isArray(res.data.data) ? res.data.data : []
    return data.length
  },

  async create(payload: { bac_si_id: string; tu_ngay: string; den_ngay: string; ly_do?: string; ghi_chu?: string }): Promise<AdminDoctorLeave> {
    const res = await axiosInstance.post<ApiResponse<AdminDoctorLeave>>('/admin/doctor-leaves', payload)
    return res.data.data
  },

  async approve(id: string, ghi_chu?: string): Promise<ApproveDoctorLeaveResult> {
    const res = await axiosInstance.patch<ApiResponse<ApproveDoctorLeaveResult>>(`/admin/doctor-leaves/${id}/approve`, { ghi_chu })
    return res.data.data
  },

  async reject(id: string, ghi_chu: string): Promise<AdminDoctorLeave> {
    const res = await axiosInstance.patch<ApiResponse<AdminDoctorLeave>>(`/admin/doctor-leaves/${id}/reject`, { ghi_chu })
    return res.data.data
  },
}
