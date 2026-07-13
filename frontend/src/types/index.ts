// Kiểu dữ liệu dùng chung toàn project.
// Khớp với cấu trúc bảng trong VitaFamily_Database.sql.

export type Role = "user" | "doctor" | "admin" | "nurse";
export type UserStatus = "active" | "locked";
export type DoctorApproval = "pending" | "approved" | "rejected" | "suspended";
export type AppointmentStatus =
    | "pending"
    | "confirmed"
    | "checked_in"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "no_show";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";

export interface User {
    id: string;
    email: string;
    mat_khau?: string;
    ho_ten: string;
    so_dien_thoai?: string | null;
    anh_dai_dien?: string | null;
    role: Role;
    status: UserStatus;
    ngay_xoa?: string | null;
    ngay_tao: string;
    ngay_cap_nhat?: string;
}

export interface Doctor {
    id: number;
    user_id: number;
    specialty_id: number; // Thêm để khớp với logic lọc
    tieu_su?: string;
    bang_cap?: string;
    kinh_nghiem?: string;
    so_nam_kinh_nghiem: number;
    gia_kham: number; // giá mỗi slot 30 phút — snapshot vào LichHen.gia_kham
    tuoi_nhan_kham_tu: number; // 0 = không giới hạn tuổi
    trang_thai_duyet: DoctorApproval;
    ly_do_tu_choi?: string | null;
    so_lan_nop: number;
    la_hien: boolean;
    diem_danh_gia: number;
    tong_danh_gia: number;
    ngay_tao: string;
}

export interface ClinicSummary {
    id: number;
    ten: string;
    dia_chi?: string;
    so_dien_thoai?: string;
    email?: string;
    gio_lam_viec?: string;
    mo_ta?: string;
    status: "active" | "hidden";
    ngay_tao: string;
}

export interface Specialty {
    id: number;
    ten: string;
    mo_ta?: string;
    icon_url?: string;
    slug: string;
    thu_tu: number;
    status: "active" | "hidden";
}

export interface Appointment {
    id: number;
    user_id: number;
    member_id?: number | null;
    doctor_id: number;
    // clinic: required | home: null
    schedule_id?: string | null;
    slot_id?: string | null;
    // null khi clinic | ref DichVu loai='home' khi home
    service_id?: string | null;
    loai_kham: "clinic" | "home";
    ngay_kham: string;
    gio_kham: string;
    ly_do_kham?: string;
    phong_kham?: string | null; // clinic: snapshot slot.phong_kham | home: null
    dia_chi_kham?: string | null; // home: bắt buộc | clinic: null
    status: AppointmentStatus;
    payment_status: PaymentStatus;
    gia_kham: number; // clinic: snapshot BacSi.gia_kham | home: snapshot DichVu.gia
    ten_dich_vu?: string | null; // clinic: snapshot ChuyenKhoa.ten | home: snapshot DichVu.ten
    ly_do_huy?: string | null;
    payment_deadline?: string | null;
    // home only — URL PDF kết quả xét nghiệm do CSKH upload sau khi lab xong
    ket_qua_url?: string | null;
    ngay_tao: string;
}

export interface Member {
    id: number;
    family_id: number;
    ho_ten: string;
    ngay_sinh: string;
    gioi_tinh: "nam" | "nu" | "khac";
    nhom_mau?: "A" | "B" | "AB" | "O" | null;
    di_ung?: string | null;
    benh_nen?: string | null;
    la_chu_ho: boolean;
    ngay_xoa?: string | null;
    ngay_tao: string;
}

