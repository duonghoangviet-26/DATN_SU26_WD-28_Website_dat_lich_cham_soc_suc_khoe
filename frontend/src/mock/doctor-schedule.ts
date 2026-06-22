import type { DoctorSlot } from '@/types'

const d = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

export const mockSlots: DoctorSlot[] = [
  // Hôm qua — expired/booked (lịch sử)
  { id: 1,  ngay: d(-1), gio_bat_dau: '08:00', gio_ket_thuc: '08:30', phong_kham: 'Phòng 201, Tầng 2, Tòa A', benh_nhan: 'Nguyễn Văn An', benh_nhan_id: 1, status: 'booked' },
  { id: 2,  ngay: d(-1), gio_bat_dau: '08:30', gio_ket_thuc: '09:00', phong_kham: 'Phòng 201, Tầng 2, Tòa A', benh_nhan: null, benh_nhan_id: null, status: 'expired' },

  // Hôm nay
  { id: 3,  ngay: d(0),  gio_bat_dau: '08:00', gio_ket_thuc: '08:30', phong_kham: 'Phòng 201, Tầng 2, Tòa A', benh_nhan: 'Trần Thị Bình', benh_nhan_id: 2, status: 'booked' },
  { id: 4,  ngay: d(0),  gio_bat_dau: '08:30', gio_ket_thuc: '09:00', phong_kham: 'Phòng 201, Tầng 2, Tòa A', benh_nhan: null, benh_nhan_id: null, status: 'active' },
  { id: 5,  ngay: d(0),  gio_bat_dau: '09:00', gio_ket_thuc: '09:30', phong_kham: null,                         benh_nhan: null, benh_nhan_id: null, status: 'active' },
  { id: 6,  ngay: d(0),  gio_bat_dau: '14:00', gio_ket_thuc: '14:30', phong_kham: 'Phòng 305, Tầng 3, Tòa B', benh_nhan: null, benh_nhan_id: null, status: 'locked' },

  // Ngày mai
  { id: 7,  ngay: d(1),  gio_bat_dau: '08:00', gio_ket_thuc: '08:30', phong_kham: 'Phòng 201, Tầng 2, Tòa A', benh_nhan: 'Phạm Minh Quân', benh_nhan_id: 5, status: 'booked' },
  { id: 8,  ngay: d(1),  gio_bat_dau: '08:30', gio_ket_thuc: '09:00', phong_kham: 'Phòng 201, Tầng 2, Tòa A', benh_nhan: null, benh_nhan_id: null, status: 'active' },
  { id: 9,  ngay: d(1),  gio_bat_dau: '09:00', gio_ket_thuc: '09:30', phong_kham: 'Phòng 201, Tầng 2, Tòa A', benh_nhan: null, benh_nhan_id: null, status: 'active' },

  // +2 ngày
  { id: 10, ngay: d(2),  gio_bat_dau: '08:00', gio_ket_thuc: '08:30', phong_kham: 'Phòng 305, Tầng 3, Tòa B', benh_nhan: null, benh_nhan_id: null, status: 'active' },
  { id: 11, ngay: d(2),  gio_bat_dau: '14:00', gio_ket_thuc: '14:30', phong_kham: 'Phòng 305, Tầng 3, Tòa B', benh_nhan: null, benh_nhan_id: null, status: 'active' },

  // +3 ngày
  { id: 12, ngay: d(3),  gio_bat_dau: '07:30', gio_ket_thuc: '08:00', phong_kham: null,                         benh_nhan: null, benh_nhan_id: null, status: 'active' },
  { id: 13, ngay: d(3),  gio_bat_dau: '08:00', gio_ket_thuc: '08:30', phong_kham: 'Phòng 201, Tầng 2, Tòa A', benh_nhan: null, benh_nhan_id: null, status: 'locked' },

  // +4 ngày
  { id: 14, ngay: d(4),  gio_bat_dau: '14:00', gio_ket_thuc: '14:30', phong_kham: 'Phòng 305, Tầng 3, Tòa B', benh_nhan: null, benh_nhan_id: null, status: 'active' },
]
