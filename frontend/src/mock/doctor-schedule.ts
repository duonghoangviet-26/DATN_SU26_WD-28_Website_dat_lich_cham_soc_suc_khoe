import type { DoctorSlot } from '@/types'

const d = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

export const mockSlots: DoctorSlot[] = [
  // Hôm nay
  { id: 1, ngay: d(0), gio_bat_dau: '07:30', gio_ket_thuc: '08:00', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 1, status: 'locked' },
  { id: 2, ngay: d(0), gio_bat_dau: '08:00', gio_ket_thuc: '08:30', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 1, status: 'locked' },
  { id: 3, ngay: d(0), gio_bat_dau: '08:30', gio_ket_thuc: '09:00', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 0, status: 'active' },
  { id: 4, ngay: d(0), gio_bat_dau: '09:00', gio_ket_thuc: '09:30', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 0, status: 'active' },
  // Ngày mai
  { id: 5, ngay: d(1), gio_bat_dau: '08:00', gio_ket_thuc: '08:30', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 1, status: 'locked' },
  { id: 6, ngay: d(1), gio_bat_dau: '08:30', gio_ket_thuc: '09:00', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 0, status: 'active' },
  { id: 7, ngay: d(1), gio_bat_dau: '09:00', gio_ket_thuc: '09:30', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 0, status: 'active' },
  { id: 8, ngay: d(1), gio_bat_dau: '14:00', gio_ket_thuc: '14:30', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 0, status: 'active' },
  // Ngày kia
  { id: 9, ngay: d(2), gio_bat_dau: '08:00', gio_ket_thuc: '08:30', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 0, status: 'active' },
  { id: 10, ngay: d(2), gio_bat_dau: '08:30', gio_ket_thuc: '09:00', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 0, status: 'active' },
  // +3 ngày
  { id: 11, ngay: d(3), gio_bat_dau: '07:30', gio_ket_thuc: '08:00', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 1, status: 'locked' },
  { id: 12, ngay: d(3), gio_bat_dau: '08:00', gio_ket_thuc: '08:30', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 0, status: 'active' },
  // +4 ngày
  { id: 13, ngay: d(4), gio_bat_dau: '14:00', gio_ket_thuc: '14:30', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 0, status: 'active' },
  { id: 14, ngay: d(4), gio_bat_dau: '14:30', gio_ket_thuc: '15:00', so_benh_nhan_toi_da: 1, so_benh_nhan_hien_tai: 0, status: 'active' },
]
