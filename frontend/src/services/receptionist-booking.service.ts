import axiosInstance from '@/services/axiosInstance'
import type { ApiResponse } from '@/types'

export interface DoctorFilterOption {
  id: string
  ho_ten: string
}

export interface ReceptionistBookingSlot {
  id: string
  schedule_id: string
  gio_bat_dau: string
  gio_ket_thuc: string
  phong_kham?: string | null
  is_full?: boolean
}

export interface DayOverviewKhungRow {
  khung_index: number
  gio_bat_dau: string
  gio_ket_thuc: string
  tong_slot: number
  con_trong: number
  khoa_boi_nghi_phep: boolean
}

export interface DoctorLeaveDaiHanChoDuyet {
  leave_id: string
  tu_ngay: string
  den_ngay: string
  gio_bat_dau: string | null
  gio_ket_thuc: string | null
  ly_do: string | null
}

export interface DayOverviewDoctor {
  doctor_id: string
  ten_bac_si: string
  trang_thai_bac_si: string
  trang_thai_ngay: 'lam_viec' | 'nghi' | 'nghi_phep' | 'khong_co_lich'
  /** Đơn nghỉ cả ngày đang phủ ngày đang xem — nguồn cho nút "Khôi phục". */
  leave_id: string | null
  ly_do_nghi: string | null
  /** B2 (2026-08-25): chỉ có ý nghĩa khi leave_id != null. */
  so_lich_chua_xu_ly: number
  so_lich_anh_huong: number
  /** C1 (2026-08-25): đơn nghỉ NHIỀU NGÀY do lễ tân tạo, đang chờ Admin duyệt — chưa khoá
   * slot, chưa sinh đề xuất. Khác hẳn `leave_id` (chỉ set khi đơn đã 'da_duyet'). */
  don_nghi_dai_han_cho_duyet: DoctorLeaveDaiHanChoDuyet | null
  ca_sang: DayOverviewKhungRow[]
  ca_chieu: DayOverviewKhungRow[]
}

export interface DayOverview {
  ngay: string
  doctors: DayOverviewDoctor[]
}

export interface DoctorDayAppointment {
  _id: string
  ma_lich_hen?: string | null
  gio_kham: string
  status: string
  ten_khach?: string | null
  so_dien_thoai_khach?: string | null
  nguon?: 'online' | 'tai_cho'
  user_id?: { ho_ten?: string | null; so_dien_thoai?: string | null } | null
}

export interface DoctorOperationalStatus {
  doctor_id: string
  ten_bac_si: string
  phong_kham?: string | null
  specialties?: Array<{ id: string; ten: string | null }>
  trang_thai_van_hanh: string
  so_dang_cho: number
}

export interface ReportDoctorUnavailablePayload {
  doctor_id: string
  tu_ngay: string
  den_ngay: string
  gio_bat_dau?: string
  gio_ket_thuc?: string
  reason: string
}

export interface SuddenLeaveProposalSummary {
  appointment_id: string
  so_phuong_an: number
  cho_admin_duyet: boolean
  can_lien_he_thu_cong: boolean
}

export interface SuddenLeaveSkippedAppointment {
  appointment_id: string
  ma_lich_hen?: string | null
  status: string
  ten_khach?: string | null
  gio_kham: string
  doctor_id?: string | null
  specialty_id?: string | null
  ly_do_bo_qua: 'benh_nhan_dang_trong_phong' | 'da_checkin_can_dieu_phoi_tai_quay' | 'de_xuat_doi_da_xu_ly' | 'trang_thai_khong_cho_phep_tao_de_xuat'
  hang_doi?: { hang_doi_id: string; trang_thai: string; ma_so_thu_tu?: string | null } | null
}

