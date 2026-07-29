import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'

export interface PatientProfile {
  id: string
  ho_ten: string
  so_dien_thoai?: string | null
  ngay_sinh?: string | null
  gioi_tinh?: 'nam' | 'nu' | 'khac' | null
  dia_chi?: string | null
  ghi_chu?: string | null
  nguon_tao: 'online' | 'tai_quay' | 'backfill'
  tai_khoan_id?: string | null
  nguoi_giam_ho_id?: string | null
  member_id?: string | null
  trang_thai: 'active' | 'merged' | 'archived'
  nguoi_lien_he?: { id: string; ho_ten: string; so_dien_thoai?: string | null } | null
  quan_he?: string | null
  nhom_gia_dinh?: string | null
  lich_hen_hom_nay: TodayAppointment[]
  luot_dang_cho_hom_nay?: ActiveQueue | null
}

export interface TodayAppointment {
  id: string
  ma_lich_hen?: string | null
  ngay_kham: string
  gio_kham: string
  gio_ket_thuc?: string | null
  status: string
  payment_status: string
  nguon: 'online' | 'tai_cho'
  doctor: { id: string; ho_ten: string | null } | null
  chuyen_khoa: { id: string; ten: string | null } | null
  phong_kham?: string | null
}

export interface ActiveQueue {
  id: string
  trang_thai: string
  doctor_id?: string | null
  phong_kham?: string | null
  checkin_time: string
}

interface PatientSearchResult {
  phone: string
  profiles: PatientProfile[]
  total: number
  can_tao_moi: boolean
  ambiguous_appointments: TodayAppointment[]
  checked_at: string
}

export interface CreatePatientProfilePayload {
  ho_ten: string
  so_dien_thoai: string
  ngay_sinh?: string
  gioi_tinh?: 'nam' | 'nu' | 'khac'
  dia_chi?: string
  ghi_chu?: string
}

export interface OfflineIntakeSlot {
  schedule_id: string
  slot_id: string
  doctor_id: string
  specialty_id?: string | null
  khung_index?: number | null
  gio_bat_dau: string
  gio_ket_thuc: string
  phong_kham?: string | null
  ngay: string
}

export interface OfflineAvailability {
  ngay: string
  slots: OfflineIntakeSlot[]
  slot_cho_xu_ly: OfflineIntakeSlot[]
  slot_de_xuat: OfflineIntakeSlot | null
  ly_do_de_xuat: string | null
  minh_chung_suc_chua: CapacityEvidence[]
  checked_at: string
  trang_thai_kiem_tra: 'co_the_tiep_nhan' | 'tam_dung_qua_tai' | 'da_day_walk_in' | 'khong_co_lich_bac_si' | 'khong_co_khung_gan'
  goi_y_quay_lai: OfflineIntakeSlot | null
  bi_chan_qua_tai: boolean
  thong_bao: string | null
}

export interface CapacityEvidence {
  doctor_id: string
  bac_si: string
  phong_mac_dinh?: string | null
  schedule_id: string
  lich_ngay: string
  lich_cap_nhat_luc?: string | null
  khung_gan_nhat: OfflineIntakeSlot | null
  tong_slot_trong_khung: number
  online_da_dat: number
  walk_in_tong: number
  walk_in_da_giu: number
  walk_in_con_lai: number
  dang_cho: number
  do_tre_phut: number
  nguyenNhanDoTre: 'hang_doi' | 'trong_phong' | 'khong_tre'
  nguong_dung_walk_in_phut: number
  ket_luan: 'co_the_tiep_nhan' | 'tam_dung_qua_tai' | 'da_day_walk_in' | 'khong_co_lich_bac_si' | 'khong_co_khung_gan'
  ly_do: string
}

export interface OfflineInvoice {
  id: string
  hang_doi_id: string
  ho_so_benh_nhan_id: string
  so_hoa_don: string
  tong_tien_kham: number
  chi_tiet_thu_phi: Array<{ loai: string; service_id?: string | null; ten: string; so_tien: number; so_luong: number; thanh_tien: number }>
  tong_tien_phat_sinh: number
  tong_thanh_toan: number
  tong_da_thu: number
  con_phai_thu: number
  trang_thai_hoa_don: string
}

export interface OfflinePendingPayment {
  id: string
  hoa_don_id: string
  hang_doi_id: string
  so_tien: number
  phuong_thuc: 'tien_mat' | 'chuyen_khoan'
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  ma_giao_dich?: string
  ngay_tao?: string
  ngay_thanh_toan?: string | null
}

export interface OfflineRelatedService {
  _id: string
  ten: string
  gia: number
  specialty_id?: string | null
}

export interface OfflineQueueSummary {
  id: string
  ho_so_benh_nhan_id: string
  ten_benh_nhan: string
  so_dien_thoai?: string | null
  trang_thai: string
  checkin_time: string
  specialty_id: string
  invoice?: { so_hoa_don: string; tong_thanh_toan: number; trang_thai_hoa_don: string } | null
}

export interface BillingServiceLine {
  service_id?: string | null
  ten: string
  so_luong: number
  so_tien?: number
  don_gia?: number
  thanh_tien: number
}

export interface BillingCase {
  id: string
  source: 'online' | 'offline'
  ten_benh_nhan: string
  so_dien_thoai?: string | null
  specialty_id?: string | null
  invoice: OfflineInvoice | null
  pending_payment: OfflinePendingPayment | null
  dich_vu_chi_dinh: BillingServiceLine[]
}

