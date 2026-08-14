export type DoctorMenuItem =
  | { type: 'item'; path: string; label: string; icon: string; end?: boolean }
  | { type: 'section'; label: string }

export const doctorMenu: DoctorMenuItem[] = [
  { type: 'item', path: '/doctor', label: 'Tổng quan khám bệnh', icon: 'dashboard', end: true },
  { type: 'section', label: 'Chuyên môn' },
  { type: 'item', path: '/doctor/appointments', label: 'Lịch khám của tôi', icon: 'calendar' },
  { type: 'item', path: '/doctor/pending-records', label: 'Hồ sơ khám chờ xử lý', icon: 'clipboard-list' },
  { type: 'item', path: '/doctor/exam-history', label: 'Bệnh nhân đã khám', icon: 'eye' },
  { type: 'item', path: '/doctor/schedule', label: 'Lịch làm việc cá nhân', icon: 'clock' },
  { type: 'item', path: '/doctor/leave-requests', label: 'Đăng ký nghỉ phép', icon: 'calendar' },
  { type: 'section', label: 'Tài khoản' },
  { type: 'item', path: '/doctor/profile', label: 'Hồ sơ chuyên môn', icon: 'doctor' },
]
