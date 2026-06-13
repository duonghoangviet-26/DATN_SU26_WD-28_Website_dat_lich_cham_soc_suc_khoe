import type { AppointmentItem } from '@/types'

const TODAY = new Date().toISOString().slice(0, 10)

export const mockAppointments: AppointmentItem[] = [
  {
    id: 1, benh_nhan: 'Nguyễn Văn An', bac_si: 'BS. Lê Hoàng Cường',
    chuyen_khoa: 'Tim mạch', ngay_kham: TODAY, gio_kham: '08:30',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 350000,
  },
  {
    id: 2, benh_nhan: 'Trần Thị Bình', bac_si: 'BS. Phạm Thu Dung',
    chuyen_khoa: 'Nhi khoa', ngay_kham: TODAY, gio_kham: '10:00',
    loai_kham: 'video', status: 'pending', payment_status: 'unpaid', gia_kham: 250000,
  },
  {
    id: 3, benh_nhan: 'Hoàng Văn Em', bac_si: 'BS. Lê Hoàng Cường',
    chuyen_khoa: 'Tim mạch', ngay_kham: TODAY, gio_kham: '14:00',
    loai_kham: 'home', status: 'completed', payment_status: 'paid', gia_kham: 700000,
  },
  {
    id: 4, benh_nhan: 'Võ Thị Hoa', bac_si: 'BS. Phạm Thu Dung',
    chuyen_khoa: 'Nhi khoa', ngay_kham: TODAY, gio_kham: '09:00',
    loai_kham: 'clinic', status: 'pending', payment_status: 'unpaid', gia_kham: 280000,
  },
  {
    id: 5, benh_nhan: 'Lý Minh Tuấn', bac_si: 'BS. Lê Hoàng Cường',
    chuyen_khoa: 'Tim mạch', ngay_kham: '2026-06-10', gio_kham: '11:30',
    loai_kham: 'video', status: 'cancelled', payment_status: 'refunded', gia_kham: 350000,
  },
  {
    id: 6, benh_nhan: 'Phạm Thị Ngọc', bac_si: 'BS. Phạm Thu Dung',
    chuyen_khoa: 'Nhi khoa', ngay_kham: '2026-06-17', gio_kham: '15:30',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 280000,
  },
  {
    id: 7, benh_nhan: 'Đặng Văn Quân', bac_si: 'BS. Lê Hoàng Cường',
    chuyen_khoa: 'Tim mạch', ngay_kham: '2026-06-11', gio_kham: '08:00',
    loai_kham: 'clinic', status: 'completed', payment_status: 'paid', gia_kham: 350000,
  },
  {
    id: 8, benh_nhan: 'Ngô Thị Tú', bac_si: 'BS. Phạm Thu Dung',
    chuyen_khoa: 'Nhi khoa', ngay_kham: '2026-06-18', gio_kham: '13:00',
    loai_kham: 'home', status: 'pending', payment_status: 'unpaid', gia_kham: 500000,
  },
]
