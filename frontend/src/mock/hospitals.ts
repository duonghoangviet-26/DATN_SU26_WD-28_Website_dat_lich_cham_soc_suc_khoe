import type { HospitalItem, SpecialtyItem } from '@/types'

export const mockHospitals: HospitalItem[] = [
  { id: 1, ten: 'Bệnh viện Đa khoa VitaFamily', dia_chi: '123 Đường Phổ Quang, Tân Bình, TP.HCM', so_dien_thoai: '1900 1234', gio_lam_viec: '07:00 - 21:00', status: 'active', ngay_tao: '2024-01-01' },
  { id: 2, ten: 'Phòng khám Vita cơ sở 2', dia_chi: '456 Đường Nguyễn Huệ, Quận 1, TP.HCM', so_dien_thoai: '1900 5678', gio_lam_viec: '08:00 - 18:00', status: 'active', ngay_tao: '2024-02-10' },
]

export const mockSpecialties: SpecialtyItem[] = [
  { id: 1, ten: 'Nhi khoa', mo_ta: 'Khám và điều trị các bệnh cho trẻ em', icon: 'Baby', thu_tu: 1, status: 'active' },
  { id: 2, ten: 'Sản phụ khoa', mo_ta: 'Chăm sóc sức khỏe phụ nữ và thai sản', icon: 'Female', thu_tu: 2, status: 'active' },
  { id: 3, ten: 'Nội tổng quát', mo_ta: 'Khám các bệnh nội khoa phổ biến', icon: 'User', thu_tu: 3, status: 'active' },
]
