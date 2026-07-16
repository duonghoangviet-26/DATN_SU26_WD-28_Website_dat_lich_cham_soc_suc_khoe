import type { ExaminationResult } from '@/types'

export const mockExaminations: ExaminationResult[] = [
  {
    id: 1, appointment_id: 1,
    chan_doan: 'Tăng huyết áp độ 1, nghi ngờ bệnh mạch vành.',
    huong_dan_dieu_tri: 'Dùng thuốc hạ huyết áp theo đơn. Hạn chế muối, tránh stress. Tập thể dục nhẹ 30 phút/ngày. Tái khám sau 1 tháng hoặc khi có triệu chứng bất thường.',
    ghi_chu: 'Theo dõi huyết áp tại nhà mỗi sáng, ghi chép kết quả mang theo lần tái khám.',
    ngay_tai_kham: '2026-07-14',
    co_the_sua: false,
    thuoc: [
      {
        id: 1, ten_thuoc: 'Amlodipine 5mg',
        lieu_luong: '1 viên', tan_suat: '1 lần/ngày',
        gio_uong: ['07:00'],
        so_ngay: 30,
        ghi_chu: 'Uống buổi sáng sau ăn',
      },
      {
        id: 2, ten_thuoc: 'Aspirin 81mg',
        lieu_luong: '1 viên', tan_suat: '1 lần/ngày',
        gio_uong: ['21:00'],
        so_ngay: 30,
        ghi_chu: 'Uống buổi tối sau ăn',
      },
    ],
    ngay_tao: '2026-06-11T09:30:00',
  },
  {
    id: 2, appointment_id: 8,
    chan_doan: 'Đau thắt ngực ổn định, cần theo dõi thêm.',
    huong_dan_dieu_tri: 'Uống thuốc đúng giờ. Tránh hoạt động gắng sức mạnh. Nếu đau ngực tăng cường độ hoặc kéo dài > 20 phút, đến cấp cứu ngay.',
    ghi_chu: null,
    ngay_tai_kham: '2026-07-10',
    co_the_sua: false,
    thuoc: [
      {
        id: 1, ten_thuoc: 'Nitrate (ISMN) 20mg',
        lieu_luong: '1 viên', tan_suat: '2 lần/ngày',
        gio_uong: ['07:00', '12:00'],
        so_ngay: 30,
        ghi_chu: 'Sáng và trưa, không uống buổi tối',
      },
      {
        id: 2, ten_thuoc: 'Metoprolol 25mg',
        lieu_luong: '1 viên', tan_suat: '2 lần/ngày',
        gio_uong: ['07:00', '19:00'],
        so_ngay: 30,
        ghi_chu: null,
      },
      {
        id: 3, ten_thuoc: 'Rosuvastatin 10mg',
        lieu_luong: '1 viên', tan_suat: '1 lần/ngày',
        gio_uong: ['21:00'],
        so_ngay: 30,
        ghi_chu: 'Uống buổi tối',
      },
    ],
    ngay_tao: '2026-06-09T10:00:00',
  },
  {
    id: 3, appointment_id: 9,
    chan_doan: 'Suy tim độ 2 (NYHA II), siêu âm tim EF = 42%.',
    huong_dan_dieu_tri: 'Tiếp tục phác đồ điều trị hiện tại. Hạn chế dịch 1.5L/ngày. Cân mỗi sáng, nếu tăng > 2kg/tuần cần báo ngay bác sĩ.',
    ghi_chu: 'Tránh muối, hạn chế vận động nặng. Ngủ đủ giấc, nằm đầu cao 30 độ.',
    ngay_tai_kham: '2026-07-09',
    co_the_sua: false,
    thuoc: [
      {
        id: 1, ten_thuoc: 'Furosemide 40mg',
        lieu_luong: '1 viên', tan_suat: '1 lần/ngày',
        gio_uong: ['07:00'],
        so_ngay: 30,
        ghi_chu: 'Uống buổi sáng',
      },
      {
        id: 2, ten_thuoc: 'Enalapril 5mg',
        lieu_luong: '1 viên', tan_suat: '2 lần/ngày',
        gio_uong: ['07:00', '19:00'],
        so_ngay: 30,
        ghi_chu: null,
      },
      {
        id: 3, ten_thuoc: 'Carvedilol 6.25mg',
        lieu_luong: '1 viên', tan_suat: '2 lần/ngày',
        gio_uong: ['07:00', '19:00'],
        so_ngay: 30,
        ghi_chu: 'Uống cùng bữa ăn',
      },
    ],
    ngay_tao: '2026-06-10T09:00:00',
  },
]
