// Kiểu dữ liệu dùng chung toàn project.
// Khớp với cấu trúc bảng trong VitaFamily_Database.sql.

export type Role = 'user' | 'doctor' | 'admin'
export type UserStatus = 'active' | 'locked'
export type DoctorApproval = 'pending' | 'approved' | 'rejected' | 'suspended'
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'

export interface User {
  id: string
  email: string
  mat_khau?: string
  ho_ten: string
  so_dien_thoai?: string | null
  anh_dai_dien?: string | null
  role: Role
  status: UserStatus
  ngay_xoa?: string | null
  ngay_tao: string
  ngay_cap_nhat?: string
}

export interface Doctor {
  id: number
  user_id: number
  specialty_id: number // Thêm để khớp với logic lọc
  tieu_su?: string
  bang_cap?: string
  kinh_nghiem?: string
  so_nam_kinh_nghiem: number
  phi_tu_van: number
  trang_thai_duyet: DoctorApproval
  ly_do_tu_choi?: string | null
  so_lan_nop: number
  la_hien: boolean
  diem_danh_gia: number
  tong_danh_gia: number
  ngay_tao: string
}

export interface Hospital {
  id: number
  ten: string
  dia_chi?: string
  so_dien_thoai?: string
  email?: string
  gio_lam_viec?: string
  mo_ta?: string
  status: 'active' | 'hidden'
  ngay_tao: string
}

export interface Specialty {
  id: number
  ten: string
  mo_ta?: string
  icon_url?: string
  slug: string
  thu_tu: number
  status: 'active' | 'hidden'
}

export interface Appointment {
  id: number
  user_id: number
  member_id?: number | null
  doctor_id: number
  hospital_id: number
  slot_id: number
  loai_kham: 'clinic' | 'home' | 'video'
  ngay_kham: string
  gio_kham: string
  ly_do_kham?: string
  status: AppointmentStatus
  payment_status: PaymentStatus
  gia_kham: number
  ly_do_huy?: string | null
  ngay_tao: string
}

export interface Member {
  id: number
  family_id: number
  ho_ten: string
  ngay_sinh: string
  gioi_tinh: 'nam' | 'nu' | 'khac'
  nhom_mau?: 'A' | 'B' | 'AB' | 'O' | null
  di_ung?: string | null
  benh_nen?: string | null
  la_chu_ho: boolean
  ngay_xoa?: string | null
  ngay_tao: string
}

// ViewModel kết hợp thông tin bác sĩ + user (dùng cho trang danh sách)
export interface DoctorProfile {
  id: number
  doctor_id: number // Thêm để khớp với logic service
  user_id: number
  ho_ten: string
  email: string
  chuyen_khoa: string
  so_nam_kinh_nghiem: number
  phi_tu_van: number
  trang_thai_duyet: DoctorApproval
  diem_danh_gia: number
  so_danh_gia: number
  bang_cap: string
  ly_do_tu_choi?: string | null
  ngay_tao: string
}

export interface HospitalItem {
  _id: string
  ten: string
  dia_chi?: string | null
  so_dien_thoai?: string | null
  email?: string | null
  gio_lam_viec?: string | null
  mo_ta?: string | null
  logo_url?: string | null
  ban_do_url?: string | null
  trang_thai?: 'active' | 'inactive'
  ngay_tao?: string
  ngay_cap_nhat?: string
}

export interface SpecialtyItem {
  _id: string
  phong_kham_id: string
  ten: string
  mo_ta: string | null
  icon_url: string | null
  slug: string
  thu_tu: number
  doctor_count?: number
  status: 'active' | 'hidden'
  ngay_tao?: string
}

// ─── Dịch vụ ─────────────────────────────────────────────────────────────────
export type ServiceType   = 'clinic' | 'home'
export type ServiceStatus = 'active' | 'inactive'

export interface ServiceChangeLog {
  id: string
  thoi_gian: string                                      // ISO datetime
  hanh_dong: 'tao_moi' | 'cap_nhat' | 'an' | 'hien'
  nguoi_thay_doi: string
  mo_ta?: string
}

