import type { DoctorAppointmentDetail } from '@/types'

const TODAY = new Date().toISOString().slice(0, 10)
const d = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

const PHONG = 'Phòng 201, Tầng 2, Tòa A'

// 9 lịch hẹn — chỉ loai_kham='clinic'. Khám tại nhà (home) tạm bỏ khỏi mock vì chức năng
// đó sẽ làm sau khi xong chức năng chính (theo yêu cầu 2026-07-04) — không demo dở dang.
// Vì vậy không còn trạng thái 'pending' (clinic luôn auto-confirm khi thanh toán, không
// bao giờ ở pending) — "Chưa xác nhận"/"Đóng hồ sơ hàng loạt" (vốn chỉ áp dụng cho home)
// sẽ rỗng, đúng như thiết kế hiện tại, không phải lỗi.
export const mockDoctorAppointments: DoctorAppointmentDetail[] = [
  {
    id: 1, benh_nhan: 'Nguyễn Văn An', benh_nhan_id: 1,
    so_dien_thoai: '0901234567',
    ngay_kham: TODAY, gio_kham: '08:00',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 350000,
    ten_dich_vu: 'Khám tim mạch',
    phong_kham: PHONG,
    ly_do_kham: 'Đau ngực, khó thở khi leo cầu thang.',
    tuoi: 45, gioi_tinh: 'Nam', di_ung: 'Penicillin', benh_nen: 'Cao huyết áp, tiểu đường type 2',
    da_co_ket_qua: false,
  },
  {
    id: 2, benh_nhan: 'Trần Thị Bình', benh_nhan_id: 2,
    so_dien_thoai: '0902345678',
    ngay_kham: TODAY, gio_kham: '08:30',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 350000,
    ten_dich_vu: 'Khám tim mạch',
    phong_kham: PHONG,
    ly_do_kham: 'Kiểm tra sức khỏe định kỳ, đo huyết áp.',
    tuoi: 38, gioi_tinh: 'Nữ', di_ung: null, benh_nen: null,
    da_co_ket_qua: false,
  },
  {
    id: 3, benh_nhan: 'Võ Thị Hoa', benh_nhan_id: 3,
    so_dien_thoai: '0904567890',
    ngay_kham: TODAY, gio_kham: '09:00',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 350000,
    ten_dich_vu: 'Khám tim mạch',
    phong_kham: PHONG,
    ly_do_kham: 'Đau tức ngực nhẹ, hồi hộp.',
    tuoi: 29, gioi_tinh: 'Nữ', di_ung: null, benh_nen: null,
    da_co_ket_qua: false,
  },
  {
    id: 4, benh_nhan: 'Phạm Minh Quân', benh_nhan_id: 4,
    so_dien_thoai: '0905678901',
    ngay_kham: d(1), gio_kham: '08:00',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 350000,
    ten_dich_vu: 'Tái khám huyết áp',
    phong_kham: PHONG,
    ly_do_kham: 'Tái khám sau 1 tháng điều trị huyết áp.',
    tuoi: 60, gioi_tinh: 'Nam', di_ung: 'Aspirin', benh_nen: 'Cao huyết áp giai đoạn 2',
    da_co_ket_qua: false,
  },
  {
    id: 5, benh_nhan: 'Lê Thị Lan', benh_nhan_id: 5,
    so_dien_thoai: '0906789012',
    ngay_kham: d(1), gio_kham: '08:30',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 350000,
    ten_dich_vu: 'Khám tim mạch',
    phong_kham: PHONG,
    ly_do_kham: 'Theo dõi suy tim, tái khám định kỳ.',
    tuoi: 74, gioi_tinh: 'Nữ', di_ung: null, benh_nen: 'Suy tim độ 2, xơ vữa động mạch',
    da_co_ket_qua: false,
  },
  {
    id: 6, benh_nhan: 'Đặng Văn Quân', benh_nhan_id: 6,
    so_dien_thoai: '0907890123',
    ngay_kham: d(2), gio_kham: '08:00',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 350000,
    ten_dich_vu: 'Khám tim mạch',
    phong_kham: PHONG,
    ly_do_kham: 'Khó thở khi gắng sức.',
    tuoi: 41, gioi_tinh: 'Nam', di_ung: null, benh_nen: null,
    da_co_ket_qua: false,
  },
  {
    id: 7, benh_nhan: 'Ngô Thị Tú', benh_nhan_id: 7,
    so_dien_thoai: '0908901234',
    ngay_kham: d(-1), gio_kham: '09:00',
    loai_kham: 'clinic', status: 'completed', payment_status: 'paid', gia_kham: 350000,
    ten_dich_vu: 'Khám tim mạch',
    phong_kham: PHONG,
    ly_do_kham: 'Đau tức ngực trái.',
    tuoi: 55, gioi_tinh: 'Nữ', di_ung: 'Sulfa', benh_nen: 'Tiểu đường type 2',
    da_co_ket_qua: true,
  },
  {
    id: 8, benh_nhan: 'Nguyễn Thị Phương', benh_nhan_id: 8,
    so_dien_thoai: '0916666666',
    ngay_kham: d(-2), gio_kham: '10:30',
    loai_kham: 'clinic', status: 'completed', payment_status: 'paid', gia_kham: 350000,
    ten_dich_vu: 'Tư vấn kết quả xét nghiệm',
    phong_kham: PHONG,
    ly_do_kham: 'Xét nghiệm máu định kỳ — lipid máu, glucose.',
    tuoi: 40, gioi_tinh: 'Nữ', di_ung: null, benh_nen: null,
    da_co_ket_qua: true,
  },
  // Lịch sử đã hủy + hoàn tiền
  {
    id: 9, benh_nhan: 'Phan Văn Hải', benh_nhan_id: 9,
    so_dien_thoai: '0900123456',
    ngay_kham: d(-3), gio_kham: '14:00',
    loai_kham: 'clinic', status: 'cancelled', payment_status: 'refunded', gia_kham: 350000,
    ten_dich_vu: 'Khám tim mạch',
    phong_kham: PHONG,
    ly_do_kham: 'Tim đập nhanh không rõ nguyên nhân.',
    tuoi: 33, gioi_tinh: 'Nam', di_ung: null, benh_nen: null,
    da_co_ket_qua: false,
    ly_do_huy: 'Bệnh nhân bận đột xuất, xin hủy lịch.',
  },
]
