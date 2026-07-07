export type AdminMenuItem =
  | { type: 'item'; path: string; label: string; icon: string; end?: boolean }
  | { type: 'section'; label: string }

export const adminMenu: AdminMenuItem[] = [
  { type: 'item', path: '/admin', label: 'Tong quan', icon: 'dashboard', end: true },
  { type: 'section', label: 'Quan ly' },
  { type: 'item', path: '/admin/users', label: 'Nguoi dung', icon: 'users' },
  { type: 'item', path: '/admin/doctors', label: 'Ho so bac si', icon: 'doctor' },
  { type: 'item', path: '/admin/clinics', label: 'Phong Kham & Chuyen Khoa', icon: 'hospital' },
  { type: 'item', path: '/admin/services', label: 'Dich vu', icon: 'service' },
  { type: 'section', label: 'Hoat dong' },
  { type: 'item', path: '/admin/appointments', label: 'Lich hen', icon: 'calendar' },
  { type: 'item', path: '/admin/reviews', label: 'Danh gia', icon: 'star' },
  { type: 'item', path: '/admin/notifications', label: 'Thong bao', icon: 'bell' },
  { type: 'item', path: '/admin/payments', label: 'Thanh toan', icon: 'payment' },
]