export const receptionistPatientIntakeService = {
  async searchByPhone(phone: string): Promise<PatientSearchResult> {
    const response = await axiosInstance.get<ApiResponse<PatientSearchResult>>('/receptionist/patient-intake/search', {
      params: { phone },
    })
    return response.data.data as PatientSearchResult
  },

  async createProfile(payload: CreatePatientProfilePayload): Promise<PatientProfile> {
    const response = await axiosInstance.post<ApiResponse<{ profile: PatientProfile }>>(
      '/receptionist/patient-intake/profiles',
      payload,
    )
    return response.data.data.profile
  },

  async getAvailability(): Promise<OfflineAvailability> {
    const response = await axiosInstance.get<ApiResponse<OfflineAvailability>>('/receptionist/patient-intake/availability')
    return response.data.data as OfflineAvailability
  },

  async checkIn(payload: { ho_so_benh_nhan_id: string; schedule_id: string; slot_id: string }) {
    const response = await axiosInstance.post<ApiResponse<{ entry: { _id: string }; slot: OfflineIntakeSlot }>>(
      '/receptionist/patient-intake/check-in',
      payload,
    )
    return response.data.data
  },

  async checkInAppointment(appointmentId: string) {
    const response = await axiosInstance.patch<ApiResponse<{
      appointment: TodayAppointment
      hang_doi: { id: string; doctor_id: string; phong_kham?: string | null; gio_hen_goc?: string | null; checkin_time: string }
      canh_bao?: string[]
    }>>(`/receptionist/appointments/${appointmentId}/arrived`)
    return response.data
  },

  async getOfflineInvoice(queueId: string): Promise<{ invoice: OfflineInvoice | null; pending_payment: OfflinePendingPayment | null; hang_doi: unknown }> {
    const response = await axiosInstance.get<ApiResponse<{ invoice: OfflineInvoice | null; pending_payment: OfflinePendingPayment | null; hang_doi: unknown }>>(
      `/receptionist/payments/offline/${queueId}/invoice`,
    )
    return response.data.data
  },

  async listOfflineQueues(): Promise<OfflineQueueSummary[]> {
    const response = await axiosInstance.get<ApiResponse<OfflineQueueSummary[]>>('/receptionist/payments/offline')
    return response.data.data ?? []
  },

  async listRelatedServices(specialtyId: string): Promise<OfflineRelatedService[]> {
    const response = await axiosInstance.get<ApiResponse<OfflineRelatedService[]>>('/receptionist/payments/offline/services', {
      params: { specialty_id: specialtyId },
    })
    return response.data.data ?? []
  },

  async createOfflineInvoice(queueId: string, payload: { dich_vu_phat_sinh: Array<{ service_id: string; so_luong: number }>; phuong_thuc: 'tien_mat' | 'chuyen_khoan' }) {
    const response = await axiosInstance.post<ApiResponse<{ invoice: OfflineInvoice; payment: OfflinePendingPayment | null; pending_payment: OfflinePendingPayment | null }>>(
      `/receptionist/payments/offline/${queueId}/invoice`,
      payload,
    )
    return response.data.data
  },

  async confirmOfflinePayment(queueId: string, paymentId: string) {
    const response = await axiosInstance.patch<ApiResponse<{ invoice: OfflineInvoice; payment: OfflinePendingPayment }>>(
      `/receptionist/payments/offline/${queueId}/payments/${paymentId}/confirm`,
    )
    return response.data.data
  },

  async cancelOfflinePayment(queueId: string, paymentId: string, ly_do?: string) {
    const response = await axiosInstance.patch<ApiResponse<{ invoice: OfflineInvoice; payment: OfflinePendingPayment }>>(
      `/receptionist/payments/offline/${queueId}/payments/${paymentId}/cancel`,
      { ly_do },
    )
    return response.data.data
  },

  async listBillingCases(): Promise<BillingCase[]> {
    const response = await axiosInstance.get<ApiResponse<BillingCase[]>>('/receptionist/payments/cases')
    return response.data.data ?? []
  },

  async getBillingCase(referenceId: string, source: BillingCase['source']): Promise<BillingCase> {
    const response = await axiosInstance.get<ApiResponse<BillingCase>>(`/receptionist/payments/cases/${referenceId}`, { params: { source } })
    return response.data.data
  },

  async createBillingInvoice(referenceId: string, source: BillingCase['source'], phuong_thuc: 'tien_mat' | 'chuyen_khoan'): Promise<BillingCase> {
    const response = await axiosInstance.post<ApiResponse<BillingCase>>(`/receptionist/payments/cases/${referenceId}/invoice`, { source, phuong_thuc })
    return response.data.data
  },

  async confirmBillingPayment(referenceId: string, source: BillingCase['source'], paymentId: string): Promise<BillingCase> {
    const response = await axiosInstance.patch<ApiResponse<BillingCase>>(`/receptionist/payments/cases/${referenceId}/payments/${paymentId}/confirm`, { source })
    return response.data.data
  },

  async cancelBillingPayment(referenceId: string, source: BillingCase['source'], paymentId: string): Promise<BillingCase> {
    const response = await axiosInstance.patch<ApiResponse<BillingCase>>(`/receptionist/payments/cases/${referenceId}/payments/${paymentId}/cancel`, { source })
    return response.data.data
  },

  async markBillingReceiptPrinted(referenceId: string, source: BillingCase['source']): Promise<BillingCase> {
    const response = await axiosInstance.post<ApiResponse<BillingCase>>(`/receptionist/payments/cases/${referenceId}/receipt-print`, { source })
    return response.data.data
  },
}
