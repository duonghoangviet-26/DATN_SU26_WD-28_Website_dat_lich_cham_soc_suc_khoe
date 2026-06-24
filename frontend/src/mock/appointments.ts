import type { AppointmentItem } from '@/types'

export const mockAppointments: AppointmentItem[] = [
  { id: 1, benh_nhan: 'Nguyễn Văn An', bac_si: 'BS. Lê Hoàng Cường', chuyen_khoa: 'Nhi khoa', ngay_kham: '2024-06-21', gio_kham: '08:00', loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 350000 },
  { id: 2, benh_nhan: 'Trần Thị Bình', bac_si: 'BS. Phạm Thu Dung', chuyen_khoa: 'Sản phụ khoa', ngay_kham: '2024-06-21', gio_kham: '09:30', loai_kham: 'home', status: 'pending', payment_status: 'unpaid', gia_kham: 450000 },
  { id: 3, benh_nhan: 'Lê Văn Chính', bac_si: 'BS. Lê Hoàng Cường', chuyen_khoa: 'Nhi khoa', ngay_kham: '2024-06-20', gio_kham: '14:00', loai_kham: 'clinic', status: 'completed', payment_status: 'paid', gia_kham: 350000 },
]
