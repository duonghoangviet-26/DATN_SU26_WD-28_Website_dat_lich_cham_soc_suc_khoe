import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'
import type { TimelineRow } from '@/services/receptionist-timeline.service'

export interface PatientProfile {
  id: string
  ho_ten: string
  so_dien_thoai?: string | null
  ngay_sinh?: string | null
  gioi_tinh?: 'nam' | 'nu' | 'khac' | null
  nhom_mau?: 'A' | 'B' | 'AB' | 'O' | null
  di_ung?: string | null
  benh_nen?: string | null
  dia_chi?: string | null
  ghi_chu?: string | null
  nguon_tao: 'online' | 'tai_quay' | 'backfill'
  tai_khoan_id?: string | null
  nguoi_giam_ho_id?: string | null
  tai_khoan?: OnlineAccount | null
  loai_lien_ket_tai_khoan?: 'benh_nhan' | 'nguoi_dat_ho' | null
  member_id?: string | null
  trang_thai: 'active' | 'merged' | 'archived'
  nguoi_lien_he?: { id: string; ho_ten: string; so_dien_thoai?: string | null } | null
  quan_he?: string | null
  nhom_gia_dinh?: string | null
  lich_hen_hom_nay: TodayAppointment[]
  luot_dang_cho_hom_nay?: ActiveQueue | null
  sua_gan_nhat?: TimelineRow | null
  lich_su_kham?: VisitHistory | null
  // D81 — hồ sơ tạm cho bệnh nhân không có số điện thoại.
  la_ho_so_tam?: boolean
  ma_tam?: string | null
}

export interface VisitHistory {
  so_lan: number
  lan_gan_nhat: string
  bac_si_gan_nhat: string | null
}

export interface OnlineAccount {
  id: string
  email: string
  ho_ten: string
  so_dien_thoai?: string | null
  providers: string[]
  phuong_thuc_dang_nhap: string
  email_verified: boolean
}

export interface TodayAppointment {
  id: string
  tai_khoan_id?: string | null
  ma_lich_hen?: string | null
  ngay_kham: string
  gio_kham: string
  gio_ket_thuc?: string | null
  status: string
  payment_status: string
  ten_khach?: string | null
  so_dien_thoai_khach?: string | null
  nam_sinh_khach?: number | null
  nguon: 'online' | 'tai_cho'
  doctor: { id: string; ho_ten: string | null } | null
  chuyen_khoa: { id: string; ten: string | null } | null
  phong_kham?: string | null
}

export interface ActiveQueue {
  id: string
  trang_thai: string
  specialty_id?: string | null
  doctor_id?: string | null
  phong_kham?: string | null
  checkin_time: string
  so_thu_tu_checkin?: number | null
  ma_so_thu_tu?: string | null
}

interface PatientSearchResult {
  phone: string
  profiles: PatientProfile[]
  accounts: OnlineAccount[]
  total: number
  can_tao_moi: boolean
  ambiguous_appointments: TodayAppointment[]
  account_appointments: TodayAppointment[]
  checked_at: string
}

export interface CreatePatientProfilePayload {
  ho_ten: string
  so_dien_thoai: string
  ngay_sinh?: string
  gioi_tinh?: 'nam' | 'nu' | 'khac'
  tai_khoan_id?: string
}

// D81 — hồ sơ tạm: bù số điện thoại bằng 3 thứ nhận diện bắt buộc (ngày sinh, giới tính,
// ghi chú đặc điểm). Không có tai_khoan_id — không xác minh được chủ tài khoản qua SĐT.
export interface CreateTempProfilePayload {
  ho_ten: string
  ngay_sinh: string
  gioi_tinh: 'nam' | 'nu' | 'khac'
  ghi_chu: string
  nhom_mau?: 'A' | 'B' | 'AB' | 'O'
  di_ung?: string
  benh_nen?: string
  dia_chi?: string
}