// ViewModel kết hợp thông tin bác sĩ + user (dùng cho trang danh sách)
export interface DoctorProfile {
    id: number;
    doctor_id?: number; // optional — chỉ 1 vài trang admin appointments dùng, mock data không cần set
    user_id: number;
    ho_ten: string;
    email: string;
    anh_dai_dien?: string | null;
    chuyen_khoa: string; // tên chuyên khoa — joined từ ChuyenKhoa.ten
    so_nam_kinh_nghiem: number;
    gia_kham: number; // giá mỗi slot 30 phút
    tuoi_nhan_kham_tu?: number; // 0 = không giới hạn
    trang_thai_duyet: DoctorApproval;
    diem_danh_gia: number;
    so_danh_gia: number;
    bang_cap: string;
    kinh_nghiem?: string;
    ly_do_tu_choi?: string | null;
    // specialist = bác sĩ khám clinic | home_staff = nhân viên lấy mẫu tại nhà
    loai?: "specialist" | "home_staff";
    // Bảo hiểm bác sĩ chấp nhận — hiển thị ở trang chọn bác sĩ theo chuyên khoa
    bao_hiem?: { nha_nuoc: boolean; bao_lanh: boolean };
    // Dịch vụ liên quan (loai='related') mà bác sĩ này có thể chỉ định — hiển thị tham khảo
    related_services?: { id: string; ten: string; gia: number }[];
    // Phòng khám mặc định — Admin gán khi duyệt hồ sơ (C2), khớp Room.full_name (mock/rooms.ts).
    // null = chưa được gán phòng cố định (BN không thấy slot cho tới khi có phòng).
    phong_kham_mac_dinh?: string | null;
    ngay_tao: string;
}

// Response shape thật của GET/PUT /doctor/profile (backend/src/controllers/doctor/profile.controller.js
// formatProfile()) — khác với DoctorProfile ở trên (dùng cho trang danh sách bác sĩ phía bệnh nhân).
export interface DoctorSelfProfile {
    id: string;
    ho_ten: string;
    email: string;
    so_dien_thoai: string | null;
    anh_dai_dien: string | null;
    tieu_su: string | null;
    bang_cap: string | null;
    kinh_nghiem: string | null;
    so_nam_kinh_nghiem: number;
    gia_kham: number;
    tuoi_nhan_kham_tu: number;
    trang_thai_duyet: DoctorApproval;
    ly_do_tu_choi: string | null;
    so_lan_nop: number;
    phong_kham_mac_dinh: string | null;
    diem_danh_gia: number;
    tong_danh_gia: number;
    specialties: { id: string; ten: string }[];
    services: { id: string; ten: string; gia: number }[];
    ngay_tao: string;
    chuc_danh: string | null;
    chuc_vu: string | null;
    benh_ly_dieu_tri: string[];
    qua_trinh_cong_tac: {
        noi_cong_tac: string;
        chuc_vu: string | null;
        tu_nam: number | null;
        den_nam: number | null;
    }[];
    qua_trinh_dao_tao: {
        ten_bang: string;
        truong: string | null;
        tu_nam: number | null;
        den_nam: number | null;
    }[];
    thanh_vien_hoi: string[];
    giai_thuong: { ten: string; nam: number | null }[];
}

export interface ClinicItem {
    _id: string;
    ten: string;
    dia_chi?: string | null;
    so_dien_thoai?: string | null;
    email?: string | null;
    gio_lam_viec?: string | null;
    mo_ta?: string | null;
    logo_url?: string | null;
    ban_do_url?: string | null;
    trang_thai?: "active" | "inactive";
    ngay_tao?: string;
    ngay_cap_nhat?: string;
}

// Thông tin phòng khám (singleton — ThongTinPhongKham)
export interface ClinicInfo {
    ten: string;
    dia_chi?: string | null;
    so_dien_thoai?: string | null;
    email?: string | null;
    gio_lam_viec?: string | null; // "8:00-17:00 Thứ2-Thứ7"
    mo_ta?: string | null;
    logo_url?: string | null;
    ban_do_url?: string | null; // embed Google Maps
    bao_hiem: {
        nha_nuoc: boolean; // Bảo hiểm y tế nhà nước
        bao_lanh: boolean; // Bảo hiểm bảo lãnh
    };
}

export interface SpecialtyItem {
    _id: string;
    phong_kham_id: string;
    ten: string;
    mo_ta: string | null;
    icon_url: string | null;
    slug: string;
    thu_tu: number;
    doctor_count?: number;
    status: "active" | "hidden";
    ngay_tao?: string;
}

// ─── Dịch vụ ─────────────────────────────────────────────────────────────────
// 'home'    → nhân viên lấy mẫu xét nghiệm đến nhà, đặt được, có thoi_gian_phut
// 'related' → dịch vụ liên quan theo chuyên khoa (X-quang, MRI...), chỉ hiển thị thông tin
export type ServiceType = "home" | "related";
export type ServiceStatus = "active" | "inactive";
export type ServiceTargetAudience =
    | "tre_em"
    | "nguoi_lon"
    | "gia_dinh"
    | "khong_gioi_han";