export interface ServiceItem {
  id: string
  ma_dich_vu: string                    // "DV001" — auto-gen bởi BE
  ten: string
  loai: ServiceType
  gia: number                           // giá thực tế bệnh nhân trả
  mo_ta_ngan?: string | null
  mo_ta?: string | null
  thoi_gian_phut: number
  gio_dat_truoc_toi_thieu: number       // đơn vị: giờ
  ngay_ap_dung?: string | null          // "T2–T7"
  gio_bat_dau?: string | null           // "08:00"
  gio_ket_thuc?: string | null          // "17:00"
  specialty_id?: string | null
  specialty_ten?: string | null         // joined — chỉ dùng để hiển thị
  khu_vuc?: string[]                    // home only — map tới bảng service_areas
  so_bac_si?: number                    // computed từ doctor_services
  so_luot_dat?: number                  // computed từ appointments
  nguoi_tao?: string | null             // ho_ten của admin tạo dịch vụ
  status: ServiceStatus
  ngay_tao?: string
  ngay_cap_nhat?: string
  lich_su_thay_doi?: ServiceChangeLog[]
}

export interface ServiceFormData {
  ten: string
  loai: ServiceType
  gia: number
  mo_ta_ngan?: string
  mo_ta?: string
  thoi_gian_phut: number
  gio_dat_truoc_toi_thieu: number
  ngay_ap_dung?: string
  gio_bat_dau?: string
  gio_ket_thuc?: string
  specialty_id?: string | null
  khu_vuc?: string[]                    // home only — map tới bảng service_areas
}

// ViewModel lịch hẹn (kết hợp bệnh nhân + bác sĩ)
export interface AppointmentItem {
  _id: string
  user_id?: string | null
  service_id?: string | null
  benh_nhan: string
  sdt_benh_nhan?: string | null
  doctor_id?: string | null
  bac_si: string
  chuyen_khoa: string
  ngay_kham: string
  gio_kham: string
  loai_kham: 'clinic' | 'home'
  status: AppointmentStatus
  payment_status: PaymentStatus
  gia_kham: number
  dia_chi_kham?: string | null
  ly_do_kham?: string | null
  ngay_cap_nhat?: string
}

export interface AppointmentSummary {
  today: number
  pending: number
  confirmed: number
  completed: number
}

export interface AppointmentPagination {
  total: number
  totalPages: number
  page: number
  limit?: number
}

export interface AppointmentListResponse {
  data: AppointmentItem[]
  pagination: AppointmentPagination
  summary: AppointmentSummary
}

export interface AdminAppointmentDoctorOption {
  _id: string
  ten: string
  chuyen_khoa: string
  service_ids: string[]
}

export interface AdminAppointmentServiceOption {
  _id: string
  ten: string
  loai: 'clinic' | 'home'
  gia: number
}

export interface ReviewItem {
  id: number
  benh_nhan: string
  bac_si: string
  diem: number
  noi_dung: string
  status: 'visible' | 'hidden'
  ngay_tao: string
}

export type NotificationTarget = 'all' | 'user' | 'doctor'

export interface NotificationItem {
  id: number
  tieu_de: string
  noi_dung: string
  doi_tuong: NotificationTarget
  so_nguoi_nhan: number
  ngay_gui: string
}

export type PaymentMethod = 'momo' | 'vnpay' | 'cash' | 'bank'

export interface PaymentItem {
  id: number
  ma_giao_dich: string
  benh_nhan: string
  bac_si: string
  so_tien: number
  phuong_thuc: PaymentMethod
  status: PaymentStatus
  ngay_tao: string
}

// Kiểu cho API response chuẩn { success, message, data }
export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
}

// Aliases & Missing types để khớp với các service
export type Notification = NotificationItem
export type Payment = PaymentItem
export type Review = ReviewItem
export type Schedule = DoctorSlot

// ─── Doctor Panel types (B1–B5) ───────────────────────────────

export interface DoctorSlot {
  id: number
  ngay: string           // 'YYYY-MM-DD'
  gio_bat_dau: string    // 'HH:MM'
  gio_ket_thuc: string
  so_benh_nhan_toi_da: number
  so_benh_nhan_hien_tai: number
  status: 'active' | 'locked' | 'cancelled'
}

