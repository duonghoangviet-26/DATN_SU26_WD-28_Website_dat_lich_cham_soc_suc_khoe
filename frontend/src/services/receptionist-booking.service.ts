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
  ly_do_kham?: string
  payment_method: 'cash' | 'transfer'
}

export interface CreatedReceptionistBookingResult {
  appointment_id: string
  payment_id: string
  qr_payload: string | null
}

export interface ReceptionistPaymentGatewaySnapshot {
  provider: string | null
  mode: string | null
  payment_url: string | null
  qr_payload: string | null
  expires_at: string | null
  vnp_txn_ref: string | null
  bank_code: string | null
  locale: string | null
  merchant_name: string | null
  merchant_code: string | null
  note: string | null
  mock_status: string | null
  is_expired: boolean
}

export interface ReceptionistPaymentStatusResult {
  payment_id: string
  appointment_id: string
  hoa_don_id: string | null
  ma_giao_dich: string
  so_tien: number
  payment_status: string
  appointment_status: string | null
  appointment_payment_status: string | null
  invoice_status: string | null
  ngay_thanh_toan: string | null
  phuong_thuc: string
  gateway: ReceptionistPaymentGatewaySnapshot
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
  },

  async createVnpaySession(paymentId: string): Promise<ReceptionistPaymentStatusResult> {
    const res = await axiosInstance.post<ApiResponse<ReceptionistPaymentStatusResult>>(`/receptionist/payments/${paymentId}/vnpay-session`)
    return res.data.data
  },

  async getPaymentStatus(paymentId: string): Promise<ReceptionistPaymentStatusResult> {
    const res = await axiosInstance.get<ApiResponse<ReceptionistPaymentStatusResult>>(`/receptionist/payments/${paymentId}/status`)
    return res.data.data
  },

  async completeMockVnpayPayment(paymentId: string): Promise<ReceptionistPaymentStatusResult> {
    const res = await axiosInstance.post<ApiResponse<ReceptionistPaymentStatusResult>>(`/receptionist/payments/${paymentId}/vnpay/mock-complete`)
    return res.data.data
  }
}

