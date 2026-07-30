// Kiểu dữ liệu dùng chung toàn project.
// Khớp với cấu trúc bảng trong VitaFamily_Database.sql.

export type Role = "user" | "patient" | "doctor" | "admin" | "receptionist";
export type UserStatus = "active" | "locked";
export type DoctorApproval = "pending" | "approved" | "rejected" | "suspended";
export type AppointmentStatus =
    | "pending"
    | "confirmed"
    | "checked_in"
    | "in_progress"
    | "waiting_record"
    | "waiting_doctor_confirm"
    | "completed"
    | "cancelled"
    | "no_show"
    | "skipped";
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
    // Cấu hình năng lực khám — rule mục 2/4/12 (.claude/rules/lich-lam-viec-bac-si.md).
    // Optional vì bản ghi tạo trước migration 010 chưa có các field này.
    thoi_gian_kham_trung_binh_phut?: number;
    so_slot_moi_khung?: number | null; // null = tự tính floor(30 / thời gian khám)
    ty_le_online_phan_tram?: number;
    gia_kham?: number;
    so_slot_moi_khung_thuc_dung?: number; // backend tính sẵn, chỉ để đọc
}

// ─── Dịch vụ ─────────────────────────────────────────────────────────────────
// 'home'    → nhân viên lấy mẫu xét nghiệm đến nhà, đặt được, có thoi_gian_phut
// 'related' → dịch vụ liên quan theo chuyên khoa (X-quang, MRI...), chỉ hiển thị thông tin
export interface ClinicRoomDoctor {
    _id: string;
    ho_ten: string;
    email?: string | null;
    trang_thai_duyet?: DoctorApproval;
    trang_thai?: "active" | "nghi_phep" | "nghi_viec";
    phong_kham_mac_dinh?: string | null;
    specialties?: { _id: string; ten: string }[];
}

export interface ClinicRoomItem {
    _id: string;
    ten: string;
    tang: number;
    toa: string;
    loai: string;
    trang_thai: "active" | "inactive";
    full_name: string;
    doctor_ids: ClinicRoomDoctor[];
    doctor_count: number;
    future_schedule_count: number;
    active_appointment_count: number;
    ngay_tao?: string | null;
    ngay_cap_nhat?: string | null;
}

export interface ClinicRoomPayload {
    ten: string;
    tang: number;
    toa: string;
    loai: string;
    trang_thai: "active" | "inactive";
    doctor_ids: string[];
}

export interface ClinicRoomOptions {
    doctors: ClinicRoomDoctor[];
}