// 9 trường hành chính lễ tân được sửa (LT-10). Không có trường chuyên môn —
// gửi thêm trường lạ sẽ bị backend từ chối 403.
export interface UpdateProfileAdministrativePayload {
  ho_ten?: string
  so_dien_thoai?: string
  ngay_sinh?: string | null
  gioi_tinh?: 'nam' | 'nu' | 'khac' | null
  nhom_mau?: 'A' | 'B' | 'AB' | 'O' | null
  di_ung?: string | null
  benh_nen?: string | null
  dia_chi?: string | null
  ghi_chu?: string | null
  ly_do_cap_nhat: string
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

export interface CentralOfflineCapacity {
  trang_thai: 'co_the_nhan' | 'canh_bao_day' | 'tam_dung_nhan'
  co_the_nhan: boolean
  can_xac_nhan_qua_tai: boolean
  ly_do: string | null
  specialty_id: string | null
  checked_at: string
  cau_hinh: {
    maxOfflineWaitMinutes: number
    offlineWarningWaitMinutes: number
    maxCentralOfflineQueueSize: number
    maxOfflinePerShiftPerSpecialty: number
    minOnlineProtectionMinutes: number
    dispatchBufferMinutes: number
    shiftClosingBufferMinutes: number
    offlineAgingMinutes: number
    autoDispatchEnabled: boolean
  }
  thong_ke: {
    so_khach_cho_trung_tam: number
    suc_chua_trung_tam_con_lai: number
    suc_chua_ca_con_lai: number
    so_bac_si_co_lich: number
    so_bac_si_co_the_dieu_phoi: number
    thoi_gian_kham_trung_binh_phut: number
    thoi_gian_cho_uoc_tinh_phut: number | null
  }
  minh_chung: {
    bac_si_bi_bao_ve_online: string[]
    tai_theo_bac_si: Array<{
      doctor_id: string
      bac_si?: string | null
      tai_uoc_tinh_phut: number
      ket_thuc_ca?: string | null
    }>
  }
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
  loai?: string
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
  ngay_kham?: string | null
  gio_kham?: string | null
  invoice: OfflineInvoice | null
  billing_summary: {
    tong_tien_kham: number
    chi_tiet_thu_phi: BillingServiceLine[]
    tong_tien_phat_sinh: number
    tong_thanh_toan: number
    tong_da_thu: number
    tong_da_thu_truoc: number
    tong_da_thu_sau_kham: number
    con_phai_thu_sau_kham: number
    con_phai_thu: number
    trang_thai_hoa_don: string
    da_xac_nhan_thu_ngan: boolean
    source: 'invoice' | 'medical_record'
  }
  pending_payment: OfflinePendingPayment | null
  payments: Array<{
    id: string
    so_tien: number
    loai_thanh_toan: 'phi_dat_lich' | 'dat_coc' | 'thanh_toan_bo_sung'
    phuong_thuc: 'tien_mat' | 'chuyen_khoan'
    status: 'pending' | 'paid' | 'failed' | 'refunded'
    ma_giao_dich?: string | null
    ngay_tao?: string
    ngay_thanh_toan?: string | null
  }>
  dich_vu_chi_dinh: BillingServiceLine[]
  da_xac_nhan_thu_ngan: boolean
}

/**
 * Lịch hẹn theo tài khoản online mà CHƯA gắn được vào hồ sơ nào trong kết quả tìm kiếm.
 *
 * Xảy ra khi số điện thoại trùng với một hồ sơ tại quầy có sẵn nhưng KHÔNG liên kết tài
 * khoản (`tai_khoan_id: null`) — vd khách đã khám vãng lai trước khi có tài khoản online.
 * Trước đây UI chỉ hiện khối "Lịch hẹn online của tài khoản" khi `profiles.length === 0`,
 * nên lịch đã thanh toán của tài khoản online bị ẩn hoàn toàn ngay khi có bất kỳ hồ sơ nào
 * trùng số điện thoại — lễ tân thấy hồ sơ "chưa có lịch" dù khách đã đặt và trả tiền online.
 */
export function getUnlinkedAccountAppointments(
  profiles: PatientProfile[],
  accountAppointments: TodayAppointment[],
): TodayAppointment[] {
  const linkedIds = new Set(profiles.flatMap((profile) => profile.lich_hen_hom_nay.map((appointment) => appointment.id)))
  return accountAppointments.filter((appointment) => !linkedIds.has(appointment.id))
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

  // D81 — cùng endpoint tạo hồ sơ, chỉ khác cờ khong_co_so_dien_thoai để backend chuyển
  // sang nhánh hồ sơ tạm (sinh ma_tam thay vì bắt buộc SĐT).
  async createTempProfile(payload: CreateTempProfilePayload): Promise<PatientProfile> {
    const response = await axiosInstance.post<ApiResponse<{ profile: PatientProfile }>>(
      '/receptionist/patient-intake/profiles',
      { ...payload, khong_co_so_dien_thoai: true },
    )
    return response.data.data.profile
  },

  async searchByTempCode(maTam: string): Promise<PatientProfile> {
    const response = await axiosInstance.get<ApiResponse<{ profile: PatientProfile }>>(
      '/receptionist/patient-intake/search-temp',
      { params: { ma_tam: maTam } },
    )
    return response.data.data.profile
  },

  async updateProfileAdministrative(id: string, payload: UpdateProfileAdministrativePayload): Promise<{ profile: PatientProfile; audit_id: string; changed_fields: string[] }> {
    const response = await axiosInstance.patch<ApiResponse<{ profile: PatientProfile; audit_id: string; changed_fields: string[] }>>(
      `/receptionist/patient-intake/profiles/${id}`,
      payload,
    )
    return response.data.data
  },

  async getAvailability(): Promise<OfflineAvailability> {
    const response = await axiosInstance.get<ApiResponse<OfflineAvailability>>('/receptionist/patient-intake/availability')
    return response.data.data as OfflineAvailability
  },

  async getCentralOfflineCapacity(specialtyId: string): Promise<CentralOfflineCapacity> {
    const response = await axiosInstance.get<ApiResponse<CentralOfflineCapacity>>('/receptionist/offline-queue/capacity', {
      params: { specialty_id: specialtyId },
    })
    return response.data.data as CentralOfflineCapacity
  },

  async intakeCentralOffline(payload: {
    ho_so_benh_nhan_id: string
    specialty_id: string
    xac_nhan_canh_bao?: boolean
    // D78 — cấp cứu/ưu tiên khẩn. Backend bắt buộc ly_do_uu_tien khi muc_uu_tien_tiep_nhan='cap_cuu'.
    muc_uu_tien_tiep_nhan?: 'binh_thuong' | 'uu_tien' | 'cap_cuu'
    ly_do_uu_tien?: string
  }) {
    const response = await axiosInstance.post<ApiResponse<{
      entry: {
        _id: string
        trang_thai: 'cho_dieu_phoi'
        checkin_time?: string
        so_thu_tu_checkin?: number | null
        ma_so_thu_tu?: string | null
        thoi_gian_cho_uoc_tinh_phut?: number | null
      }
      capacity: CentralOfflineCapacity
      phieu_cho: { ma_so_thu_tu?: string | null; trang_thai: string; thong_bao: string }
    }>>('/receptionist/offline-queue/intake', payload)
    return response.data.data
  },

  async checkIn(payload: { ho_so_benh_nhan_id: string; schedule_id: string; slot_id: string }) {
    const response = await axiosInstance.post<ApiResponse<{ entry: { _id: string; checkin_time?: string; so_thu_tu_checkin?: number | null; ma_so_thu_tu?: string | null }; slot: OfflineIntakeSlot }>>(
      '/receptionist/patient-intake/check-in',
      payload,
    )
    return response.data.data
  },

  async checkInAppointment(appointmentId: string, patient: { ho_so_benh_nhan_id: string; so_dien_thoai: string; ho_ten: string }) {
    // Luu y: backend tra hang_doi/canh_bao la anh em cung cap voi `data`, KHONG long ben trong
    // `data` (markAsArrived tra { success, message, data: appointment, hang_doi, canh_bao }).
    const response = await axiosInstance.patch<{
      success: boolean
      message?: string
      data: TodayAppointment
      hang_doi: { id: string; doctor_id: string; phong_kham?: string | null; gio_hen_goc?: string | null; checkin_time: string; so_thu_tu_checkin?: number | null; ma_so_thu_tu?: string | null }
      canh_bao?: string[]
    }>(`/receptionist/appointments/${appointmentId}/arrived`, patient)
    return {
      appointment: response.data.data,
      hang_doi: response.data.hang_doi,
      canh_bao: response.data.canh_bao ?? [],
    }
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

  async listBillingCases(view: 'pending' | 'paid' = 'pending', scope: 'today' | 'all' = 'today'): Promise<BillingCase[]> {
    const response = await axiosInstance.get<ApiResponse<BillingCase[]>>('/receptionist/payments/cases', { params: { view, scope } })
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
