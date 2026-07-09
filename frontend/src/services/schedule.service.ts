import axiosInstance from './axiosInstance'
import type { ApiResponse, DoctorSlot } from '@/types'

// Bác sĩ KHÔNG được tự tạo/sửa phòng/khóa-mở ca/xóa ca (spec v3, "Chống gian lận").
// Lịch do hệ thống tự sinh — xem scheduleGenerator.service.js (backend, admin/hệ thống).
// Service này chỉ còn 2 việc: đọc lịch của chính mình, và yêu cầu hủy 1 ca đã có bệnh nhân đặt.
export const scheduleService = {
  async getAll(params?: { from?: string; to?: string }): Promise<DoctorSlot[]> {
    const res = await axiosInstance.get<ApiResponse<DoctorSlot[]>>('/doctor/schedule', { params })
    return res.data.data
  },

  async requestCancelSlot(slot: DoctorSlot, ly_do: string): Promise<void> {
    await axiosInstance.post(`/doctor/schedule/${slot.schedule_id}/slots/${slot.id}/request-cancel`, { ly_do })
  },
}