export interface ReportDoctorUnavailableResult {
  leave_id: string
  /** C1 (2026-08-25): true khi khoảng nghỉ >1 ngày -> đơn mới được TẠO ('cho_duyet'), CHƯA xử
   * lý gì (chưa khoá slot, chưa sinh đề xuất, cần Admin duyệt trước). false = đã xử lý xong. */
  can_admin_duyet: boolean
  so_lich_bi_anh_huong: number
  so_slot_da_khoa: number
  de_xuat_doi: SuddenLeaveProposalSummary[]
  can_dieu_phoi_tai_quay: SuddenLeaveSkippedAppointment[]
  so_luot_can_le_tan_lien_he: number
  so_lich_sinh_lai_phuong_an?: number
}

export interface DoctorUnavailablePreview {
  so_lich_anh_huong: number
  so_da_thanh_toan: number
  so_da_checkin: number
  so_chua_thanh_toan: number
  so_slot_se_khoa: number
}

export const receptionistBookingService = {
  async getSlots(doctorId: string, date: string): Promise<ReceptionistBookingSlot[]> {
    const res = await axiosInstance.get<ApiResponse<ReceptionistBookingSlot[]>>(`/receptionist/booking/doctors/${doctorId}/slots`, {
      params: { date },
    })
    return Array.isArray(res.data.data) ? res.data.data : []
  },

  async getDayOverview(date: string): Promise<DayOverview> {
    const res = await axiosInstance.get<ApiResponse<DayOverview>>('/receptionist/booking/day-overview', {
      params: { date },
    })
    return res.data.data
  },

  // Dung cho panel "ai da dat khung nay" tren luoi Lich bac si trong ngay — goi 1 lan
  // moi bac si/ngay, loc theo gio_kham o client thay vi them endpoint moi.
  async getAppointmentsForDoctorDay(doctorId: string, date: string): Promise<DoctorDayAppointment[]> {
    const res = await axiosInstance.get<ApiResponse<DoctorDayAppointment[]>>('/receptionist/appointments', {
      params: { doctor_id: doctorId, date, limit: 100 },
    })
    return Array.isArray(res.data.data) ? res.data.data : []
  },

  async getDoctorOperationalStatuses(): Promise<DoctorOperationalStatus[]> {
    const res = await axiosInstance.get<ApiResponse<DoctorOperationalStatus[]>>('/receptionist/appointments/doctor-statuses')
    return Array.isArray(res.data.data) ? res.data.data : []
  },

  // C1 (2026-08-25): data đã mang discriminator `can_admin_duyet` — trước đây hàm này chỉ
  // trả `res.data.data`, đã ĐÚNG cấu trúc rồi (field nằm trong `data`, không phải top-level),
  // giữ nguyên chữ ký nhưng ghi rõ lý do không đổi để lần sau khỏi phải đọc lại BE.
  async reportDoctorUnavailable(payload: ReportDoctorUnavailablePayload): Promise<ReportDoctorUnavailableResult> {
    const res = await axiosInstance.post<ApiResponse<ReportDoctorUnavailableResult>>('/receptionist/appointments/doctor-unavailable', payload)
    return res.data.data
  },

  // Rào chắn #1 (mục 3.8 spec): xem trước ảnh hưởng, CHỈ ĐỌC, trước khi xác nhận báo nghỉ.
  // Lưu ý: route thật nằm dưới /receptionist/appointments (appointment.routes.js), không phải
  // /receptionist/booking — sửa lại theo cách mount thực tế của backend.
  async previewDoctorUnavailable(params: { doctor_id: string; tu_ngay: string; den_ngay: string; gio_bat_dau?: string; gio_ket_thuc?: string }): Promise<DoctorUnavailablePreview> {
    const res = await axiosInstance.get<ApiResponse<DoctorUnavailablePreview>>('/receptionist/appointments/doctor-unavailable/preview', { params })
    return res.data.data
  },

  async listDoctorsForFilter(): Promise<DoctorFilterOption[]> {
    const response = await axiosInstance.get<ApiResponse<Array<{ id: string; ho_ten?: string | null }>>>(
      '/receptionist/booking/doctors',
    )
    return (response.data.data ?? []).map((doctor) => ({ id: doctor.id, ho_ten: doctor.ho_ten || 'Bác sĩ' }))
  },
}
