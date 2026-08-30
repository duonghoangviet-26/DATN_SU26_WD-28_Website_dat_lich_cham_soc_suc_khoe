import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'

export interface DoctorExtendedProfile {
  chuc_danh?: string | null
  chuc_vu?: string | null
  chuc_vu_hien_tai?: string | null
  ma_cchn?: string | null
  gioi_thieu_ngan?: string | null
  bang_cap_hoc_vi_tags?: string[]
  ngon_ngu?: string[]
  the_manh_chuyen_mon?: string[]
  benh_ly_dieu_tri?: string[]
  qua_trinh_cong_tac?: Array<{
    noi_cong_tac: string
    chuc_vu?: string | null
    tu_nam?: number | null
    den_nam?: number | null
  }>
  qua_trinh_dao_tao?: Array<{
    ten_bang: string
    truong?: string | null
    tu_nam?: number | null
    den_nam?: number | null
  }>
  thanh_vien_hoi?: string[]
  giai_thuong?: Array<{
    ten: string
    nam?: number | null
  }>
}

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
  ho_so_chi_tiet?: DoctorExtendedProfile | null
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
  quan_he?: string | null
  nhom_mau?: string | null
  so_dien_thoai?: string | null
  di_ung?: string | null
  benh_nen?: string | null
  la_chu_ho: boolean
}

export interface FamilyGroup {
  id: string
  ten_nhom: string
  members: FamilyMember[]
}

// Hai đường đặt lịch (rule mục 12):
//   TỰ GÁN      — gửi `specialty_id` + `gio_bat_dau`, hệ thống chọn bác sĩ
//   ĐÍCH DANH   — gửi `doctor_id` + `schedule_id` + `slot_id` như trước
export interface CreateBookingPayload {
  loai_kham: 'clinic'
  doctor_id?: string
  schedule_id?: string
  slot_id?: string
  specialty_id?: string
  gio_bat_dau?: string
  ngay_kham: string
  ly_do_kham: string
  ten_khach: string
  so_dien_thoai_khach: string
  lich_hen_goc_id?: string
  member_id?: string | null
  booking_for?: 'self' | 'member' | 'other'
  phuong_thuc?: 'chuyen_khoan' | 'vi_dien_tu' | 'the_ngan_hang' | 'tien_mat'
  // BẮT BUỘC. Backend trả 400 nếu thiếu — không có bằng chứng khách đồng ý điều khoản
  // không hoàn tiền thì không được thu tiền (rule mục 5).
  dong_y_dieu_khoan: true
}

// ── Luồng chọn chuyên khoa, hệ thống tự xếp bác sĩ (rule mục 12) ───────────
export interface SpecialtyTimeSlot {
  khung_index: number | null
  gio_bat_dau: string
  gio_ket_thuc: string
  ca: 'sang' | 'chieu' | 'toi'
  so_cho_trong: number
}

export interface SpecialtySlotsResult {
  ten_chuyen_khoa: string
  gia_kham: number
  ngay: string
  khung_gio: SpecialtyTimeSlot[]
}

// ── Dời lịch (rule mục 5, 14, 15) ──────────────────────────────────────────
export interface ReschedulePlan {
  index: number
  loai: 'doi_bac_si' | 'doi_khung'
  mo_ta: string
  ngay: string
  gio_bat_dau: string
  bac_si_ten: string | null
  da_giu_cho: boolean
}

export interface RescheduleOptions {
  // 'phong_kham_de_xuat' = phòng khám đổi lịch (bác sĩ bận/nghỉ).
  // 'khach_tu_doi'       = khách tự xin dời, có hạn mức.
  loai: 'phong_kham_de_xuat' | 'khach_tu_doi'
  trang_thai?: 'cho_khach_chon' | 'cho_admin_duyet'
  han_phan_hoi?: string | null
  con_lai?: number
  han_chot?: string
  khong_mat_tien: boolean
  thong_diep: string
  phuong_an: ReschedulePlan[]
}

