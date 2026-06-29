import type { PaymentItem } from '@/types'

export const mockPayments: PaymentItem[] = [
  { id: 1, ma_giao_dich: 'VF240614001', benh_nhan: 'Nguyễn Văn An', bac_si: 'BS. Lê Hoàng Cường', so_tien: 350000, phuong_thuc: 'momo', status: 'paid', ngay_tao: '2024-06-14T08:10:00' },
  { id: 2, ma_giao_dich: 'VF240614002', benh_nhan: 'Phạm Thị Ngọc', bac_si: 'BS. Phạm Thu Dung', so_tien: 280000, phuong_thuc: 'vnpay', status: 'paid', ngay_tao: '2024-06-14T09:20:00' },
]
