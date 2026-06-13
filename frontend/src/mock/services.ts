import type { ServiceItem } from '@/types'

export const mockServices: ServiceItem[] = [
  {
    id: 1, ten: 'Khám tổng quát tại phòng khám',
    loai: 'clinic', gia_co_ban: 200000,
    mo_ta: 'Khám sức khỏe tổng quát với bác sĩ tại cơ sở y tế.',
    thoi_gian_phut: 30, status: 'active',
  },
  {
    id: 2, ten: 'Khám chuyên khoa tại phòng khám',
    loai: 'clinic', gia_co_ban: 350000,
    mo_ta: 'Khám chuyên sâu với bác sĩ chuyên khoa tại phòng khám.',
    thoi_gian_phut: 45, status: 'active',
  },
  {
    id: 3, ten: 'Tư vấn sức khỏe qua video',
    loai: 'video', gia_co_ban: 150000,
    mo_ta: 'Gặp bác sĩ trực tuyến qua video call, tiện lợi tại nhà.',
    thoi_gian_phut: 20, status: 'active',
  },
  {
    id: 4, ten: 'Tư vấn chuyên khoa qua video',
    loai: 'video', gia_co_ban: 250000,
    mo_ta: 'Tư vấn chuyên sâu với bác sĩ chuyên khoa qua video.',
    thoi_gian_phut: 30, status: 'active',
  },
  {
    id: 5, ten: 'Khám sức khỏe tại nhà',
    loai: 'home', gia_co_ban: 500000,
    mo_ta: 'Bác sĩ đến tận nhà thăm khám, phù hợp người cao tuổi và trẻ nhỏ.',
    thoi_gian_phut: 60, status: 'active',
  },
  {
    id: 6, ten: 'Khám chuyên khoa tại nhà',
    loai: 'home', gia_co_ban: 700000,
    mo_ta: 'Bác sĩ chuyên khoa đến nhà thăm khám và tư vấn điều trị.',
    thoi_gian_phut: 90, status: 'hidden',
  },
]
