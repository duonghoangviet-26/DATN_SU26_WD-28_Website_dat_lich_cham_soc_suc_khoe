import axiosInstance from '@/services/axiosInstance'
import type {
  AdminDoctorScheduleAuditResponse,
  AdminDoctorScheduleDetail,
  AdminDoctorScheduleSlot,
  AdminDoctorWorkdayItem,
  AdminDoctorWorkdayResponse,
  ApiResponse,
} from '@/types'

export const adminDoctorScheduleService = {
  async getWorkdays(params: {
    doctor_id: string
    from?: string
    to?: string
  }): Promise<AdminDoctorWorkdayResponse> {
    const res = await axiosInstance.get<ApiResponse<AdminDoctorWorkdayResponse>>('/admin/slots/calendar', { params })
    return res.data.data
  },

  async updateWorkday(
    scheduleId: string,
    data: { trang_thai_ngay: 'lam_viec' | 'nghi' | 'nghi_phep'; ghi_chu_ngay?: string }
  ): Promise<AdminDoctorWorkdayItem> {
    const res = await axiosInstance.patch<ApiResponse<AdminDoctorWorkdayItem>>(`/admin/slots/${scheduleId}/workday`, data)
    return res.data.data
  },

  async ensureWorkday(data: {
    doctor_id: string
    ngay: string
    chi_nhanh_id?: string | null
    specialty_id?: string | null
    phong_kham?: string | null
    trang_thai_ngay?: 'lam_viec' | 'nghi' | 'nghi_phep'
    ghi_chu_ngay?: string
  }): Promise<AdminDoctorWorkdayItem & { reused?: boolean }> {
    const res = await axiosInstance.post<ApiResponse<AdminDoctorWorkdayItem & { reused?: boolean }>>('/admin/slots/ensure-day', data)
    return res.data.data
  },

  async getScheduleById(scheduleId: string): Promise<AdminDoctorScheduleDetail> {
    const res = await axiosInstance.get<ApiResponse<AdminDoctorScheduleDetail>>(`/admin/slots/${scheduleId}`)
    return res.data.data
  },

  async updateSlot(
    scheduleId: string,
    slotId: string,
    data: Partial<AdminDoctorScheduleSlot>
  ): Promise<AdminDoctorScheduleDetail> {
    const res = await axiosInstance.patch<ApiResponse<AdminDoctorScheduleDetail>>(`/admin/slots/${scheduleId}/slots/${slotId}`, data)
    return res.data.data
  },

  async getAuditLogs(params: {
    schedule_id?: string
    doctor_id?: string
    from?: string
    to?: string
    page?: number
    limit?: number
  }): Promise<AdminDoctorScheduleAuditResponse> {
    const res = await axiosInstance.get<ApiResponse<AdminDoctorScheduleAuditResponse>>('/admin/slots/audit-logs', { params })
    return res.data.data
  },
}