export interface ServiceChangeLog {
    id: string;
    thoi_gian: string; // ISO datetime
    hanh_dong: "tao_moi" | "cap_nhat" | "an" | "hien";
    nguoi_thay_doi: string;
    mo_ta?: string;
}

export interface ServiceItem {
    id: string;
    ma_dich_vu: string; // "DV001" — auto-gen bởi BE
    ten: string;
    loai: ServiceType;
    gia: number; // home: BN trả | related: giá tham khảo
    mo_ta_ngan?: string | null;
    mo_ta?: string | null;
    // home: cố định 60ph, có lịch áp dụng (đặt lịch riêng, chọn BS+slot)
    // related: null — không đặt lịch riêng (đi kèm khám clinic, BS chỉ định), thời lượng/lịch áp dụng vô nghĩa
    thoi_gian_phut?: number | null;
    gio_dat_truoc_toi_thieu?: number; // home only — đơn vị: giờ
    ngay_ap_dung?: string | null; // home: cố định 'T2–T7' | related: null
    gio_bat_dau?: string | null; // home: cố định '08:00' | related: null
    gio_ket_thuc?: string | null; // home: cố định '17:00' | related: null
    // related only — hướng dẫn chuẩn bị trước (nhịn ăn, tháo kim loại, v.v.)
    chuan_bi_truoc?: string | null;
    // related: required | home: optional
    specialty_id?: string | null;
    specialty_ten?: string | null; // joined — chỉ dùng để hiển thị
    la_goi?: boolean;
    doi_tuong_ap_dung?: ServiceTargetAudience | null;
    khu_vuc?: string[]; // home only
    so_bac_si?: number; // computed từ BacSi.services[]
    so_luot_dat?: number; // computed từ LichHen (home only)
    active_appointments?: number; // computed — số lịch hẹn pending/confirmed đang dùng dịch vụ này
    nguoi_tao?: string | null;
    status: ServiceStatus;
    ngay_tao?: string;
    ngay_cap_nhat?: string;
    lich_su_thay_doi?: ServiceChangeLog[];
}

export interface ServiceFormData {
    ten: string;
    loai: ServiceType;
    gia: number;
    mo_ta_ngan?: string;
    mo_ta?: string;
    chuan_bi_truoc?: string; // related only — hướng dẫn chuẩn bị trước
    gio_dat_truoc_toi_thieu?: number; // home only
    // related: required | home: optional
    specialty_id?: string | null;
    la_goi?: boolean;
    doi_tuong_ap_dung?: ServiceTargetAudience | null;
    khu_vuc?: string[]; // home only
}

// ViewModel lịch hẹn (kết hợp bệnh nhân + bác sĩ — dùng cho trang danh sách admin/BN)
export interface AppointmentItem {
    _id: string;
    ma_lich_hen?: string | null;
    user_id?: string | null;
    member_id?: string | null;
    user_email?: string | null;
    service_id?: string | null;
    specialty_id?: string | null;
    dat_ho?: boolean;
    loai_dat_lich?: "self" | "proxy";
    hinh_thuc_dat_lich?: string | null;
    nguoi_dat_ho_id?: string | null;
    nguoi_dat_ho_ten?: string | null;
    nguoi_dat_sdt?: string | null;
    benh_nhan: string;
    sdt_benh_nhan?: string | null;
    doctor_id?: string | null;
    bac_si: string;
    chuyen_khoa: string;
    ngay_kham: string;
    gio_kham: string;
    loai_kham: "clinic" | "home";
    status: AppointmentStatus;
    payment_status: PaymentStatus;
    gia_kham: number;
    dia_chi_kham?: string | null;
    ly_do_kham?: string | null;
    ly_do_huy?: string | null;
    huy_boi?: string | null;
    thoi_diem_huy?: string | null;
    ghi_chu_le_tan?: string | null;
    ghi_chu_tiep_nhan?: string | null;
    so_lan_thay_doi?: number;
    canh_bao?: {
        unpaid: boolean;
        rescheduled_multiple_times: boolean;
        missing_linkage: boolean;
        cancelled: boolean;
    };
    invoice?: {
        _id: string;
        so_hoa_don?: string | null;
        trang_thai_hoa_don?: string | null;
        tong_thanh_toan?: number | null;
    } | null;
    ngay_cap_nhat?: string;
}

