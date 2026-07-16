import axiosInstance from './axiosInstance'
import type { ApiResponse, ExaminationResult, PrescriptionDrug } from '@/types'

interface ExamPayload {
  appointment_id: string | number
  chan_doan: string
  huong_dan_dieu_tri?: string | null
  ghi_chu?: string | null
  ngay_tai_kham?: string | null
  thuoc?: Omit<PrescriptionDrug, 'id'>[]
}

export const examinationService = {
  async getByAppointment(appointmentId: string | number): Promise<ExaminationResult | null> {
    try {
      const res = await axiosInstance.get<ApiResponse<ExaminationResult>>(`/doctor/appointments/${appointmentId}/result`)
      return res.data.data
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } }).response?.status === 404) return null
      throw err
    }
  },

  async save(data: ExamPayload): Promise<ExaminationResult> {
    const url = `/doctor/appointments/${data.appointment_id}/result`
    try {
      // Chưa có hồ sơ → tạo mới. Backend trả 409 nếu đã tồn tại (xem createResult).
      const res = await axiosInstance.post<ApiResponse<ExaminationResult>>(url, data)
      return res.data.data
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } }).response?.status === 409) {
        const res = await axiosInstance.put<ApiResponse<ExaminationResult>>(url, data)
        return res.data.data
      }
      throw err
    }
  },
}
