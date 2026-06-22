import type { DoctorAppointmentDetail } from '@/types'

const TODAY = new Date().toISOString().slice(0, 10)
const d = (offset: number) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

export const mockDoctorAppointments: DoctorAppointmentDetail[] = [
  // Hôm nay — confirmed
  {
    id: 1, benh_nhan: 'Nguyễn Văn An', benh_nhan_id: 1,
    so_dien_thoai: '0901234567',
    ngay_kham: TODAY, gio_kham: '07:30',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 350000,
    ly_do_kham: 'Đau ngực, khó thở khi leo cầu thang.',
    tuoi: 45, gioi_tinh: 'Nam', di_ung: 'Penicillin', benh_nen: 'Cao huyết áp, tiểu đường type 2',
    da_co_ket_qua: true,
  },
  {
    id: 2, benh_nhan: 'Trần Thị Bình', benh_nhan_id: 2,
    so_dien_thoai: '0902345678',
    ngay_kham: TODAY, gio_kham: '08:00',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 350000,
    ly_do_kham: 'Kiểm tra sức khỏe định kỳ, đo huyết áp.',
    tuoi: 38, gioi_tinh: 'Nữ', di_ung: null, benh_nen: null,
    da_co_ket_qua: false,
  },
  {
    id: 3, benh_nhan: 'Hoàng Văn Em', benh_nhan_id: 3,
    so_dien_thoai: '0903456789',
    ngay_kham: TODAY, gio_kham: '08:30',
    loai_kham: 'video', status: 'pending', payment_status: 'unpaid', gia_kham: 250000,
    ly_do_kham: 'Hỏi về kết quả xét nghiệm cholesterol.',
    tuoi: 52, gioi_tinh: 'Nam', di_ung: null, benh_nen: 'Rối loạn mỡ máu',
    da_co_ket_qua: false,
  },
  {
    id: 4, benh_nhan: 'Võ Thị Hoa', benh_nhan_id: 4,
    so_dien_thoai: '0904567890',
    ngay_kham: TODAY, gio_kham: '09:00',
    loai_kham: 'clinic', status: 'pending', payment_status: 'unpaid', gia_kham: 350000,
    ly_do_kham: 'Tim đập không đều, hay hồi hộp.',
    tuoi: 29, gioi_tinh: 'Nữ', di_ung: null, benh_nen: null,
    da_co_ket_qua: false,
  },
  // Ngày mai — upcoming
  {
    id: 5, benh_nhan: 'Phạm Minh Quân', benh_nhan_id: 5,
    so_dien_thoai: '0905678901',
    ngay_kham: d(1), gio_kham: '08:00',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 350000,
    ly_do_kham: 'Tái khám sau 1 tháng điều trị huyết áp.',
    tuoi: 60, gioi_tinh: 'Nam', di_ung: 'Aspirin', benh_nen: 'Cao huyết áp giai đoạn 2',
    da_co_ket_qua: false,
  },
  {
    id: 6, benh_nhan: 'Lê Thị Lan', benh_nhan_id: 6,
    so_dien_thoai: '0906789012',
    ngay_kham: d(1), gio_kham: '08:30',
    loai_kham: 'home', status: 'confirmed', payment_status: 'paid', gia_kham: 700000,
    ly_do_kham: 'Bệnh nhân không thể đi lại, cần khám tại nhà.',
    tuoi: 74, gioi_tinh: 'Nữ', di_ung: null, benh_nen: 'Suy tim độ 2, xơ vữa động mạch',
    da_co_ket_qua: false,
  },
  {
    id: 7, benh_nhan: 'Đặng Văn Quân', benh_nhan_id: 7,
    so_dien_thoai: '0907890123',
    ngay_kham: d(2), gio_kham: '08:00',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 350000,
    ly_do_kham: 'Khó thở khi gắng sức.',
    tuoi: 41, gioi_tinh: 'Nam', di_ung: null, benh_nen: null,
    da_co_ket_qua: false,
  },
  // Đã qua — completed
  {
    id: 8, benh_nhan: 'Ngô Thị Tú', benh_nhan_id: 8,
    so_dien_thoai: '0908901234',
    ngay_kham: d(-1), gio_kham: '09:00',
    loai_kham: 'clinic', status: 'completed', payment_status: 'paid', gia_kham: 350000,
    ly_do_kham: 'Đau tức ngực trái.',
    tuoi: 55, gioi_tinh: 'Nữ', di_ung: 'Sulfa', benh_nen: 'Tiểu đường type 2',
    da_co_ket_qua: true,
  },
  {
    id: 9, benh_nhan: 'Lý Minh Tuấn', benh_nhan_id: 9,
    so_dien_thoai: '0909012345',
    ngay_kham: d(-2), gio_kham: '08:30',
    loai_kham: 'video', status: 'completed', payment_status: 'paid', gia_kham: 250000,
    ly_do_kham: 'Hỏi kết quả siêu âm tim.',
    tuoi: 48, gioi_tinh: 'Nam', di_ung: null, benh_nen: null,
    da_co_ket_qua: true,
  },
  {
    id: 10, benh_nhan: 'Phan Văn Hải', benh_nhan_id: 10,
    so_dien_thoai: '0900123456',
    ngay_kham: d(-3), gio_kham: '14:00',
    loai_kham: 'clinic', status: 'cancelled', payment_status: 'refunded', gia_kham: 350000,
    ly_do_kham: 'Tim đập nhanh không rõ nguyên nhân.',
    tuoi: 33, gioi_tinh: 'Nam', di_ung: null, benh_nen: null,
    da_co_ket_qua: false,
    ly_do_huy: 'Bệnh nhân bận đột xuất, xin hủy lịch.',
  },
  // id 11 — test TC-C01: pending + paid → nút "Xác nhận" xuất hiện
  {
    id: 11, benh_nhan: 'Bùi Thị Cẩm', benh_nhan_id: 11,
    so_dien_thoai: '0911111111',
    ngay_kham: TODAY, gio_kham: '10:00',
    loai_kham: 'clinic', status: 'pending', payment_status: 'paid', gia_kham: 400000,
    ly_do_kham: 'Đau đầu kéo dài, chóng mặt.',
    tuoi: 35, gioi_tinh: 'Nữ', di_ung: null, benh_nen: 'Migraine mãn tính',
    da_co_ket_qua: false,
  },
  // id 12 — test TC-EDG09: pending đã qua ngày → badge "Hết hạn"
  {
    id: 12, benh_nhan: 'Trương Văn Bình', benh_nhan_id: 12,
    so_dien_thoai: '0912222222',
    ngay_kham: d(-4), gio_kham: '14:00',
    loai_kham: 'home', status: 'pending', payment_status: 'unpaid', gia_kham: 600000,
    ly_do_kham: 'Kiểm tra sau phẫu thuật.',
    tuoi: 67, gioi_tinh: 'Nam', di_ung: 'Ibuprofen', benh_nen: 'Sau phẫu thuật tim',
    da_co_ket_qua: false,
  },
  // id 13 — test TC-CO03: completed chưa có kết quả → nút "Nhập kết quả"
  {
    id: 13, benh_nhan: 'Hoàng Thị Dung', benh_nhan_id: 13,
    so_dien_thoai: '0913333333',
    ngay_kham: d(-1), gio_kham: '11:00',
    loai_kham: 'video', status: 'completed', payment_status: 'paid', gia_kham: 250000,
    ly_do_kham: 'Hỏi về kết quả xét nghiệm máu.',
    tuoi: 44, gioi_tinh: 'Nữ', di_ung: null, benh_nen: null,
    da_co_ket_qua: false,
  },
]
