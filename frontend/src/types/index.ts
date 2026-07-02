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
  ngay_tao: string
  ngay_cap_nhat?: string
}

export interface Doctor {
  id: number
  user_id: number
  tieu_su?: string
  bang_cap?: string
  kinh_nghiem?: string
  so_nam_kinh_nghiem: number
  gia_kham: number            // giá mỗi slot 30 phút — snapshot vào LichHen.gia_kham
  tuoi_nhan_kham_tu: number   // 0 = không giới hạn tuổi
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
  // clinic: required | home: null
  schedule_id?: string | null
  slot_id?: string | null
  // null khi clinic | ref DichVu loai='home' khi home
  service_id?: string | null
  loai_kham: 'clinic' | 'home'
  ngay_kham: string
  gio_kham: string
  ly_do_kham?: string
  phong_kham?: string | null      // clinic: snapshot slot.phong_kham | home: null
  dia_chi_kham?: string | null    // home: bắt buộc | clinic: null
  status: AppointmentStatus
  payment_status: PaymentStatus
  gia_kham: number                // clinic: snapshot BacSi.gia_kham | home: snapshot DichVu.gia
  ten_dich_vu?: string | null     // clinic: snapshot ChuyenKhoa.ten | home: snapshot DichVu.ten
  ly_do_huy?: string | null
  payment_deadline?: string | null
  // home only — URL PDF kết quả xét nghiệm do CSKH upload sau khi lab xong
  ket_qua_url?: string | null
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
  user_id: number
  ho_ten: string
  email: string
  anh_dai_dien?: string | null
  chuyen_khoa: string           // tên chuyên khoa — joined từ ChuyenKhoa.ten
  so_nam_kinh_nghiem: number
  gia_kham: number              // giá mỗi slot 30 phút
  tuoi_nhan_kham_tu?: number    // 0 = không giới hạn
  trang_thai_duyet: DoctorApproval
  diem_danh_gia: number
  so_danh_gia: number
  bang_cap: string
  kinh_nghiem?: string
  ly_do_tu_choi?: string | null
  ngay_tao: string
}

export interface HospitalItem {
  id: number
  ten: string
  dia_chi: string
  so_dien_thoai: string
  gio_lam_viec: string
  status: 'active' | 'hidden'
  ngay_tao: string
}

// Thông tin phòng khám (singleton — ThongTinPhongKham)
export interface ClinicInfo {
  ten: string
  dia_chi?: string | null
  so_dien_thoai?: string | null
  email?: string | null
  gio_lam_viec?: string | null  // "8:00-17:00 Thứ2-Thứ7"
  mo_ta?: string | null
  logo_url?: string | null
  ban_do_url?: string | null    // embed Google Maps
  bao_hiem: {
    nha_nuoc: boolean           // Bảo hiểm y tế nhà nước
    bao_lanh: boolean           // Bảo hiểm bảo lãnh
  }
}

export interface SpecialtyItem {
  id: number
  ten: string
  mo_ta: string
  icon_url: string        // khớp backend ChuyenKhoa.icon_url (GAP-18)
  thu_tu: number
  status: 'active' | 'hidden'
}

// ─── Dịch vụ ─────────────────────────────────────────────────────────────────
// 'home'    → bác sĩ đến nhà, đặt được, có thoi_gian_phut
// 'related' → dịch vụ liên quan theo chuyên khoa (X-quang, MRI...), chỉ hiển thị thông tin
export type ServiceType   = 'home' | 'related'
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
  gia: number                           // home: BN trả | related: giá tham khảo
  mo_ta_ngan?: string | null
  mo_ta?: string | null
  // home: cố định 60ph, có lịch áp dụng (đặt lịch riêng, chọn BS+slot)
  // related: null — không đặt lịch riêng (đi kèm khám clinic, BS chỉ định), thời lượng/lịch áp dụng vô nghĩa
  thoi_gian_phut?: number | null
  gio_dat_truoc_toi_thieu?: number      // home only — đơn vị: giờ
  ngay_ap_dung?: string | null          // home: cố định 'T2–T7' | related: null
  gio_bat_dau?: string | null           // home: cố định '08:00' | related: null
  gio_ket_thuc?: string | null          // home: cố định '17:00' | related: null
  // related only — hướng dẫn chuẩn bị trước (nhịn ăn, tháo kim loại, v.v.)
  chuan_bi_truoc?: string | null
  // related: required | home: optional
  specialty_id?: string | null
  specialty_ten?: string | null         // joined — chỉ dùng để hiển thị
  khu_vuc?: string[]                    // home only
  so_bac_si?: number                    // computed từ BacSi.services[]
  so_luot_dat?: number                  // computed từ LichHen (home only)
  active_appointments?: number          // computed — số lịch hẹn pending/confirmed đang dùng dịch vụ này
  nguoi_tao?: string | null
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
  chuan_bi_truoc?: string              // related only — hướng dẫn chuẩn bị trước
  gio_dat_truoc_toi_thieu?: number     // home only
  // related: required | home: optional
  specialty_id?: string | null
  khu_vuc?: string[]                   // home only
}

