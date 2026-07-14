import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'

export interface ReceptionistBookingDoctor {
  id: string
  ho_ten: string
  anh_dai_dien?: string | null
  gia_kham: number
  so_nam_kinh_nghiem: number
  diem_danh_gia: number
  tong_danh_gia: number
  tuoi_nhan_kham_tu: number
  tieu_su?: string | null
  specialties: { id: string; ten: string }[]
}

export interface ReceptionistBookingSlot {
  id: string
  schedule_id: string
  gio_bat_dau: string
  gio_ket_thuc: string
  phong_kham?: string | null
}

export interface CreateReceptionistBookingPayload {
  doctor_id: string
  schedule_id: string
  slot_id: string
  ngay_kham: string
  ten_khach: string
  so_dien_thoai_khach: string
  payment_method: 'cash' | 'transfer'
}

export interface CreatedReceptionistBookingResult {
  appointment_id: string
  payment_id: string
  qr_payload: string | null
}

export const receptionistBookingService = {
  async getDoctors(): Promise<ReceptionistBookingDoctor[]> {
    const res = await axiosInstance.get<ApiResponse<ReceptionistBookingDoctor[]>>('/receptionist/booking/doctors')
    return Array.isArray(res.data.data) ? res.data.data : []
  },

  async getSlots(doctorId: string, date: string): Promise<ReceptionistBookingSlot[]> {
    const res = await axiosInstance.get<ApiResponse<ReceptionistBookingSlot[]>>(`/receptionist/booking/doctors/${doctorId}/slots`, {
      params: { date },
    })
    return Array.isArray(res.data.data) ? res.data.data : []
  },

  async createBooking(payload: CreateReceptionistBookingPayload): Promise<CreatedReceptionistBookingResult> {
    const res = await axiosInstance.post<ApiResponse<CreatedReceptionistBookingResult>>('/receptionist/booking', payload)
    return res.data.data as CreatedReceptionistBookingResult
  }
}