export interface AppointmentSummary {
    today: number;
    pending: number;
    confirmed: number;
    in_progress?: number;
    completed: number;
    cancelled?: number;
    unpaid?: number;
    need_attention?: number;
    proxy_booking?: number;
}

export interface AppointmentPagination {
    total: number;
    totalPages: number;
    page: number;
    limit?: number;
}

export interface AppointmentListResponse {
    data: AppointmentItem[];
    pagination: AppointmentPagination;
    summary: AppointmentSummary;
}

export interface AppointmentHistoryItem {
    _id: string;
    tu_trang_thai?: string | null;
    den_trang_thai?: string | null;
    tu_payment_status?: string | null;
    den_payment_status?: string | null;
    vai_tro: string;
    loai_thay_doi?: string | null;
    ly_do_thay_doi?: string | null;
    nguoi_thuc_hien: string;
    nguoi_thuc_hien_email?: string;
    ly_do?: string | null;
    thoi_diem: string;
    ngay_kham_cu?: string | null;
    ngay_kham_moi?: string | null;
    gio_kham_cu?: string | null;
    gio_kham_moi?: string | null;
}

export interface AdminAppointmentDoctorOption {
    _id: string;
    ten: string;
    chuyen_khoa: string;
    service_ids: string[];
    phi_kham: number;
}

export interface AdminAppointmentServiceOption {
    _id: string;
    ten: string;
    loai: ServiceType;
    gia: number;
}

export interface AdminDoctorWorkdayItem {
    _id: string | null;
    doctor_id: string;
    chi_nhanh_id?: string | null;
    ngay: string;
    trang_thai_ngay: "lam_viec" | "nghi" | "nghi_phep" | "chua_tao";
    ghi_chu_ngay?: string | null;
    co_di_lam: boolean;
    tong_slot: number;
    slot_trong: number;
    slot_da_dat: number;
    slot_bi_khoa: number;
    slot_da_huy: number;
    gio_bat_dau?: string | null;
    gio_ket_thuc?: string | null;
    nguon_lich: "stored" | "derived";
}

export interface AdminDoctorWorkdayResponse {
    doctor: { _id: string; ten: string };
    range: { from: string; to: string };
    items: AdminDoctorWorkdayItem[];
}

export interface AdminDoctorScheduleSlot {
    _id: string;
    gio_bat_dau: string;
    gio_ket_thuc: string;
    benh_nhan_id?: string | null;
    benh_nhan_tam_giu_id?: string | null;
    specialty_id?: string | null;
    phong_kham?: string | null;
    status:
        | "active"
        | "pending_payment"
        | "booked"
        | "locked"
        | "cancelled"
        | "expired";
    lock_expires_at?: string | null;
    pending_expired_at?: string | null;
    cancel_requested?: boolean;
    cancel_reason?: string | null;
    bi_khoa_boi_nghi_phep?: boolean;
    nghi_phep_id?: string | null;
}

export interface AdminDoctorScheduleDetail {
    _id: string;
    doctor_id: string;
    chi_nhanh_id?: string | null;
    ngay: string;
    trang_thai_ngay: "lam_viec" | "nghi" | "nghi_phep";
    ghi_chu_ngay?: string | null;
    slots: AdminDoctorScheduleSlot[];
}

export interface ReviewItem {
    id: number;
    benh_nhan: string;
    bac_si: string;
    so_sao: number; // khớp backend DanhGia.so_sao (GAP-19, đổi từ 'diem')
    noi_dung: string;
    status: "visible" | "hidden";
    ngay_tao: string;
}

// Khớp backend ThongBaoHeThong.doi_tuong — dùng tên tiếng Việt để nhất quán (GAP-20)
export type NotificationTarget = "tat_ca" | "benh_nhan" | "bac_si";

export interface NotificationItem {
    id: number;
    tieu_de: string;
    noi_dung: string;
    doi_tuong: NotificationTarget;
    so_nguoi_nhan: number;
    ngay_gui: string;
}

