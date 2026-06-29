import type { DoctorSlot } from '@/types'

export const mockSlots: DoctorSlot[] = [
  {
    id: 1,
    ngay: '2024-06-25',
    gio_bat_dau: '08:00',
    gio_ket_thuc: '08:30',
    so_benh_nhan_toi_da: 1,
    so_benh_nhan_hien_tai: 1,
    status: 'active',
  },
  {
    id: 2,
    ngay: '2024-06-25',
    gio_bat_dau: '08:30',
    gio_ket_thuc: '09:00',
    so_benh_nhan_toi_da: 1,
    so_benh_nhan_hien_tai: 0,
    status: 'active',
  },
]
