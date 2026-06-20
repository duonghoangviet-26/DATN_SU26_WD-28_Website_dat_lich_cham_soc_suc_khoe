// Các hằng số dùng chung toàn hệ thống.
// Khớp với ENUM trong cơ sở dữ liệu (xem VitaFamily_Database.sql).

// Vai trò người dùng
export const ROLES = {
  USER: 'user', // bệnh nhân
  DOCTOR: 'doctor', // bác sĩ đã được duyệt
  ADMIN: 'admin', // quản trị viên
}

export const ROLE_LABEL = {
  user: 'Bệnh nhân',
  doctor: 'Bác sĩ',
  admin: 'Quản trị viên',
}

// Trạng thái tài khoản
export const USER_STATUS = {
  ACTIVE: 'active',
  LOCKED: 'locked',
}

export const USER_STATUS_LABEL = {
  active: 'Hoạt động',
  locked: 'Đã khóa',
}

// Trạng thái duyệt hồ sơ bác sĩ
export const DOCTOR_APPROVAL = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
}

// Trạng thái lịch hẹn
export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

export const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

export const DOCTOR_APPROVAL_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  suspended: 'Tạm ngưng',
}

export const SERVICE_TYPE_LABEL: Record<string, string> = {
  clinic: 'Phòng khám',
  home:   'Tại nhà',
}

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  unpaid: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  refunded: 'Đã hoàn tiền',
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  momo: 'MoMo',
  vnpay: 'VNPay',
  cash: 'Tiền mặt',
  bank: 'Chuyển khoản',
}

export const NOTIFICATION_TARGET_LABEL: Record<string, string> = {
  all: 'Tất cả',
  user: 'Bệnh nhân',
  doctor: 'Bác sĩ',
}