export type ServiceType = "home" | "related";
export type ServiceStatus = "active" | "inactive";
export type ServiceTargetAudience = "tre_em" | "nguoi_lon" | "gia_dinh" | "khong_gioi_han";
export type ServicePackageType = "goi_don" | "goi_gia_dinh";

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
    hinh_anh?: string | null;
    // API cũ và màn hình public dùng image_url; giữ alias khi dữ liệu chưa đổi tên.
    image_url?: string | null;
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
    loai_goi?: ServicePackageType | null; // chỉ có khi la_goi=true
    doi_tuong_ap_dung?: ServiceTargetAudience | null;
    so_nguoi_ap_dung?: number | null;
    dich_vu_con?: string[];
    phan_tram_giam_gia?: number | null;
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
    image_url?: string | null;
    chuan_bi_truoc?: string; // related only — hướng dẫn chuẩn bị trước
    gio_dat_truoc_toi_thieu?: number; // home only
    // related: required | home: optional
    specialty_id?: string | null;
    la_goi?: boolean;
    doi_tuong_ap_dung?: ServiceTargetAudience | null;
    loai_goi?: ServicePackageType | null;
    so_nguoi_ap_dung?: number | null;
    dich_vu_con?: string[];
    phan_tram_giam_gia?: number | null;
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
    /**
     * Số lần KHÁCH tự xin dời — trần 1 (rule mục 5). Khác `so_lan_thay_doi` (đếm MỌI thay
     * đổi, kể cả lần dời do lỗi phòng khám). Chặn theo `so_lan_thay_doi` sẽ tước oan quyền
     * dời của khách khi lần trước là lỗi phòng khám.
     */
    so_lan_doi_khach_yeu_cau?: number;
    /** Phân loại lần dời gần nhất: khách yêu cầu (tính hạn mức) hay lỗi phòng khám (không tính). */
    ly_do_doi?: 'khach_yeu_cau' | 'phong_kham' | null;
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
    trang_thai_xac_nhan: "cho_xac_nhan" | "da_xac_nhan" | "tu_choi";
    ly_do_tu_choi_xac_nhan?: string | null;
    thoi_diem_xac_nhan?: string | null;
    co_di_lam: boolean;
    so_lich_hen_xung_dot: number;
    canh_bao_xung_dot_xac_nhan: boolean;
    tong_slot: number;
    slot_trong: number;
    slot_da_dat: number;
    slot_bi_khoa: number;
    slot_da_huy: number;
    slot_online_trong: number;
    slot_walkin_trong: number;
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
    khung_index?: number | null;
    loai_slot?: "online" | "walk_in";
    benh_nhan_id?: string | null;
    benh_nhan_tam_giu_id?: string | null;
    specialty_id?: string | null;
    phong_kham?: string | null;
    status: "active" | "pending_payment" | "booked" | "locked" | "cancelled" | "expired";
    lock_expires_at?: string | null;
    pending_expired_at?: string | null;
    cancel_requested?: boolean;
    cancel_reason?: string | null;
    bi_khoa_boi_nghi_phep?: boolean;
    nghi_phep_id?: string | null;
    co_lich_hen?: boolean;
    ten_benh_nhan?: string | null;
    la_khach_vang_lai?: boolean;
}

export interface AdminDoctorScheduleDetail {
    _id: string;
    doctor_id: string;
    chi_nhanh_id?: string | null;
    ngay: string;
    trang_thai_ngay: "lam_viec" | "nghi" | "nghi_phep";
    ghi_chu_ngay?: string | null;
    trang_thai_xac_nhan?: "cho_xac_nhan" | "da_xac_nhan" | "tu_choi";
    ly_do_tu_choi_xac_nhan?: string | null;
    thoi_diem_xac_nhan?: string | null;
    slots: AdminDoctorScheduleSlot[];
}

export interface AdminDoctorScheduleAuditLog {
    _id: string;
    schedule_id?: string | null;
    doctor_id?: string | null;
    doctor_name?: string | null;
    ngay?: string | null;
    slot_id?: string | null;
    nguoi_thuc_hien_id?: string | null;
    nguoi_thuc_hien: string;
    nguoi_thuc_hien_email?: string | null;
    vai_tro: "admin" | "doctor" | "system";
    hanh_dong:
        | "auto_generate"
        | "manual_create"
        | "update_workday"
        | "update_slot"
        | "doctor_confirm"
        | "doctor_reject"
        | "doctor_request_cancel_slot";
    du_lieu_cu?: Record<string, unknown> | null;
    du_lieu_moi?: Record<string, unknown> | null;
    ghi_chu?: string | null;
    thoi_diem: string;
}