export interface RescheduleResult {
  id: string
  ma_lich_hen: string | null
  ngay_kham: string
  gio_kham: string
  doctor_id: string
  ly_do_doi: 'khach_yeu_cau' | 'phong_kham' | null
  so_lan_doi_khach_yeu_cau: number
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
  appointment_info: {
    ma_lich_hen: string | null
    ngay_kham: string | null
    gio_kham: string | null
    phong_kham: string | null
    doctor: { id: string; ho_ten: string | null } | null
    specialty: { id: string; ten: string | null } | null
    patient: { ho_ten: string | null; so_dien_thoai: string | null; nam_sinh: number | null }
  } | null
  ngay_thanh_toan: string | null
  phuong_thuc: string
  gateway: PatientPaymentGatewaySnapshot
  server_time?: string
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

  // Luồng MẶC ĐỊNH (rule mục 12): chọn chuyên khoa + khung giờ, hệ thống tự xếp bác sĩ.
  // Trả kèm giá vì giá phải hiển thị TRƯỚC khi giữ chỗ.
  async getSpecialtySlots(specialtyId: string, date: string): Promise<SpecialtySlotsResult> {
    const res = await axiosInstance.get<ApiResponse<SpecialtySlotsResult>>(
      `/patient/booking/specialties/${specialtyId}/slots`,
      { params: { date } },
    )
    return res.data.data
  },

  async createBooking(payload: CreateBookingPayload): Promise<CreatedBookingResult> {
    const res = await axiosInstance.post<ApiResponse<CreatedBookingResult>>('/patient/booking', payload)
    return res.data.data
  },

  // ── Dời lịch (rule mục 5, 14, 15) ─────────────────────────────────────────
  // KHÔNG hoàn tiền — tiền được bảo toàn dưới dạng quyền dời lịch.
  async getRescheduleOptions(appointmentId: string): Promise<RescheduleOptions> {
    const res = await axiosInstance.get<ApiResponse<RescheduleOptions>>(
      `/patient/appointments/${appointmentId}/reschedule`,
    )
    return res.data.data
  },

  async chooseReschedule(appointmentId: string, phuongAnIndex: number): Promise<RescheduleResult> {
    const res = await axiosInstance.post<ApiResponse<RescheduleResult>>(
      `/patient/appointments/${appointmentId}/reschedule`,
      { phuong_an_index: phuongAnIndex },
    )
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

  async cancelBooking(appointmentId: string, ly_do?: string): Promise<{ id: string; status: string; payment_status: string }> {
    const res = await axiosInstance.patch<ApiResponse<{ id: string; status: string; payment_status: string }>>(
      `/patient/booking/${appointmentId}/cancel`,
      { ly_do },
    )
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

  async addFamilyMember(payload: {
    ho_ten: string
    ngay_sinh: string
    gioi_tinh: string
    quan_he?: string | null
    nhom_mau?: string | null
    so_dien_thoai?: string | null
    di_ung?: string | null
    benh_nen?: string | null
  }): Promise<FamilyMember> {
    const res = await axiosInstance.post<ApiResponse<FamilyMember>>('/patient/family/members', payload)
    return res.data.data
  },

  async updateFamilyMember(
    id: string,
    payload: {
      ho_ten?: string
      ngay_sinh?: string
      gioi_tinh?: string
      quan_he?: string | null
      nhom_mau?: string | null
      so_dien_thoai?: string | null
      di_ung?: string | null
      benh_nen?: string | null
    }
  ): Promise<FamilyMember> {
    const res = await axiosInstance.put<ApiResponse<FamilyMember>>(`/patient/family/members/${id}`, payload)
    return res.data.data
  },

  async removeFamilyMember(id: string): Promise<void> {
    await axiosInstance.delete(`/patient/family/members/${id}`)
  },
}
