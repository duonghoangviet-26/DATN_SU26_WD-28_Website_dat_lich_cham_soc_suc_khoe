import axiosInstance from './axiosInstance'
import type { ApiResponse, DoctorAppointmentDetail, AppointmentStatus, PaymentStatus, KetQuaKhamStatus, DoctorPendingRecord, ExamResultEditPayload, DoctorExamQueueRow } from '@/types'

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

  // "Lưu & Xác nhận" hồ sơ khám đang 'cho_xac_nhan' — bác sĩ có thể gửi kèm chỉnh sửa trực tiếp
  // (chẩn đoán/hướng dẫn/ghi chú/ngày tái khám/đơn thuốc) trong cùng thao tác, backend áp dụng
  // trước khi chốt da_xac_nhan (xem confirmResult ở BE). payload tùy chọn — bỏ qua = chỉ xác nhận.
  // Thay cho luồng "yêu cầu chỉnh sửa" (đẩy về y tá) đã gỡ 2026-07-16.
  async confirmResult(
    id: string | number,
    payload?: ExamResultEditPayload,
  ): Promise<{ id: string; status: KetQuaKhamStatus; appointment_status: AppointmentStatus }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; status: KetQuaKhamStatus; appointment_status: AppointmentStatus }>>(
      `/doctor/appointments/${id}/result/confirm`,
      payload,
    )
    return res.data.data
  },

  // Không truyền status: chỉ hồ sơ 'cho_xac_nhan' (dùng cho thẻ thống kê Dashboard — không đổi).
  // status='all': cả 3 trạng thái liên quan bác sĩ (chờ xác nhận/đã xác nhận/cần chỉnh sửa) —
  // dùng cho trang "Hồ sơ chờ xác nhận" để bác sĩ tra cứu lại hồ sơ đã xử lý.
  async listPendingResults(status?: 'all' | KetQuaKhamStatus): Promise<DoctorPendingRecord[]> {
    const params = status ? { status } : undefined
    const res = await axiosInstance.get<ApiResponse<DoctorPendingRecord[]>>('/doctor/appointments/pending-results', { params })
    return res.data.data
  },

  // Hàng đợi khám của bác sĩ (online + offline gộp chung, trang "Hồ sơ chờ khám").
  async getExamQueue(date?: string): Promise<DoctorExamQueueRow[]> {
    const res = await axiosInstance.get<ApiResponse<DoctorExamQueueRow[]>>('/doctor/queue', { params: date ? { date } : {} })
    return Array.isArray(res.data.data) ? res.data.data : []
  },

  // Xác nhận nhanh hồ sơ vãng lai (offline) theo ket_qua_id — không cần appointment_id.
  async confirmResultByRecord(ketQuaId: string, body: Record<string, unknown> = {}): Promise<unknown> {
    const res = await axiosInstance.patch<ApiResponse<unknown>>(`/doctor/appointments/result/${ketQuaId}/confirm-by-record`, body)
    return res.data.data
  },
}
