import type { ReviewItem } from '@/types'

export const mockReviews: ReviewItem[] = [
  {
    id: 1, benh_nhan: 'Nguyễn Văn An', bac_si: 'BS. Lê Hoàng Cường',
    so_sao: 5, noi_dung: 'Bác sĩ rất tận tâm, giải thích rõ ràng. Tôi rất hài lòng!',
    status: 'visible', ngay_tao: '2026-06-14T10:20:00',
  },
  {
    id: 2, benh_nhan: 'Trần Thị Bình', bac_si: 'BS. Phạm Thu Dung',
    so_sao: 4, noi_dung: 'Bác sĩ khám kỹ, chờ hơi lâu nhưng chấp nhận được.',
    status: 'visible', ngay_tao: '2026-06-13T15:45:00',
  },
  {
    id: 3, benh_nhan: 'Hoàng Văn Em', bac_si: 'BS. Lê Hoàng Cường',
    so_sao: 2, noi_dung: 'Đặt lịch xong phải chờ 45 phút, không được thông báo trước.',
    status: 'visible', ngay_tao: '2026-06-12T09:30:00',
  },
  {
    id: 4, benh_nhan: 'Võ Thị Hoa', bac_si: 'BS. Phạm Thu Dung',
    so_sao: 5, noi_dung: 'Con tôi sợ đi khám nhưng bác sĩ Dung rất nhẹ nhàng, bé không khóc!',
    status: 'visible', ngay_tao: '2026-06-11T14:00:00',
  },
  {
    id: 5, benh_nhan: 'Lý Minh Tuấn', bac_si: 'BS. Lê Hoàng Cường',
    so_sao: 1, noi_dung: 'Bị hủy lịch đột ngột, không ai liên hệ giải thích.',
    status: 'hidden', ngay_tao: '2026-06-10T11:00:00',
  },
  {
    id: 6, benh_nhan: 'Phạm Thị Ngọc', bac_si: 'BS. Phạm Thu Dung',
    so_sao: 4, noi_dung: 'Khám qua video rất tiện, tiết kiệm thời gian đi lại.',
    status: 'visible', ngay_tao: '2026-06-09T16:30:00',
  },
  {
    id: 7, benh_nhan: 'Đặng Văn Quân', bac_si: 'BS. Lê Hoàng Cường',
    so_sao: 3, noi_dung: 'Bình thường, không có gì nổi bật.',
    status: 'visible', ngay_tao: '2026-06-08T08:45:00',
  },
  {
    id: 8, benh_nhan: 'Ngô Thị Tú', bac_si: 'BS. Phạm Thu Dung',
    so_sao: 5, noi_dung: 'Dịch vụ khám tại nhà tuyệt vời, sẽ giới thiệu cho bạn bè.',
    status: 'visible', ngay_tao: '2026-06-07T10:15:00',
  },
]
