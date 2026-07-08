export type AdminMenuItem =
  | { type: 'item'; path: string; label: string; icon: string; end?: boolean }
  | { type: 'section'; label: string }

export const adminMenu: AdminMenuItem[] = [
  { type: 'item', path: '/admin', label: 'Tổng quan', icon: 'dashboard', end: true },
  { type: 'section', label: 'Quản lý' },
  { type: 'item', path: '/admin/users', label: 'Người dùng', icon: 'users' },
  { type: 'item', path: '/admin/doctors', label: 'Hồ sơ bác sĩ', icon: 'doctor' },
  { type: 'item', path: '/admin/clinics', label: 'Phòng khám & Chuyên khoa', icon: 'hospital' },
  { type: 'item', path: '/admin/services', label: 'Dịch vụ', icon: 'service' },
  { type: 'section', label: 'Hoạt động' },
  { type: 'item', path: '/admin/appointments', label: 'Lịch hẹn', icon: 'calendar' },
  { type: 'item', path: '/admin/reviews', label: 'Đánh giá', icon: 'star' },
  { type: 'item', path: '/admin/notifications', label: 'Thông báo', icon: 'bell' },
  { type: 'item', path: '/admin/payments', label: 'Thanh toán', icon: 'payment' },
]
