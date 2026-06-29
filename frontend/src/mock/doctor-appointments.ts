import type { DoctorAppointmentDetail } from '@/types'

export const mockDoctorAppointments: DoctorAppointmentDetail[] = [
  {
    id: 1,
    benh_nhan: 'Nguyễn Văn An',
    benh_nhan_id: 101,
    so_dien_thoai: '0901234567',
    ngay_kham: '2024-06-21',
    gio_kham: '08:00',
    loai_kham: 'clinic',
    status: 'pending',
    payment_status: 'paid',
    gia_kham: 350000,
    da_co_ket_qua: false,
  },
  {
    id: 2,
    benh_nhan: 'Trần Thị Bình',
    benh_nhan_id: 102,
    so_dien_thoai: '0907654321',
    ngay_kham: '2024-06-21',
    gio_kham: '09:30',
    loai_kham: 'video',
    status: 'confirmed',
    payment_status: 'paid',
    gia_kham: 350000,
    da_co_ket_qua: false,
  },
]
