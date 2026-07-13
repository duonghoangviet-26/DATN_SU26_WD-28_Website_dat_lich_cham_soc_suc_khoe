// Các hằng số dùng chung toàn hệ thống.
// Khớp với ENUM trong cơ sở dữ liệu (xem VitaFamily_Database.sql).

// Vai trò người dùng
export const ROLES = {
    USER: "user", // bệnh nhân
    DOCTOR: "doctor", // bác sĩ đã được duyệt
    ADMIN: "admin", // quản trị viên
};

export const ROLE_LABEL = {
    user: "Bệnh nhân",
    doctor: "Bác sĩ",
    admin: "Quản trị viên",
};

// Trạng thái tài khoản
export const USER_STATUS = {
    ACTIVE: "active",
    LOCKED: "locked",
};

export const USER_STATUS_LABEL = {
    active: "Hoạt động",
    locked: "Đã khóa",
};

// Trạng thái duyệt hồ sơ bác sĩ
export const DOCTOR_APPROVAL = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    SUSPENDED: "suspended",
};

// Trạng thái lịch hẹn
export const APPOINTMENT_STATUS = {
    PENDING: "pending",
    CONFIRMED: "confirmed",
    CHECKED_IN: "checked_in",
    IN_PROGRESS: "in_progress",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
    NO_SHOW: "no_show",
};

export const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    checked_in: "Đã check-in",
    in_progress: "Đang khám",
    waiting_doctor_confirm: "Chờ bác sĩ xác nhận hồ sơ",
    completed: "Hoàn thành",
    cancelled: "Đã hủy",
    no_show: "Không đến",
};

// Màu badge dùng chung cho trạng thái lịch hẹn — nguồn duy nhất, khớp với cách
// DoctorDashboard/DoctorAppointments đã dùng trước khi gộp (không đổi màu cũ).
export type BadgeColor = 'green' | 'red' | 'blue' | 'yellow' | 'gray';

export const APPOINTMENT_STATUS_COLOR: Record<string, BadgeColor> = {
    pending: "yellow",
    confirmed: "blue",
    checked_in: "blue",
    in_progress: "yellow",
    waiting_doctor_confirm: "yellow",
    completed: "green",
    cancelled: "red",
    no_show: "red",
};

export const DOCTOR_APPROVAL_LABEL: Record<string, string> = {
    pending: "Chờ duyệt",
    approved: "Đã duyệt",
    rejected: "Từ chối",
    suspended: "Tạm ngưng",
};

// Khớp với APPROVAL_COLOR đang dùng trong DoctorProfile.tsx trước khi gộp.
export const DOCTOR_APPROVAL_COLOR: Record<string, BadgeColor> = {
    pending: "yellow",
    approved: "green",
    rejected: "red",
    suspended: "gray",
};

export const SERVICE_TYPE_LABEL: Record<string, string> = {
    related: "Dịch vụ liên quan",
    home: "Tại nhà",
};

// Loại khám của LichHen (loai_kham) — khác với DichVu.loai ở trên, không dùng chung 1 map
export const EXAM_TYPE_LABEL: Record<string, string> = {
    clinic: "Phòng khám",
    home: "Tại nhà",
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
    unpaid: "Chưa thanh toán",
    partial: "Thanh toán một phần",
    pending: "Chờ thanh toán",
    paid: "Đã thanh toán",
    failed: "Thất bại",
    refunded: "Đã hoàn tiền",
};

// unpaid/paid/refunded khớp với PAYMENT_COLOR đang dùng trong DoctorAppointments.tsx
// trước khi gộp; partial/pending/failed là màu bổ sung (chưa có nơi nào định nghĩa
// trước đó) theo đúng ngữ nghĩa "vàng = cần chú ý, đỏ = lỗi" đã áp dụng ở nơi khác.
export const PAYMENT_STATUS_COLOR: Record<string, BadgeColor> = {
    unpaid: "yellow",
    partial: "yellow",
    pending: "yellow",
    paid: "blue",
    failed: "red",
    refunded: "gray",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
    tien_mat: "Tiền mặt",
    chuyen_khoan: "Chuyển khoản",
    vi_dien_tu: "Ví điện tử",
    the_ngan_hang: "Thẻ ngân hàng",
    momo: "MoMo",
    vnpay: "VNPay",
    cash: "Tiền mặt",
    bank: "Chuyển khoản",
};

export const NOTIFICATION_TARGET_LABEL: Record<string, string> = {
    all: "Tất cả",
    user: "Bệnh nhân",
    doctor: "Bác sĩ",
};

// ─── Màu trạng thái trang bác sĩ — nguồn duy nhất, khớp với các map cục bộ đã có
// trước khi gộp ở DoctorAppointments/DoctorPendingRecords/DoctorSchedule/DoctorLeaveRequests
// (chưa áp dụng vào các trang ở bước này — chỉ tạo nguồn dùng chung). ─────────────

// Trạng thái hồ sơ khám (KetQuaKhamStatus) — khớp KET_QUA_STATUS_COLOR cũ.
export const KET_QUA_KHAM_STATUS_COLOR: Record<string, BadgeColor> = {
    ban_nhap: "gray",
    cho_xac_nhan: "yellow",
    da_xac_nhan: "green",
    yeu_cau_chinh_sua: "red",
};

// Trạng thái slot lịch làm việc (DoctorSlot.status) — khớp STATUS_COLOR cũ trong DoctorSchedule.
export const SCHEDULE_SLOT_STATUS_COLOR: Record<string, BadgeColor> = {
    active: "green",
    booked: "blue",
    locked: "yellow",
    cancelled: "red",
    expired: "gray",
    pending_payment: "yellow",
};

// Trạng thái yêu cầu nghỉ (DoctorLeaveRequest.trang_thai) — khớp STATUS_COLOR cũ trong DoctorLeaveRequests.
export const DOCTOR_LEAVE_STATUS_COLOR: Record<string, BadgeColor> = {
    cho_duyet: "yellow",
    da_duyet: "green",
    tu_choi: "red",
    da_huy: "gray",
};