export type PaymentMethod =
    | "tien_mat"
    | "chuyen_khoan"
    | "vi_dien_tu"
    | "the_ngan_hang"
    | "momo"
    | "vnpay"
    | "cash"
    | "bank";

// Trạng thái giao dịch thanh toán — KHÁC với LichHen.payment_status (GAP-21)
// LichHen dùng PaymentStatus ('unpaid'|'paid'|'refunded'), ThanhToan dùng TransactionStatus
export type TransactionStatus = "pending" | "paid" | "failed" | "refunded";

export interface PaymentItem {
    id: string | number;
    ma_giao_dich: string; // "TXN0001" — auto-gen bởi backend (GAP-21)
    benh_nhan: string;
    bac_si: string;
    so_tien: number;
    phuong_thuc: PaymentMethod;
    status: TransactionStatus;
    ngay_tao: string;
    hoa_don_id?: string | null;
    appointment_id?: string | null;
    so_hoa_don?: string | null;
    loai_thanh_toan?: string | null;
    email?: string | null;
    so_dien_thoai?: string | null;
    nguoi_thu_id?: string | null;
    thoi_diem_thanh_toan?: string | null;
    ngay_thanh_toan?: string | null;
    trang_thai_hoa_don?: string | null;
}

// Kiểu cho API response chuẩn { success, message, data }
export interface AdminDashboardSummary {
    appointments_today: number;
    doctors_active: number;
    revenue: {
        invoiced_total: number;
        collected_total: number;
        outstanding_total: number;
    };
    generated_at: string;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data: T;
}

// Aliases & Missing types để khớp với các service
export type Notification = NotificationItem;
export type Payment = PaymentItem;
export type Review = ReviewItem;
export type Schedule = DoctorSlot;

// ─── Doctor Panel types (B1–B5) ───────────────────────────────

export interface DoctorSlot {
    id: string;
    schedule_id: string; // cần để update slot qua API
    ngay: string; // 'YYYY-MM-DD'
    gio_bat_dau: string; // 'HH:MM'
    gio_ket_thuc: string;
    phong_kham?: string | null;
    benh_nhan?: string | null;
    benh_nhan_id?: string | null;
    // pending_payment: slot bị BN giữ 15 phút trong khi thanh toán VNPay (soft-lock)
    status:
        | "active"
        | "pending_payment"
        | "booked"
        | "locked"
        | "cancelled"
        | "expired";
    lock_expires_at?: string | null; // ISO datetime — set khi pending_payment, null các trạng thái khác
    cancel_requested?: boolean;
}

// Yêu cầu nghỉ bác sĩ tự gửi (vd: form "Xin nghỉ" hoặc nút "Gửi yêu cầu nghỉ cho
// ca đó" ở Lịch làm việc). Luôn tạo ở trang_thai='cho_duyet' — chỉ Admin duyệt/
// từ chối; bác sĩ chỉ được hủy (→ 'da_huy') khi còn 'cho_duyet'.
export interface DoctorLeaveRequest {
    id: string;
    tu_ngay: string;
    den_ngay: string;
    gio_bat_dau?: string | null; // để trống = xin nghỉ cả ngày
    gio_ket_thuc?: string | null;
    ly_do: string | null;
    trang_thai: "cho_duyet" | "da_duyet" | "tu_choi" | "da_huy";
    ngay_tao?: string | null;
}

// Trạng thái xác nhận hồ sơ khám (KetQuaKham.status) — xem docs/Bác sĩ/Audit - Truong du lieu
// thieu va thua trong DB. cho_xac_nhan = "WAITING_DOCTOR_CONFIRM" theo yêu cầu nghiệp vụ.
// ban_nhap = "DRAFT" — chỉ dùng cho luồng y tá nhập hồ sơ (lưu nháp trước khi gửi bác sĩ).
export type KetQuaKhamStatus =
    | "ban_nhap"
    | "cho_xac_nhan"
    | "da_xac_nhan"
    | "yeu_cau_chinh_sua";

// 1 dòng trong "Danh sách hồ sơ chờ bác sĩ xác nhận" — rút gọn, không cần đủ field
// như DoctorAppointmentDetail (màn này chỉ để lọc nhanh hồ sơ cần xử lý).
export interface DoctorPendingRecord {
    id: string; // KetQuaKham._id
    appointment_id: string;
    ngay_kham: string;
    benh_nhan: string;
    ten_dich_vu: string | null;
    nguoi_nhap: string | null; // tên người nhập hồ sơ — bác sĩ tự nhập hoặc y tá nhập hộ (xem pages/nurse)
    status: KetQuaKhamStatus;
}

