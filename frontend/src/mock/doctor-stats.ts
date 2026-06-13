import type { DoctorStats, DoctorReview, DoctorProfile } from '@/types'

export const mockDoctorProfile: DoctorProfile = {
  id: 100,
  user_id: 99,
  ho_ten: 'BS. Demo',
  email: 'doctor@vitafamily.vn',
  chuyen_khoa: 'Tim mạch',
  so_nam_kinh_nghiem: 8,
  phi_tu_van: 350000,
  trang_thai_duyet: 'approved',
  diem_danh_gia: 4.8,
  so_danh_gia: 124,
  bang_cap: 'Thạc sĩ Y khoa — Đại học Y Hà Nội',
  ngay_tao: '2026-01-01T00:00:00',
}

export const mockDoctorProfileExtra = {
  tieu_su: 'Bác sĩ chuyên khoa Tim mạch với hơn 8 năm kinh nghiệm công tác tại các bệnh viện hàng đầu. Chuyên điều trị các bệnh lý tim mạch phức tạp như suy tim, rối loạn nhịp tim và bệnh mạch vành.',
  chuyen_khoa_id: 1,
  benh_vien_chinh: 'Bệnh viện Đa khoa VitaFamily Hà Nội',
}

export const mockDoctorStats: DoctorStats = {
  tong_luot_kham: 248,
  thang_nay: 34,
  ty_le_hoan_thanh: 92.5,
  ty_le_huy: 4.2,
  diem_danh_gia: 4.8,
  so_danh_gia: 124,
  doanh_thu_thang: 11900000,
}

export const mockDoctorReviews: DoctorReview[] = [
  {
    id: 1, benh_nhan: 'Nguyễn Văn An', diem: 5,
    noi_dung: 'Bác sĩ rất tận tâm, giải thích rõ ràng tình trạng bệnh và hướng điều trị. Tôi rất yên tâm sau buổi khám!',
    ngay_tao: '2026-06-14T10:20:00',
  },
  {
    id: 2, benh_nhan: 'Trần Thị Bình', diem: 5,
    noi_dung: 'Lần đầu khám tim mạch, rất hài lòng. Bác sĩ kiên nhẫn lắng nghe và giải đáp mọi thắc mắc.',
    ngay_tao: '2026-06-12T09:15:00',
  },
  {
    id: 3, benh_nhan: 'Đặng Văn Quân', diem: 4,
    noi_dung: 'Khám kỹ lưỡng, bác sĩ có chuyên môn cao. Đợi hơi lâu nhưng chất lượng tốt.',
    ngay_tao: '2026-06-10T14:30:00',
  },
  {
    id: 4, benh_nhan: 'Ngô Thị Tú', diem: 5,
    noi_dung: 'Rất hài lòng! Bác sĩ phát hiện sớm tình trạng tim của tôi, điều trị kịp thời.',
    ngay_tao: '2026-06-08T11:00:00',
  },
  {
    id: 5, benh_nhan: 'Phan Văn Hải', diem: 4,
    noi_dung: 'Chuyên môn tốt, tư vấn chi tiết. Sẽ quay lại tái khám theo lịch.',
    ngay_tao: '2026-06-05T16:00:00',
  },
]
