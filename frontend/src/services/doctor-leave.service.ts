import axiosInstance from './axiosInstance'
import type { ApiResponse, DoctorLeaveRequest } from '@/types'

export const doctorLeaveService = {
  async list(): Promise<DoctorLeaveRequest[]> {
    const res = await axiosInstance.get<ApiResponse<DoctorLeaveRequest[]>>('/doctor/leaves')
    return res.data.data
  },

  async create(
    tu_ngay: string,
    den_ngay: string,
    ly_do: string,
    gio_bat_dau?: string | null,
    gio_ket_thuc?: string | null
  ): Promise<DoctorLeaveRequest> {
    const res = await axiosInstance.post<ApiResponse<DoctorLeaveRequest>>('/doctor/leaves', {
      tu_ngay, den_ngay, ly_do, gio_bat_dau, gio_ket_thuc,
    })
    return res.data.data
  },

  async cancel(id: string): Promise<DoctorLeaveRequest> {
    const res = await axiosInstance.patch<ApiResponse<DoctorLeaveRequest>>(`/doctor/leaves/${id}/cancel`)
    return res.data.data
  },
}
