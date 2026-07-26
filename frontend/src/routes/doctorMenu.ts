export type DoctorMenuItem =
  | { type: 'item'; path: string; label: string; icon: string; end?: boolean }
  | { type: 'section'; label: string }

export const doctorMenu: DoctorMenuItem[] = [
  { type: 'item', path: '/doctor', label: 'Tổng quan', icon: 'dashboard', end: true },
  { type: 'section', label: 'Hành nghề' },
  { type: 'item', path: '/doctor/appointments', label: 'Lịch hẹn của tôi', icon: 'calendar' },
  { type: 'item', path: '/doctor/pending-records', label: 'Hồ sơ chờ khám', icon: 'file-text' },
  { type: 'item', path: '/doctor/schedule', label: 'Lịch làm việc', icon: 'clock' },
  { type: 'item', path: '/doctor/leave-requests', label: 'Xin nghỉ', icon: 'calendar' },
  { type: 'section', label: 'Tài khoản' },
  { type: 'item', path: '/doctor/profile', label: 'Hồ sơ bác sĩ', icon: 'doctor' },
]
