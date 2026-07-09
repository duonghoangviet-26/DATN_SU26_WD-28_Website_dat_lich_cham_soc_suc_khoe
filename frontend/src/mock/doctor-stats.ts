import type { DoctorProfile } from '@/types'

export const mockDoctorProfile: DoctorProfile = {
  id: 100,
  user_id: 99,
  ho_ten: 'BS. Demo',
  email: 'doctor@vitafamily.vn',
  chuyen_khoa: 'Tim mạch',
  so_nam_kinh_nghiem: 8,
  gia_kham: 350000,
  trang_thai_duyet: 'approved',
  diem_danh_gia: 4.8,
  so_danh_gia: 156,
  bang_cap: 'Thạc sĩ Y khoa - ĐH Y Dược TP.HCM',
  ngay_tao: '2024-01-15T08:00:00Z',
}

export const mockDoctorProfileExtra = {
  tieu_su: 'Bác sĩ Lê Hoàng Cường có hơn 12 năm kinh nghiệm trong lĩnh vực Nhi khoa. Ông từng công tác tại các bệnh viện lớn và có nhiều công trình nghiên cứu về dinh dưỡng trẻ em.',
  benh_vien_chinh: 'Bệnh viện Đa khoa VitaFamily',
}
