import type { Doctor } from '@/types'

export const mockDoctors: Doctor[] = [
  {
    id: 1,
    user_id: 10,
    specialty_id: 1,
    so_nam_kinh_nghiem: 12,
    phi_tu_van: 350000,
    trang_thai_duyet: 'approved',
    so_lan_nop: 1,
    la_hien: true,
    diem_danh_gia: 4.8,
    tong_danh_gia: 156,
    ngay_tao: '2024-01-15',
  },
  {
    id: 2,
    user_id: 11,
    specialty_id: 2,
    so_nam_kinh_nghiem: 8,
    phi_tu_van: 450000,
    trang_thai_duyet: 'approved',
    so_lan_nop: 1,
    la_hien: true,
    diem_danh_gia: 4.5,
    tong_danh_gia: 92,
    ngay_tao: '2024-02-20',
  },
]