export interface DoctorAppointmentDetail {
    id: string; // Mongo ObjectId — backend trả về string, không phải number
    ma_lich_hen?: string | null;
    benh_nhan: string;
    benh_nhan_id: string;
    so_dien_thoai: string;
    ngay_kham: string;
    gio_kham: string;
    loai_kham: "clinic" | "home";
    chuyen_khoa?: string | null; // joined từ specialty_id.ten — backend trả về
    status: AppointmentStatus;
    payment_status: PaymentStatus;
    gia_kham: number;
    ly_do_kham?: string;
    phong_kham?: string | null; // clinic: snapshot từ slots[].phong_kham — backend trả về
    dia_chi_kham?: string | null; // BẮT BUỘC khi loai_kham='home' — backend trả về
    ten_dich_vu?: string | null; // joined từ dich_vu.ten — backend trả về
    tuoi?: number;
    gioi_tinh?: "Nam" | "Nữ" | "Khác";
    di_ung?: string | null;
    benh_nen?: string | null;
    da_co_ket_qua: boolean; // computed bởi backend (exists in ket_qua_kham)
    ket_qua_status?: KetQuaKhamStatus | null; // null nếu chưa có hồ sơ
    ly_do_huy?: string | null;
    payment_deadline?: string | null; // ISO datetime — deadline BN thanh toán sau khi BS confirm (Luồng C)
    // home only — URL PDF kết quả xét nghiệm do CSKH upload sau khi lab xong
    ket_qua_url?: string | null;
}

export interface PrescriptionDrug {
    id: string | number; // string (Mongo ObjectId) khi tới từ API thật, number khi mock cũ
    ten_thuoc: string;
    lieu_luong: string; // liều lượng mỗi lần uống (khớp DB don_thuoc.items.lieu_luong)
    tan_suat: string; // '3 lần/ngày' — mô tả hiển thị
    gio_uong: string[]; // ['07:00', '12:00', '19:00'] — cron dùng để tạo nhac_nho
    so_ngay: number; // số ngày uống thuốc (tối đa 90 — khớp DonThuoc.js MAX_NGAY)
    ghi_chu?: string | null;
}

// 1 mục trong lịch sử thay đổi hồ sơ khám (KetQuaKham.lich_su_sua) — ghi lại mỗi lần
// xác nhận hoặc yêu cầu chỉnh sửa, dùng để đối chiếu sau này.
export interface ExaminationHistoryEntry {
    nguoi_sua_id?: { ho_ten?: string } | string | null; // populate 'ho_ten' ở backend, có thể null
    thoi_diem_sua: string;
    noi_dung: string | null;
}

export interface ExaminationResult {
    id: string | number; // string (Mongo ObjectId) khi tới từ API thật, number khi mock cũ
    appointment_id: string | number; // string khi tới từ DoctorAppointmentDetail.id (Mongo), number khi mock cũ
    status?: KetQuaKhamStatus; // 'da_xac_nhan' ngay nếu bác sĩ tự nhập (createResult) — xem quyết định 2026-07-11
    chan_doan: string;
    huong_dan_dieu_tri: string;
    ghi_chu?: string | null; // ghi chú bổ sung — field trong DB ket_qua_kham
    ngay_tai_kham: string;
    co_the_sua: boolean; // false sau 24h — cron set, FE chỉ đọc
    thuoc: PrescriptionDrug[]; // joined từ don_thuoc (backend trả gộp)
    ngay_tao: string;
    lich_su_sua?: ExaminationHistoryEntry[];
}

export interface DoctorStats {
    tong_luot_kham: number;
    thang_nay: number;
    ty_le_hoan_thanh: number;
    ty_le_huy: number;
    diem_danh_gia: number;
    so_danh_gia: number;
    doanh_thu_thang: number;
}

export interface DoctorReview {
    id: number;
    benh_nhan: string;
    diem: number;
    noi_dung: string;
    ngay_tao: string;
}

