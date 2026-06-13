import type { PaymentItem } from '@/types'

export const mockPayments: PaymentItem[] = [
  {
    id: 1, ma_giao_dich: 'VF240614001',
    benh_nhan: 'Nguyễn Văn An', bac_si: 'BS. Lê Hoàng Cường',
    so_tien: 350000, phuong_thuc: 'momo',
    status: 'paid', ngay_tao: '2026-06-14T08:10:00',
  },
  {
    id: 2, ma_giao_dich: 'VF240614002',
    benh_nhan: 'Phạm Thị Ngọc', bac_si: 'BS. Phạm Thu Dung',
    so_tien: 280000, phuong_thuc: 'vnpay',
    status: 'paid', ngay_tao: '2026-06-14T09:20:00',
  },
  {
    id: 3, ma_giao_dich: 'VF240613001',
    benh_nhan: 'Hoàng Văn Em', bac_si: 'BS. Lê Hoàng Cường',
    so_tien: 700000, phuong_thuc: 'bank',
    status: 'paid', ngay_tao: '2026-06-13T14:05:00',
  },
  {
    id: 4, ma_giao_dich: 'VF240612001',
    benh_nhan: 'Lý Minh Tuấn', bac_si: 'BS. Lê Hoàng Cường',
    so_tien: 350000, phuong_thuc: 'momo',
    status: 'refunded', ngay_tao: '2026-06-12T11:00:00',
  },
  {
    id: 5, ma_giao_dich: 'VF240617001',
    benh_nhan: 'Võ Thị Hoa', bac_si: 'BS. Phạm Thu Dung',
    so_tien: 280000, phuong_thuc: 'momo',
    status: 'unpaid', ngay_tao: '2026-06-17T00:00:00',
  },
  {
    id: 6, ma_giao_dich: 'VF240617002',
    benh_nhan: 'Trần Thị Bình', bac_si: 'BS. Phạm Thu Dung',
    so_tien: 250000, phuong_thuc: 'vnpay',
    status: 'unpaid', ngay_tao: '2026-06-17T00:00:00',
  },
  {
    id: 7, ma_giao_dich: 'VF240611001',
    benh_nhan: 'Đặng Văn Quân', bac_si: 'BS. Lê Hoàng Cường',
    so_tien: 350000, phuong_thuc: 'cash',
    status: 'paid', ngay_tao: '2026-06-11T08:30:00',
  },
  {
    id: 8, ma_giao_dich: 'VF240618001',
    benh_nhan: 'Ngô Thị Tú', bac_si: 'BS. Phạm Thu Dung',
    so_tien: 500000, phuong_thuc: 'bank',
    status: 'unpaid', ngay_tao: '2026-06-18T00:00:00',
  },
]
