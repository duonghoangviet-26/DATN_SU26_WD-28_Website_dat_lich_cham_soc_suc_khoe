import type { NotificationItem } from '@/types'

export const mockNotifications: NotificationItem[] = [
  {
    id: 1,
    tieu_de: 'Lịch hẹn sắp tới',
    noi_dung: 'Bạn có lịch hẹn với BS. Cường vào lúc 08:00 sáng mai.',
    doi_tuong: 'user',
    so_nguoi_nhan: 1,
    ngay_gui: '2024-06-20T08:00:00Z',
  },
  {
    id: 2,
    tieu_de: 'Khuyến mãi hè',
    noi_dung: 'Giảm giá 20% cho tất cả các gói khám nhi khoa trong tháng 6.',
    doi_tuong: 'all',
    so_nguoi_nhan: 1500,
    ngay_gui: '2024-06-15T09:00:00Z',
  },
]