// Dòng rút gọn cho "lịch hẹn gần nhất" ở Dashboard — không cần đủ field như
// DoctorAppointmentDetail (backend không query thêm tuổi/giới tính/da_co_ket_qua... cho danh sách này).
export interface DoctorTodayAppointment {
    id: number | string;
    gio_kham: string;
    benh_nhan: string;
    ten_dich_vu?: string | null;
    status: AppointmentStatus;
}

// Tổng quan công việc "hôm nay" cho Dashboard bác sĩ — khác DoctorStats (tích lũy/tháng).
// y_ta_ho_tro luôn null ở giai đoạn hiện tại — hệ thống chưa có module gán y tá cho ca làm việc.
export interface DoctorTodayOverview {
    ho_ten: string;
    chuyen_khoa: string;
    ca_lam_viec: { gio_bat_dau: string; gio_ket_thuc: string } | null;
    phong_kham: string | null;
    y_ta_ho_tro: string | null;
    tong_lich_hen: number;
    cho_kham: number;
    dang_kham: number;
    hoan_thanh: number;
    lich_hen_gan_nhat: DoctorTodayAppointment[];
}

// ─── API Types (MongoDB Response) ─────────────────────────────

export interface DoctorSpecialty {
    _id: string;
    ten: string;
    slug: string;
    icon_url: string | null;
    status: string;
}
export interface DoctorService {
    _id: string;
    ten: string;
    loai: string;
    gia: number;
    thoi_gian_phut: number;
    ma_dich_vu: string;
    status: string;
}

export interface DoctorProfileAPI {
    _id: string;
    user_id: {
        ho_ten: string;
        email: string;
        so_dien_thoai?: string;
        anh_dai_dien?: string | null;
        role: string;
        status: string;
    };
    tieu_su?: string | null;
    bang_cap?: string | null;
    kinh_nghiem?: string | null;
    so_nam_kinh_nghiem: number;
    phi_kham: number;
    trang_thai_duyet: DoctorApproval;
    ly_do_tu_choi?: string | null;
    so_lan_nop: number;
    la_hien: boolean;
    diem_danh_gia: number;
    tong_danh_gia: number;
    specialties: DoctorSpecialty[];
    services: DoctorService[];
    ngay_tao: string;
    ngay_cap_nhat?: string;
}

export interface DoctorDetailAPI extends DoctorProfileAPI {
    thong_ke: { tong_lich_hen: number; lich_hen_sap_toi: number };
}

export interface DoctorAuditLog {
    _id: string;
    nguoi_thuc_hien_id: {
        ho_ten: string;
        email: string;
        anh_dai_dien?: string | null;
    };
    hanh_dong: string;
    ly_do?: string | null;
    du_lieu_cu?: {
        trang_thai_duyet?: string;
        ly_do_tu_choi?: string | null;
    } | null;
    du_lieu_moi?: {
        trang_thai_duyet?: string;
        ly_do_tu_choi?: string | null;
    } | null;
    ngay_tao: string;
}

export type NotificationTargetAPI = "tat_ca" | "benh_nhan" | "bac_si";

export interface NotificationItemAPI {
    _id: string;
    tieu_de: string;
    noi_dung: string;
    doi_tuong: NotificationTargetAPI;
    so_nguoi_nhan: number;
    ngay_gui: string;
    tao_boi: { _id: string; ho_ten: string; email: string } | null;
}

export interface DoctorUpdatePayload {
    tieu_su?: string | null;
    bang_cap?: string | null;
    kinh_nghiem?: string | null;
    so_nam_kinh_nghiem?: number;
    phi_kham?: number;
    la_hien?: boolean;
    admin_id: string;
}

export interface NotificationUpdatePayload {
    tieu_de: string;
    noi_dung: string;
}

export interface DoctorAppointmentHistory {
    _id: string;
    patient_name: string;
    patient_phone: string;
    ngay_kham: string;
    gio_kham: string;
    loai_kham: "clinic" | "home" | "video";
    status: AppointmentStatus;
    gia_kham: number;
    payment_status: PaymentStatus;
}

export interface NewsItem {
    id: string;
    tieu_de: string;
    slug: string;
    noi_dung_ngan: string;
    noi_dung: string;
    anh_dai_dien: string;
    nguoi_viet: string;
    luot_xem: number;
    ngay_tao: string;
}

