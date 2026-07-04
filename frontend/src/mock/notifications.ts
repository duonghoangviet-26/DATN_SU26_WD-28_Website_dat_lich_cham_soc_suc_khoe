import type { NotificationItem } from '@/types'

export const mockNotifications: NotificationItem[] = [
  {
    id: 1,
    tieu_de: 'Bảo trì hệ thống định kỳ',
    noi_dung: 'Hệ thống sẽ bảo trì từ 00:00 đến 02:00 ngày 20/06/2026. Vui lòng hoàn thành lịch hẹn trước thời điểm này.',
    doi_tuong: 'tat_ca',
    so_nguoi_nhan: 1248,
    ngay_gui: '2026-06-10T08:00:00',
  },
  {
    id: 2,
    tieu_de: 'Cập nhật chính sách thanh toán',
    noi_dung: 'VitaFamily đã thêm phương thức thanh toán VNPay. Bệnh nhân có thể thanh toán tiện lợi hơn khi đặt lịch.',
    doi_tuong: 'benh_nhan',
    so_nguoi_nhan: 1162,
    ngay_gui: '2026-06-08T09:30:00',
  },
  {
    id: 3,
    tieu_de: 'Hướng dẫn xác minh hồ sơ bác sĩ',
    noi_dung: 'Nhắc nhở các bác sĩ cần nộp đầy đủ hồ sơ công chứng trước ngày 30/06/2026 để tránh bị tạm ngưng tài khoản.',
    doi_tuong: 'bac_si',
    so_nguoi_nhan: 86,
    ngay_gui: '2026-06-05T10:00:00',
  },
  {
    id: 4,
    tieu_de: 'Tính năng mới: Khám tại nhà',
    noi_dung: 'VitaFamily vừa ra mắt dịch vụ khám tại nhà tại Hà Nội và TP.HCM. Đặt lịch ngay để trải nghiệm!',
    doi_tuong: 'benh_nhan',
    so_nguoi_nhan: 1162,
    ngay_gui: '2026-06-01T07:00:00',
  },
  {
    id: 5,
    tieu_de: 'Chúc mừng tháng Bác sĩ',
    noi_dung: 'Nhân ngày Thầy thuốc Việt Nam 27/02, VitaFamily trân trọng cảm ơn đội ngũ bác sĩ đã đồng hành cùng chúng tôi.',
    doi_tuong: 'bac_si',
    so_nguoi_nhan: 86,
    ngay_gui: '2026-02-27T06:00:00',
  },
]
