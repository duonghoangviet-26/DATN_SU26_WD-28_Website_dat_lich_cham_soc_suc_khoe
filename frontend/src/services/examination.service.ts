import axiosInstance from './axiosInstance'
import type { ApiResponse, ExamRelatedService, ExaminationResult, PrescriptionDrug } from '@/types'

interface ExamPayload {
  appointment_id?: string | number
  queue_id?: string
  chan_doan: string
  huong_dan_dieu_tri?: string | null
  ghi_chu?: string | null
  ngay_tai_kham?: string | null
  thuoc?: Omit<PrescriptionDrug, 'id'>[]
  dich_vu_phat_sinh?: Array<{ service_id: string; so_luong: number }>
}

export const examinationService = {
  async getRelatedServices(params: { appointment_id?: string | number; queue_id?: string }): Promise<ExamRelatedService[]> {
    const res = await axiosInstance.get<ApiResponse<ExamRelatedService[]>>('/doctor/appointments/services/related', { params })
    return Array.isArray(res.data.data) ? res.data.data : []
  },

  async getByAppointment(appointmentId: string | number): Promise<ExaminationResult | null> {
    try {
      const res = await axiosInstance.get<ApiResponse<ExaminationResult>>(`/doctor/appointments/${appointmentId}/result`)
      return res.data.data
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } }).response?.status === 404) return null
      throw err
    }
  },

  async getByQueue(queueId: string): Promise<ExaminationResult | null> {
    try {
      const res = await axiosInstance.get<ApiResponse<ExaminationResult>>(`/doctor/appointments/records/${queueId}/result`)
      return res.data.data
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } }).response?.status === 404) return null
      throw err
    }
  },

  async save(data: ExamPayload): Promise<ExaminationResult> {
    const url = data.queue_id
      ? `/doctor/appointments/records/${data.queue_id}/result`
      : `/doctor/appointments/${data.appointment_id}/result`
    try {
      // Chưa có hồ sơ → tạo mới. Backend trả 409 nếu đã tồn tại (xem createResult).
      const res = await axiosInstance.post<ApiResponse<ExaminationResult>>(url, data)
      return res.data.data
    } catch (err: unknown) {
      if (!data.queue_id && (err as { response?: { status?: number } }).response?.status === 409) {
        const res = await axiosInstance.put<ApiResponse<ExaminationResult>>(url, data)
        return res.data.data
      }
      throw err
    }
  },
}
