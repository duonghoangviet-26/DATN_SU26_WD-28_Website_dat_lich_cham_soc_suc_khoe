import type { ExaminationResult } from '@/types'

export const mockExaminations: ExaminationResult[] = [
  {
    id: 1,
    appointment_id: 3,
    chan_doan: 'Sốt siêu vi, theo dõi sốt xuất huyết.',
    huong_dan_dieu_tri: 'Nghỉ ngơi, uống nhiều nước, uống thuốc hạ sốt khi sốt trên 38.5 độ.',
    ngay_tai_kham: '2024-06-23',
    co_the_sua: true,
    thuoc: [
      { id: 1, ten_thuoc: 'Paracetamol 500mg', lieu_dung: '1 viên', tan_suat: '3 lần/ngày', so_ngay: 3, ghi_chu: 'Uống khi sốt' },
    ],
    ngay_tao: '2024-06-20T15:00:00Z',
  },
]
