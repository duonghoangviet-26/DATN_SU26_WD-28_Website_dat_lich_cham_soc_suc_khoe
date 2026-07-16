import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'

export interface PatientBookingDoctor {
  id: string
  ho_ten: string
  anh_dai_dien?: string | null
  gia_kham: number
  so_nam_kinh_nghiem: number
  diem_danh_gia: number
  tong_danh_gia: number
  tuoi_nhan_kham_tu: number
  tieu_su?: string | null
  bang_cap?: string | null
  kinh_nghiem?: string | null
  phong_kham_mac_dinh?: string | null
  specialties: { id: string; ten: string }[]
}

export interface PatientBookingSlot {
  id: string
  schedule_id: string
  gio_bat_dau: string
  gio_ket_thuc: string
  phong_kham?: string | null
}

export interface FamilyMember {
  id: string
  ho_ten: string
  ngay_sinh: string
  gioi_tinh: 'nam' | 'nu' | 'khac'
  nhom_mau?: string | null
  di_ung?: string | null
  benh_nen?: string | null
  la_chu_ho: boolean
}

export interface FamilyGroup {
  id: string
  ten_nhom: string
  members: FamilyMember[]
}

export interface CreateBookingPayload {
  loai_kham: 'clinic'
  doctor_id: string
  schedule_id: string
  slot_id: string
  ngay_kham: string
  ly_do_kham: string
  ten_khach: string
  so_dien_thoai_khach: string
  member_id?: string | null
  phuong_thuc?: 'chuyen_khoan' | 'vi_dien_tu' | 'the_ngan_hang' | 'tien_mat'
}

export interface CreatedBookingResult {
  id: string
  appointment_id: string
  invoice_id: string
  payment_id: string
  so_hoa_don: string
  ma_giao_dich: string
  status: string
  payment_status: string
  payment_record_status: string
  invoice_status: string
  gia_kham: number
  ten_dich_vu: string
  ngay_kham: string
  gio_kham: string
}

export interface PatientPaymentGatewaySnapshot {
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

export interface PatientPaymentStatusResult {
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
  gateway: PatientPaymentGatewaySnapshot
}

export const patientBookingService = {
  async getDoctors(): Promise<PatientBookingDoctor[]> {
    const res = await axiosInstance.get<ApiResponse<PatientBookingDoctor[]>>('/patient/booking/doctors')
    return Array.isArray(res.data.data) ? res.data.data : []
  },

  async getDoctorById(id: string): Promise<PatientBookingDoctor> {
    const res = await axiosInstance.get<ApiResponse<PatientBookingDoctor>>(`/patient/booking/doctors/${id}`)
    return res.data.data
  },

  async getSlots(doctorId: string, date: string): Promise<PatientBookingSlot[]> {
    const res = await axiosInstance.get<ApiResponse<PatientBookingSlot[]>>(`/patient/booking/doctors/${doctorId}/slots`, {
      params: { date },
    })
    return Array.isArray(res.data.data) ? res.data.data : []
  },

  async createBooking(payload: CreateBookingPayload): Promise<CreatedBookingResult> {
    const res = await axiosInstance.post<ApiResponse<CreatedBookingResult>>('/patient/booking', payload)
    return res.data.data
  },

  async createVnpaySession(paymentId: string): Promise<PatientPaymentStatusResult> {
    const res = await axiosInstance.post<ApiResponse<PatientPaymentStatusResult>>(`/patient/payments/${paymentId}/vnpay-session`)
    return res.data.data
  },

  async getPaymentStatus(paymentId: string): Promise<PatientPaymentStatusResult> {
    const res = await axiosInstance.get<ApiResponse<PatientPaymentStatusResult>>(`/patient/payments/${paymentId}/status`)
    return res.data.data
  },

  async completeMockVnpayPayment(paymentId: string): Promise<PatientPaymentStatusResult> {
    const res = await axiosInstance.post<ApiResponse<PatientPaymentStatusResult>>(`/patient/payments/${paymentId}/vnpay/mock-complete`)
    return res.data.data
  },

  async getDoctorReviews(doctorId: string): Promise<any[]> {
    const res = await axiosInstance.get<ApiResponse<any[]>>(`/patient/booking/doctors/${doctorId}/reviews`)
    return res.data.data
  },

  async createDoctorReview(doctorId: string, payload: { so_sao: number; noi_dung: string }): Promise<any> {
    const res = await axiosInstance.post<ApiResponse<any>>(`/patient/booking/doctors/${doctorId}/reviews`, payload)
    return res.data.data
  },

  async confirmPayment(paymentId: string): Promise<PatientPaymentStatusResult> {
    const res = await axiosInstance.patch<ApiResponse<PatientPaymentStatusResult>>(`/patient/payments/${paymentId}/confirm`)
    return res.data.data
  },




  

  async getFamilyGroup(): Promise<FamilyGroup | null> {
    const res = await axiosInstance.get<ApiResponse<FamilyGroup | null>>('/patient/family')
    return res.data.data
  },

  async createFamily(payload: { ten_nhom: string; ho_ten: string; ngay_sinh?: string; gioi_tinh?: string }): Promise<FamilyGroup> {
    const res = await axiosInstance.post<ApiResponse<FamilyGroup>>('/patient/family', payload)
    return res.data.data
  },

  async addFamilyMember(payload: { ho_ten: string; ngay_sinh: string; gioi_tinh: string; nhom_mau?: string | null; di_ung?: string | null; benh_nen?: string | null }): Promise<FamilyMember> {
    const res = await axiosInstance.post<ApiResponse<FamilyMember>>('/patient/family/members', payload)
    return res.data.data
  },

  async updateFamilyMember(id: string, payload: { ho_ten?: string; ngay_sinh?: string; gioi_tinh?: string; nhom_mau?: string | null; di_ung?: string | null; benh_nen?: string | null }): Promise<FamilyMember> {
    const res = await axiosInstance.put<ApiResponse<FamilyMember>>(`/patient/family/members/${id}`, payload)
    return res.data.data
  },

  async removeFamilyMember(id: string): Promise<void> {
    await axiosInstance.delete(`/patient/family/members/${id}`)
  },
}