// ============================================================
// Trang Y tá (Nurse Portal) — khớp response backend routes/nurse/*
// ============================================================

export interface NurseDashboardDoctorSupport {
    doctor_id: string;
    ten_bac_si: string | null;
    chuyen_khoa: string | null;
    phong_kham: string | null;
}

export interface NurseDashboardQueueItem {
    id: string;
    ma_lich_hen: string | null;
    benh_nhan: string;
    gio_kham: string;
    status: AppointmentStatus;
}

export interface NurseDashboard {
    ten_y_ta: string | null;
    ngay_hien_tai: string;
    bac_si_ho_tro: NurseDashboardDoctorSupport[];
    tong_check_in: number;
    dang_cho_kham: number;
    dang_kham: number;
    cho_nhap_ho_so: number;
    ho_so_cho_xac_nhan: number;
    ho_so_can_sua: number;
    ho_so_da_xac_nhan: number;
    hang_doi_gan_nhat: NurseDashboardQueueItem[];
}

// 1 dòng trong hàng đợi bệnh nhân của y tá (/nurse/appointments)
export interface NurseQueueItem {
    id: string;
    ma_lich_hen: string | null;
    benh_nhan: string;
    tuoi?: number;
    gioi_tinh?: string;
    ngay_kham: string;
    gio_kham: string;
    ly_do_kham?: string | null;
    ten_dich_vu?: string | null;
    bac_si: string | null;
    chuyen_khoa: string | null;
    phong_kham?: string | null;
    loai_kham: "clinic" | "home";
    status: AppointmentStatus;
    payment_status: PaymentStatus;
    da_co_ket_qua: boolean;
    ket_qua_status: KetQuaKhamStatus | null;
}

// Chi tiết lịch hẹn/bệnh nhân dành cho y tá (/nurse/appointments/:id)
export interface NurseAppointmentDetail {
    id: string;
    ma_lich_hen: string | null;
    benh_nhan: string;
    tuoi?: number;
    gioi_tinh?: string;
    so_dien_thoai: string | null;
    benh_nen: string | null;
    di_ung: string | null;
    ngay_kham: string;
    gio_kham: string;
    bac_si: string | null;
    chuyen_khoa: string | null;
    phong_kham?: string | null;
    dia_chi_kham?: string | null;
    ten_dich_vu?: string | null;
    loai_kham: "clinic" | "home";
    ly_do_kham?: string | null;
    status: AppointmentStatus;
    payment_status: PaymentStatus;
    da_co_ket_qua: boolean;
    ket_qua: NurseMedicalRecord | null;
    sinh_hieu: NurseVitalSigns | null;
}

export interface NurseVitalSigns {
    can_nang?: number | null;
    chieu_cao?: number | null;
    huyet_ap?: string | null;
    nhiet_do?: number | null;
    nhip_tim?: number | null;
}

// Hồ sơ khám do y tá nhập/xem — subset field liên quan tới vai trò y tá (không có field
// chỉ bác sĩ dùng như nguoi_xac_nhan_id).
export interface NurseMedicalRecord {
    id: string;
    appointment_id?: string;
    status: KetQuaKhamStatus;
    chan_doan: string;
    huong_dan_dieu_tri: string | null;
    ghi_chu: string | null;
    trieu_chung_ban_dau: string | null;
    ghi_chu_dieu_duong: string | null;
    ngay_tai_kham: string | null;
    doctor_revision_note: string | null;
    submitted_at?: string | null;
    ngay_tao?: string;
}

// 1 dòng trong danh sách hồ sơ cần chỉnh sửa (/nurse/medical-records/revisions)
export interface NurseRevisionItem {
    id: string;
    appointment_id: string;
    benh_nhan: string;
    bac_si_yeu_cau: string | null;
    ngay_kham: string;
    ly_do_kham?: string | null;
    doctor_revision_note: string | null;
    thoi_diem_yeu_cau: string;
}

export interface NurseMedicalRecordDraftPayload {
    appointment_id: string;
    chan_doan: string;
    huong_dan_dieu_tri?: string | null;
    ghi_chu?: string | null;
    trieu_chung_ban_dau?: string | null;
    ghi_chu_dieu_duong?: string | null;
    ngay_tai_kham?: string | null;
    sinh_hieu?: NurseVitalSigns;
}
