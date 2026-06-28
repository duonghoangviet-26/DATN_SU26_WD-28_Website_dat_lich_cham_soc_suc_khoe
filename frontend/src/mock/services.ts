import type { ServiceItem } from '@/types'

export const mockServices: ServiceItem[] = [
  {
    id: '1',
    ma_dich_vu: 'DV001',
    ten: 'Khám nhi khoa cơ bản',
    loai: 'clinic',
    gia: 350000,
    thoi_gian_phut: 30,
    gio_dat_truoc_toi_thieu: 2,
    status: 'active',
    ngay_tao: '2024-01-01',
  },
  {
    id: '2',
    ma_dich_vu: 'DV002',
    ten: 'Khám thai tại nhà',
    loai: 'home',
    gia: 500000,
    thoi_gian_phut: 60,
    gio_dat_truoc_toi_thieu: 4,
    status: 'active',
    ngay_tao: '2024-01-10',
  },
]
