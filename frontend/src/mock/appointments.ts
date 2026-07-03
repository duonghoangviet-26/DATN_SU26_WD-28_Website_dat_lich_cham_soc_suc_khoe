import type { AppointmentItem } from '@/types'

const TODAY = new Date().toISOString().slice(0, 10)

// Luồng home (xem docs/superpowers/specs/2026-07-02-home-service-redesign.md §2.5):
//   pending   → bac_si=null (đã thanh toán, CHƯA gán nhân viên lấy mẫu)
//   confirmed → bac_si=<home_staff> (CSKH đã gán), ket_qua_url=null (chờ lab)
//   completed → bac_si=<home_staff>, ket_qua_url=<url> (đã có PDF kết quả)
//   cancelled → bac_si tùy thời điểm hủy — null nếu hủy trước khi gán nhân viên
export const mockAppointments: AppointmentItem[] = [
  {
    id: 1, benh_nhan: 'Nguyễn Văn An', bac_si: 'BS. Lê Hoàng Cường',
    chuyen_khoa: 'Tim mạch', ngay_kham: TODAY, gio_kham: '08:30',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 350000,
    ten_dich_vu: 'Tim mạch',
  },
  {
    // clinic + paid ⇒ auto-confirm ngay khi tạo lịch (quyết định 2026-07-02) — không còn 'pending' cho clinic
    id: 2, benh_nhan: 'Trần Thị Bình', bac_si: 'BS. Phạm Thu Dung',
    chuyen_khoa: 'Nhi khoa', ngay_kham: TODAY, gio_kham: '10:00',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 250000,
    ten_dich_vu: 'Nhi khoa',
  },
  {
    // home+completed — nhân viên lấy mẫu (KHÔNG phải bác sĩ chuyên khoa), đã có kết quả PDF
    id: 3, benh_nhan: 'Hoàng Văn Em', bac_si: 'Nguyễn Thị Hằng',
    chuyen_khoa: 'Nhân viên lấy mẫu tại nhà', ngay_kham: TODAY, gio_kham: '14:00',
    loai_kham: 'home', status: 'completed', payment_status: 'paid', gia_kham: 500000,
    ten_dich_vu: 'Lấy mẫu xét nghiệm máu tại nhà',
    ket_qua_url: 'https://storage.vitafamily.vn/ket-qua/dv003-hoang-van-em.pdf',
  },
  {
    id: 4, benh_nhan: 'Võ Thị Hoa', bac_si: 'BS. Phạm Thu Dung',
    chuyen_khoa: 'Nhi khoa', ngay_kham: TODAY, gio_kham: '09:00',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 280000,
    ten_dich_vu: 'Nhi khoa',
  },
  {
    // home+cancelled — hủy trước khi CSKH kịp gán nhân viên ⇒ bac_si vẫn null
    id: 5, benh_nhan: 'Lý Minh Tuấn', bac_si: null,
    chuyen_khoa: '', ngay_kham: '2026-06-10', gio_kham: '11:30',
    loai_kham: 'home', status: 'cancelled', payment_status: 'refunded', gia_kham: 350000,
    ten_dich_vu: 'Lấy mẫu xét nghiệm nước tiểu tại nhà',
  },
  {
    id: 6, benh_nhan: 'Phạm Thị Ngọc', bac_si: 'BS. Phạm Thu Dung',
    chuyen_khoa: 'Nhi khoa', ngay_kham: '2026-06-17', gio_kham: '15:30',
    loai_kham: 'clinic', status: 'confirmed', payment_status: 'paid', gia_kham: 280000,
    ten_dich_vu: 'Nhi khoa',
  },
  {
    id: 7, benh_nhan: 'Đặng Văn Quân', bac_si: 'BS. Lê Hoàng Cường',
    chuyen_khoa: 'Tim mạch', ngay_kham: '2026-06-11', gio_kham: '08:00',
    loai_kham: 'clinic', status: 'completed', payment_status: 'paid', gia_kham: 350000,
    ten_dich_vu: 'Tim mạch',
  },
  {
    // home+pending+paid — BN đã thanh toán trước, đang chờ CSKH gán nhân viên (luồng home mới) ⇒ bac_si=null
    id: 8, benh_nhan: 'Ngô Thị Tú', bac_si: null,
    chuyen_khoa: '', ngay_kham: '2026-06-18', gio_kham: '13:00',
    loai_kham: 'home', status: 'pending', payment_status: 'paid', gia_kham: 500000,
    ten_dich_vu: 'Lấy mẫu xét nghiệm tại nhà',
  },
  {
    // home+confirmed — CSKH đã gán nhân viên, đang chờ lab trả kết quả (ket_qua_url=null)
    id: 9, benh_nhan: 'Bùi Thị Thanh', bac_si: 'Trần Văn Phúc',
    chuyen_khoa: 'Nhân viên lấy mẫu tại nhà', ngay_kham: '2026-07-05', gio_kham: '09:30',
    loai_kham: 'home', status: 'confirmed', payment_status: 'paid', gia_kham: 500000,
    ten_dich_vu: 'Lấy mẫu xét nghiệm máu tại nhà', ket_qua_url: null,
  },
]