export interface DoctorAppointmentDetail {
  id: number
  benh_nhan: string
  benh_nhan_id: number
  so_dien_thoai: string
  ngay_kham: string
  gio_kham: string
  loai_kham: 'clinic' | 'home' | 'video'
  status: AppointmentStatus
  payment_status: PaymentStatus
  gia_kham: number
  ly_do_kham?: string
  tuoi?: number
  gioi_tinh?: 'Nam' | 'Nữ' | 'Khác'
  di_ung?: string | null
  benh_nen?: string | null
  da_co_ket_qua: boolean
  ly_do_huy?: string | null
}

export interface PrescriptionDrug {
  id: number
  ten_thuoc: string
  lieu_dung: string
  tan_suat: string   // '3 lần/ngày'
  so_ngay: number
  ghi_chu: string
}

export interface ExaminationResult {
  id: number
  appointment_id: number
  chan_doan: string
  huong_dan_dieu_tri: string
  ngay_tai_kham: string
  co_the_sua: boolean
  thuoc: PrescriptionDrug[]
  ngay_tao: string
}

export interface DoctorStats {
  tong_luot_kham: number
  thang_nay: number
  ty_le_hoan_thanh: number
  ty_le_huy: number
  diem_danh_gia: number
  so_danh_gia: number
  doanh_thu_thang: number
}

export interface DoctorReview {
  id: number
  benh_nhan: string
  diem: number
  noi_dung: string
  ngay_tao: string
}

// ─── API Types (MongoDB Response) ─────────────────────────────

export interface DoctorSpecialty { _id: string; ten: string; slug: string; icon_url: string | null; status: string }
export interface DoctorService   { _id: string; ten: string; loai: string; gia: number; thoi_gian_phut: number; ma_dich_vu: string; status: string }

export interface DoctorProfileAPI {
  _id: string
  user_id: { ho_ten: string; email: string; so_dien_thoai?: string; anh_dai_dien?: string | null; role: string; status: string }
  tieu_su?: string | null
  bang_cap?: string | null
  kinh_nghiem?: string | null
  so_nam_kinh_nghiem: number
  phi_tu_van: number
  trang_thai_duyet: DoctorApproval
  ly_do_tu_choi?: string | null
  so_lan_nop: number
  la_hien: boolean
  diem_danh_gia: number
  tong_danh_gia: number
  specialties: DoctorSpecialty[]
  services: DoctorService[]
  ngay_tao: string
  ngay_cap_nhat?: string
}

export interface DoctorDetailAPI extends DoctorProfileAPI {
  thong_ke: { tong_lich_hen: number; lich_hen_sap_toi: number }
}

export interface DoctorAuditLog {
  _id: string
  nguoi_thuc_hien_id: { ho_ten: string; email: string; anh_dai_dien?: string | null }
  hanh_dong: string
  ly_do?: string | null
  du_lieu_cu?: { trang_thai_duyet?: string; ly_do_tu_choi?: string | null } | null
  du_lieu_moi?: { trang_thai_duyet?: string; ly_do_tu_choi?: string | null } | null
  ngay_tao: string
}

export type NotificationTargetAPI = 'tat_ca' | 'benh_nhan' | 'bac_si'

export interface NotificationItemAPI {
  _id: string
  tieu_de: string
  noi_dung: string
  doi_tuong: NotificationTargetAPI
  so_nguoi_nhan: number
  ngay_gui: string
  tao_boi: { _id: string; ho_ten: string; email: string } | null
}

export interface DoctorUpdatePayload {
  tieu_su?: string | null
  bang_cap?: string | null
  kinh_nghiem?: string | null
  so_nam_kinh_nghiem?: number
  phi_tu_van?: number
  la_hien?: boolean
  admin_id: string
}

export interface NotificationUpdatePayload {
  tieu_de: string
  noi_dung: string
}

export interface DoctorAppointmentHistory {
  _id: string
  patient_name: string
  patient_phone: string
  ngay_kham: string
  gio_kham: string
  loai_kham: 'clinic' | 'home' | 'video'
  status: AppointmentStatus
  gia_kham: number
  payment_status: PaymentStatus
}