// ViewModel lịch hẹn (kết hợp bệnh nhân + bác sĩ — dùng cho trang danh sách admin/BN)
export interface AppointmentItem {
  id: number
  benh_nhan: string
  bac_si: string
  chuyen_khoa: string           // tên chuyên khoa của BS
  ngay_kham: string
  gio_kham: string
  loai_kham: 'clinic' | 'home'
  status: AppointmentStatus
  payment_status: PaymentStatus
  gia_kham: number
  ten_dich_vu?: string | null   // clinic: tên chuyên khoa | home: tên dịch vụ
}

export interface ReviewItem {
  id: number
  benh_nhan: string
  bac_si: string
  so_sao: number          // khớp backend DanhGia.so_sao (GAP-19, đổi từ 'diem')
  noi_dung: string
  status: 'visible' | 'hidden'
  ngay_tao: string
}

// Khớp backend ThongBaoHeThong.doi_tuong — dùng tên tiếng Việt để nhất quán (GAP-20)
export type NotificationTarget = 'tat_ca' | 'benh_nhan' | 'bac_si'

export interface NotificationItem {
  id: number
  tieu_de: string
  noi_dung: string
  doi_tuong: NotificationTarget
  so_nguoi_nhan: number
  ngay_gui: string
}

export type PaymentMethod = 'momo' | 'vnpay' | 'cash' | 'bank' | 'mock'

// Trạng thái giao dịch thanh toán — KHÁC với LichHen.payment_status (GAP-21)
// LichHen dùng PaymentStatus ('unpaid'|'paid'|'refunded'), ThanhToan dùng TransactionStatus
export type TransactionStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface PaymentItem {
  id: number
  ma_giao_dich: string    // "TXN0001" — auto-gen bởi backend (GAP-21)
  benh_nhan: string
  bac_si: string
  so_tien: number
  phuong_thuc: PaymentMethod
  status: TransactionStatus
  ngay_tao: string
}

// Kiểu cho API response chuẩn { success, message, data }
export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
}

// ─── Doctor Panel types (B1–B5) ───────────────────────────────

export interface DoctorSlot {
  id: string
  schedule_id: string       // cần để update slot qua API
  ngay: string              // 'YYYY-MM-DD'
  gio_bat_dau: string       // 'HH:MM'
  gio_ket_thuc: string
  phong_kham?: string | null
  benh_nhan?: string | null
  benh_nhan_id?: string | null
  // pending_payment: slot bị BN giữ 15 phút trong khi thanh toán VNPay (soft-lock)
  status: 'active' | 'pending_payment' | 'booked' | 'locked' | 'cancelled' | 'expired'
  lock_expires_at?: string | null  // ISO datetime — set khi pending_payment, null các trạng thái khác
  cancel_requested?: boolean
}

export interface DoctorAppointmentDetail {
  id: number
  benh_nhan: string
  benh_nhan_id: number
  so_dien_thoai: string
  ngay_kham: string
  gio_kham: string
  loai_kham: 'clinic' | 'home'
  status: AppointmentStatus
  payment_status: PaymentStatus
  gia_kham: number
  ly_do_kham?: string
  phong_kham?: string | null         // clinic: snapshot từ slots[].phong_kham — backend trả về
  dia_chi_kham?: string | null       // BẮT BUỘC khi loai_kham='home' — backend trả về
  ten_dich_vu?: string | null        // joined từ dich_vu.ten — backend trả về
  tuoi?: number
  gioi_tinh?: 'Nam' | 'Nữ' | 'Khác'
  di_ung?: string | null
  benh_nen?: string | null
  da_co_ket_qua: boolean             // computed bởi backend (exists in ket_qua_kham)
  ly_do_huy?: string | null
  payment_deadline?: string | null   // ISO datetime — deadline BN thanh toán sau khi BS confirm (Luồng C)
  // home only — URL PDF kết quả xét nghiệm do CSKH upload sau khi lab xong
  ket_qua_url?: string | null
}

export interface PrescriptionDrug {
  id: number
  ten_thuoc: string
  lieu_luong: string            // liều lượng mỗi lần uống (khớp DB don_thuoc.items.lieu_luong)
  tan_suat: string              // '3 lần/ngày' — mô tả hiển thị
  gio_uong: string[]            // ['07:00', '12:00', '19:00'] — cron dùng để tạo nhac_nho
  ngay_bat_dau: string          // 'YYYY-MM-DD'
  ngay_ket_thuc: string         // 'YYYY-MM-DD' (max ngay_bat_dau + 90 ngày)
  ghi_chu?: string | null
}

export interface ExaminationResult {
  id: number
  appointment_id: number
  chan_doan: string
  huong_dan_dieu_tri: string
  ghi_chu?: string | null        // ghi chú bổ sung — field trong DB ket_qua_kham
  ngay_tai_kham: string
  co_the_sua: boolean            // false sau 24h — cron set, FE chỉ đọc
  thuoc: PrescriptionDrug[]      // joined từ don_thuoc (backend trả gộp)
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
