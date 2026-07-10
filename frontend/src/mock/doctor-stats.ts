import type { DoctorProfile, DoctorStats, DoctorReview } from '@/types'

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

export const mockDoctorStats: DoctorStats = {
  tong_luot_kham: 1250,
  thang_nay: 145,
  ty_le_hoan_thanh: 95,
  ty_le_huy: 2,
  diem_danh_gia: 4.8,
  so_danh_gia: 156,
  doanh_thu_thang: 45000000,
}

export const mockDoctorReviews: DoctorReview[] = [
  {
    id: 1,
    benh_nhan: 'Nguyễn Minh Anh',
    diem: 5,
    noi_dung: 'Bác sĩ rất nhiệt tình và thấu hiểu tâm lý trẻ em.',
    ngay_tao: '2024-06-15T10:00:00Z',
  },
  {
    id: 2,
    benh_nhan: 'Trần Thanh Tâm',
    diem: 4,
    noi_dung: 'Tư vấn kỹ, tuy nhiên đôi khi phải chờ hơi lâu một chút.',
    ngay_tao: '2024-06-14T15:30:00Z',
  },
]
