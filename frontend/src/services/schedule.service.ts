import axiosInstance from './axiosInstance'
import type { ApiResponse, DoctorSlot, DoctorScheduleDetail } from '@/types'

// Bác sĩ KHÔNG được tự tạo/sửa phòng/khóa-mở ca/xóa ca (spec v3, "Chống gian lận").
// Lịch do hệ thống tự sinh — xem scheduleGenerator.service.js (backend, admin/hệ thống).
// Service này chỉ còn 3 việc: đọc lịch của chính mình, xem chi tiết 1 ngày làm việc,
// và yêu cầu hủy 1 ca đã có bệnh nhân đặt.
export const scheduleService = {
  // signal: cho phép hủy request cũ khi bác sĩ chuyển tuần nhanh (tránh response cũ ghi
  // đè response mới — race condition khi bấm "Tuần sau" liên tục).
  async getAll(params?: { from?: string; to?: string }, signal?: AbortSignal): Promise<DoctorSlot[]> {
    const res = await axiosInstance.get<ApiResponse<DoctorSlot[]>>('/doctor/schedule', { params, signal })
    return res.data.data
  },

  async getDetail(scheduleId: string, signal?: AbortSignal): Promise<DoctorScheduleDetail> {
    const res = await axiosInstance.get<ApiResponse<DoctorScheduleDetail>>(`/doctor/schedule/${scheduleId}`, { signal })
    return res.data.data
  },

  async requestCancelSlot(slot: DoctorSlot, ly_do: string): Promise<void> {
    await axiosInstance.post(`/doctor/schedule/${slot.schedule_id}/slots/${slot.id}/request-cancel`, { ly_do })
  },
}