export interface AdminDoctorScheduleAuditResponse {
    items: AdminDoctorScheduleAuditLog[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
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
export type NotificationTarget = "tat_ca" | "benh_nhan" | "bac_si" | "le_tan";

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

// Trạng thái vận hành của cả NGÀY làm việc (LichLamViec.trang_thai_ngay) — khác với
// DoctorSlot.status (trạng thái của TỪNG slot 30 phút bên trong ngày đó).
export type DoctorScheduleDayStatus = "lam_viec" | "nghi" | "nghi_phep";

export interface DoctorSlot {
    id: string;
    schedule_id: string; // cần để update slot qua API
    ngay: string; // 'YYYY-MM-DD'
    gio_bat_dau: string; // 'HH:MM'
    gio_ket_thuc: string;
    khung_index?: number | null; // vị trí khung 30' trong ca (0-based) — null = dữ liệu cũ trước migration
    loai_slot?: "online" | "walk_in"; // thiếu = 'online' (tương thích dữ liệu cũ)
    phong_kham?: string | null;
    benh_nhan?: string | null;
    benh_nhan_id?: string | null;
    la_khach_vang_lai?: boolean;
    // Nguon dang chiem slot: lich dat truoc hoac luot tai quay trong HangDoi.
    nguon_chiem_cho?: "dat_truoc" | "tai_quay" | null;
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
    // Dữ liệu cấp NGÀY, lặp lại trên mỗi slot cùng ngày — backend trả từ Prompt 2 (GET /doctor/schedule).
    trang_thai_ngay?: DoctorScheduleDayStatus | null;
    chi_nhanh_id?: string | null;
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
    // Ghi chú xử lý của Admin (khi duyệt/từ chối) — null nếu Admin chưa xử lý hoặc chưa ghi chú.
    ghi_chu?: string | null;
    thoi_diem_duyet?: string | null;
    ngay_tao?: string | null;
    ngay_cap_nhat?: string | null;
    // Chỉ có ở response của POST (tạo mới) — số lịch hẹn còn hiệu lực bị ảnh hưởng, tính động.
    so_lich_hen_anh_huong?: number;
}

// 1 lịch hẹn trong danh sách "lịch hẹn thuộc ca" — GET /doctor/schedule/:scheduleId.
// Khác DoctorAppointmentDetail (trang Lịch hẹn của tôi): đây là dữ liệu rút gọn, chỉ đủ
// để xem nhanh trong ngữ cảnh 1 ngày làm việc, không có đủ field để thao tác (xác nhận/hủy...).
export interface DoctorScheduleAppointmentItem {
    id: string;
    ma_lich_hen: string | null;
    slot_id: string | null;
    benh_nhan: string;
    gio_kham: string;
    gio_ket_thuc: string | null;
    loai_kham: "clinic" | "home";
    hinh_thuc_dat_lich: string | null;
    la_khach_vang_lai: boolean;
    chuyen_khoa: string | null;
    ten_dich_vu: string | null;
    status: AppointmentStatus;
    payment_status: PaymentStatus;
}

// 1 slot trong chi tiết ca — tương tự DoctorSlot nhưng KHÔNG lặp lại field cấp ngày
// (ngay/schedule_id/trang_thai_ngay đã nằm ở DoctorScheduleDetail cấp cha).
export interface DoctorScheduleDetailSlot {
    id: string;
    gio_bat_dau: string;
    gio_ket_thuc: string;
    khung_index: number | null;
    loai_slot: "online" | "walk_in";
    phong_kham: string | null;
    status: DoctorSlot["status"];
    benh_nhan_id: string | null;
    benh_nhan: string | null;
    la_khach_vang_lai: boolean;
    nguon_chiem_cho: "dat_truoc" | "tai_quay" | null;
    lock_expires_at: string | null;
    cancel_requested: boolean;
    bi_khoa_boi_nghi_phep: boolean;
}

// Số liệu tổng hợp 1 ngày làm việc — GET /doctor/schedule/:scheduleId (thong_ke).
// Tất cả đều tính động từ dữ liệu thật (backend/src/utils/appointmentStatus.js) — không có
// trường nào là ước lượng hay mặc định.
export interface DoctorScheduleStats {
    tong_slot: number;
    slot_trong: number;
    slot_da_dat: number;
    slot_bi_khoa: number;
    slot_da_huy: number;
    slot_online_trong: number;
    slot_walkin_trong: number;
    tong_lich_hen: number;
    cho_kham: number;
    da_den: number;
    dang_kham: number;
    cho_xac_nhan_ho_so: number;
    cho_tiep_nhan: number;
    hoan_thanh: number;
    khong_den: number;
    da_huy: number;
    khac: number;
    so_lich_hen_con_hieu_luc: number;
}

// Chi tiết đầy đủ 1 ngày làm việc — GET /doctor/schedule/:scheduleId.
export interface DoctorScheduleDetail {
    id: string;
    ngay: string;
    trang_thai_ngay: DoctorScheduleDayStatus | null;
    ghi_chu_ngay: string | null;
    chi_nhanh_id: string | null;
    slots: DoctorScheduleDetailSlot[];
    lich_hen: DoctorScheduleAppointmentItem[];
    thong_ke: DoctorScheduleStats;
}

// Trạng thái xác nhận hồ sơ khám (KetQuaKham.status) — xem docs/Bác sĩ/Audit - Truong du lieu
// thieu va thua trong DB. cho_xac_nhan = "WAITING_DOCTOR_CONFIRM" theo yêu cầu nghiệp vụ.
// ban_nhap = "DRAFT" — hồ sơ lưu nháp trước khi gửi bác sĩ xác nhận.
export type KetQuaKhamStatus =
    | "ban_nhap"
    | "cho_xac_nhan"
    | "da_xac_nhan"
    | "yeu_cau_chinh_sua";

// 1 dòng trong "Danh sách hồ sơ chờ bác sĩ xác nhận" — rút gọn, không cần đủ field
// như DoctorAppointmentDetail (màn này chỉ để lọc nhanh hồ sơ cần xử lý).
export interface DoctorPendingRecord {
    id: string; // KetQuaKham._id
    appointment_id: string | null;
    hang_doi_id?: string | null;
    ho_so_benh_nhan_id?: string | null;
    ngay_kham: string;
    benh_nhan: string;
    ten_dich_vu: string | null;
    nguoi_nhap: string | null; // tên người nhập hồ sơ
    status: KetQuaKhamStatus;
}

// Trạng thái tổng hợp 1 lượt trong hàng đợi khám (BE tính từ hang_doi + ket_qua_kham) —
// dùng chung cho trang "Hồ sơ chờ khám" (DoctorExamQueue) hiển thị cả lượt online lẫn offline.
export type ExamQueueStatus =
    | "dang_cho"
    | "da_goi"
    | "trong_phong"
    | "cho_nhap_ho_so"
    | "cho_xac_nhan"
    | "da_xong"
    | "bo_luot"
    | "da_huy";

// 1 dòng trong hàng đợi khám của bác sĩ (GET /api/doctor/queue) — gộp cả bệnh nhân đặt online
// (có appointment_id) và bệnh nhân vãng lai check-in tại quầy (appointment_id = null).
export interface DoctorExamQueueRow {
    id: string; // HangDoiKham._id
    appointment_id: string | null; // null nếu là lượt vãng lai (offline)
    ho_so_benh_nhan_id?: string | null;
    nguon: "online" | "offline";
    ten_benh_nhan: string;
    tuoi: number | null;
    gioi_tinh: string | null;
    phong_kham: string | null;
    muc_uu_tien: "online_uu_tien" | "online_thuong" | "offline";
    hang_doi_trang_thai: string;
    checkin_time: string;
    ket_qua_id: string | null;
    ket_qua_status: string | null;
    trang_thai_tong_hop: ExamQueueStatus;
}

// ============================================================
// Hàng đợi động + Trạng thái phòng khám (Bác sĩ) — khớp response
// backend/src/controllers/doctor/{room-status,queue}.controller.js
// ============================================================

export type PhongKhamTrangThai = "san_sang" | "tam_nghi" | "dang_don_phong" | "dang_kham";

// GET /doctor/room-status — trạng thái phòng của chính bác sĩ đang đăng nhập
export interface RoomStatus {
    doctor_id: string;
    phong_kham: string | null;
    trang_thai: PhongKhamTrangThai;
    benh_nhan_hien_tai_id: string | null;
    thoi_gian_kham_tb_phut: number;
    thoi_diem_doi: string | null;
}

export type HangDoiMucUuTien = "online_uu_tien" | "online_thuong" | "offline";
export type HangDoiTrangThai = "dang_cho" | "da_goi" | "trong_phong" | "skipped" | "cancelled" | "hoan_thanh";

// GET /doctor/queue-entries — 1 dòng trong hàng đợi động (khác DoctorExamQueueRow — dùng
// cho danh sách "Hồ sơ chờ khám"; entry này phục vụ các action gọi/vào phòng/kết thúc/bỏ lượt).
export interface QueueEntry {
    id: string;
    nguon: "online" | "offline";
    ten_benh_nhan: string;
    tuoi: number | null;
    gioi_tinh: "nam" | "nu" | "khac" | null;
    doctor_id: string;
    phong_kham: string | null;
    muc_uu_tien: HangDoiMucUuTien;
    trang_thai: HangDoiTrangThai;
    checkin_time: string;
    so_lan_goi: number;
    thoi_gian_cho_uoc_tinh_phut: number | null;
}

// POST /doctor/queue/checkin — online cần appointment_id, offline (vãng lai) cần ten_benh_nhan + so_dien_thoai
export interface QueueCheckinPayload {
    appointment_id?: string;
    ten_benh_nhan?: string;
    so_dien_thoai?: string;
    tuoi?: number;
    gioi_tinh?: "nam" | "nu" | "khac";
    specialty_id?: string;
}

// entry trả về từ checkin() là doc Mongoose thô (_id, không phải id như list())
export interface QueueCheckinEntry {
    _id: string;
    nguon: "online" | "offline";
    appointment_id?: string | null;
    ten_benh_nhan: string;
    so_dien_thoai: string | null;
    tuoi: number | null;
    gioi_tinh: "nam" | "nu" | "khac" | null;
    doctor_id: string;
    phong_kham: string | null;
    muc_uu_tien: HangDoiMucUuTien;
    trang_thai: HangDoiTrangThai;
    checkin_time: string;
    so_lan_goi: number;
}

export interface QueueCheckinResult {
    entry: QueueCheckinEntry;
    /** Danh sách cảnh báo tại quầy: chưa thanh toán, đến sớm/trễ, ca đang quá tải. */
    canh_bao: string[];
    /** Giữ lại cho code cũ — cùng nội dung với `canh_bao`, gộp thành một chuỗi. */
    canh_bao_qua_tai: string | null;
}

// GET /doctor/queue/pending-checkin — khách đã đặt hôm nay nhưng CHƯA vào hàng đợi.
// Mắt xích giữa "khách đã đặt + đã trả tiền" và "bác sĩ tiếp nhận".
export interface LichChoTiepNhan {
    appointment_id: string;
    ma_lich_hen: string | null;
    ten_benh_nhan: string;
    so_dien_thoai: string | null;
    tuoi: number | null;
    gioi_tinh: "nam" | "nu" | "khac" | null;
    doctor_id: string;
    chuyen_khoa: string | null;
    gio_kham: string;
    phong_kham: string | null;
    nguon: "online" | "tai_cho";
    status: string;
    payment_status: "unpaid" | "partial" | "paid" | "refunded";
    /** Đã tới giờ khung của mình chưa (mốc `T` — rule mục 11). */
    da_toi_khung: boolean;
    /** Đang trong 15 phút grace `T` → `T+15'` — vẫn giữ ưu tiên online. */
    con_trong_grace: boolean;
    /** Trễ quá `T+15'` — vẫn được khám, xếp sau, KHÔNG mất tiền. */
    tre_qua_grace: boolean;
}

// PATCH /doctor/queue/:id/{call,into-room,finish,skip,cancel}
export interface QueueActionResult {
    id: string;
    trang_thai: HangDoiTrangThai;
    so_lan_goi?: number;
}

export interface DoctorAppointmentDetail {
    id: string | number; // Mongo ObjectId từ API; mock cũ có thể dùng number
    ma_lich_hen?: string | null;
    benh_nhan: string;
    benh_nhan_id: string | number;
    ho_so_benh_nhan_id?: string | null;
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

// Payload chỉnh sửa hồ sơ khám gửi kèm khi bác sĩ "Lưu & Xác nhận" (confirmResult) hoặc khi
// cập nhật (examinationService.save). Mọi trường tùy chọn — chỉ gửi phần bác sĩ thực sự sửa.
export interface ExamResultEditPayload {
    chan_doan?: string;
    huong_dan_dieu_tri?: string | null;
    ghi_chu?: string | null;
    ngay_tai_kham?: string | null;
    thuoc?: Omit<PrescriptionDrug, 'id'>[];
    dich_vu_phat_sinh?: Array<{ service_id: string; so_luong: number }>;
    sinh_hieu?: VitalSigns;
}

export interface ExamRelatedService {
    _id: string;
    ten: string;
    gia: number;
    specialty_id?: string | null;
}

export interface ExaminationServiceOrder {
    service_id: string;
    ten: string;
    so_luong: number;
    don_gia: number;
    thanh_tien: number;
}

// Sinh hiệu ban đầu — bác sĩ tự đo/nhập ngay khi nhập kết quả khám.
export interface VitalSigns {
    can_nang?: number | null;
    chieu_cao?: number | null;
    huyet_ap?: string | null;
    nhiet_do?: number | null;
    nhip_tim?: number | null;
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
    trieu_chung_ban_dau?: string | null; // ghi nhận khi tiếp nhận — bác sĩ tham khảo để chẩn đoán
    ghi_chu_dieu_duong?: string | null; // ghi chú điều dưỡng — tách khỏi ghi chú chuyên môn BS
    ngay_tai_kham: string;
    co_the_sua: boolean; // dự phòng cho khóa thủ công/tương lai — khóa thật hiện dựa vào status==='da_xac_nhan' (GAP-001)
    thuoc: PrescriptionDrug[]; // joined từ don_thuoc (backend trả gộp)
    dich_vu_phat_sinh?: ExaminationServiceOrder[];
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
export interface DoctorTodayOverview {
    ho_ten: string;
    chuyen_khoa: string;
    ca_lam_viec: { gio_bat_dau: string; gio_ket_thuc: string } | null;
    phong_kham: string | null;
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
    du_lieu_cu?: Record<string, unknown> | null;
    du_lieu_moi?: Record<string, unknown> | null;
    ngay_tao: string;
}

export type NotificationTargetAPI = "tat_ca" | "benh_nhan" | "bac_si" | "le_tan";

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
    anh_dai_dien?: string | null;
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
    url_slug?: string | null;
    noi_dung_ngan: string;
    noi_dung: string;
    anh_dai_dien: string;
    nguoi_viet: string;
    luot_xem: number;
    ngay_tao: string;
}

export type NewsStatus = "draft" | "published" | "hidden";

export interface NewsArticle {
    id: string;
    _id?: string;
    title: string;
    slug: string;
    url_slug?: string | null;
    image: string;
    content: string;
    excerpt: string;
    status: NewsStatus;
    author_id?: string | null;
    author_name?: string | null;
    view_count: number;
    created_at: string;
    updated_at?: string | null;
    // Legacy aliases returned by the backend while old client code is being phased out.
    tieu_de?: string;
    noi_dung_ngan?: string;
    noi_dung?: string;
    anh_dai_dien?: string;
    nguoi_viet?: string;
    luot_xem?: number;
    ngay_tao?: string;
}

export interface NewsPayload {
    title: string;
    slug: string;
    author_name: string;
    image: string;
    content: string;
    status?: NewsStatus;
}

export interface NewsListResult {
    items: NewsArticle[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface AdminNewsListResult extends NewsListResult {
    statistics: {
        total: number;
        published: number;
        draft: number;
        hidden: number;
    };
}
