import axiosInstance from './axiosInstance'
import type { ApiResponse, DoctorAppointmentDetail, AppointmentStatus, PaymentStatus, KetQuaKhamStatus, DoctorPendingRecord } from '@/types'

interface Filters {
  status?: AppointmentStatus | ''
  date?: string
}

export const doctorAppointmentService = {
  async getAll({ status = '', date = '' }: Filters = {}): Promise<DoctorAppointmentDetail[]> {
    const params: Record<string, string> = {}
    if (status) params.status = status
    if (date)   params.date   = date
    const res = await axiosInstance.get<ApiResponse<DoctorAppointmentDetail[]>>('/doctor/appointments', { params })
    return res.data.data
  },

  async getById(id: string | number): Promise<DoctorAppointmentDetail> {
    const res = await axiosInstance.get<ApiResponse<DoctorAppointmentDetail>>(`/doctor/appointments/${id}`)
    return res.data.data
  },

  async confirm(id: string | number): Promise<Partial<DoctorAppointmentDetail>> {
    const res = await axiosInstance.patch<ApiResponse<Partial<DoctorAppointmentDetail>>>(`/doctor/appointments/${id}/confirm`)
    return res.data.data
  },

  async complete(id: string | number): Promise<Partial<DoctorAppointmentDetail>> {
    const res = await axiosInstance.patch<ApiResponse<Partial<DoctorAppointmentDetail>>>(`/doctor/appointments/${id}/complete`)
    return res.data.data
  },

  // Từ chối lịch 'pending' (home) — dùng chung endpoint /cancel với cancelConfirmed
  // (backend tự phân biệt qua status/loai_kham hiện tại của lịch hẹn).
  async reject(id: string | number, ly_do: string): Promise<{ id: string | number; status: AppointmentStatus; payment_status: PaymentStatus }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; status: AppointmentStatus; payment_status: PaymentStatus }>>(`/doctor/appointments/${id}/cancel`, { ly_do })
    return res.data.data
  },

  // Hủy lịch 'confirmed' (khẩn cấp với clinic) — cùng endpoint /cancel như reject()
  async cancelConfirmed(id: string | number, ly_do: string): Promise<{ id: string | number; status: AppointmentStatus; payment_status: PaymentStatus }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; status: AppointmentStatus; payment_status: PaymentStatus }>>(`/doctor/appointments/${id}/cancel`, { ly_do })
    return res.data.data
  },

  // Xác nhận hồ sơ khám đang 'cho_xac_nhan' (WAITING_DOCTOR_CONFIRM) — backend có thể tự
  // chuyển lịch hẹn sang 'completed' nếu chưa completed, trả kèm appointment_status.
  async confirmResult(id: string | number): Promise<{ id: string; status: KetQuaKhamStatus; appointment_status: AppointmentStatus }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; status: KetQuaKhamStatus; appointment_status: AppointmentStatus }>>(`/doctor/appointments/${id}/result/confirm`)
    return res.data.data
  },

  // Yêu cầu chỉnh sửa lại hồ sơ khám đang 'cho_xac_nhan'
  async requestResultRevision(id: string | number, ly_do: string): Promise<{ id: string; status: KetQuaKhamStatus }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; status: KetQuaKhamStatus }>>(`/doctor/appointments/${id}/result/request-revision`, { ly_do })
    return res.data.data
  },

  // Danh sách hồ sơ khám 'cho_xac_nhan' (WAITING_DOCTOR_CONFIRM) của bác sĩ đang đăng nhập
  async listPendingResults(): Promise<DoctorPendingRecord[]> {
    const res = await axiosInstance.get<ApiResponse<DoctorPendingRecord[]>>('/doctor/appointments/pending-results')
    return res.data.data
  },
}
