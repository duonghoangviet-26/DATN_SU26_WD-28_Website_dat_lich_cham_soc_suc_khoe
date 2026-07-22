export type NurseMenuItem =
  | { type: 'item'; path: string; label: string; icon: string; end?: boolean }
  | { type: 'section'; label: string }

export const nurseMenu: NurseMenuItem[] = [
  { type: 'item', path: '/nurse', label: 'Tổng quan', icon: 'dashboard', end: true },
  { type: 'section', label: 'Công việc' },
  { type: 'item', path: '/nurse/schedule', label: 'Ca làm việc', icon: 'clock' },
  { type: 'item', path: '/nurse/queue', label: 'Hàng đợi bệnh nhân', icon: 'calendar' },
  { type: 'item', path: '/nurse/pending-records', label: 'Hồ sơ cần nhập', icon: 'file-text' },
  { type: 'item', path: '/nurse/revisions', label: 'Hồ sơ cần chỉnh sửa', icon: 'edit' },
]
