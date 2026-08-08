export interface RevenueDailyStatistic {
  ngay: string
  da_thu: number
  da_xuat_hoa_don: number
}

export interface AppointmentStatusStatistic {
  trang_thai: 'cho_xac_nhan' | 'da_xac_nhan' | 'hoan_thanh' | 'huy'
  so_luong: number
}

export interface DoctorRevenueStatistic {
  ten_bac_si: string
  doanh_thu: number
  so_luot_kham: number
}

export interface MonthlyNewPatientStatistic {
  thang: number
  label?: string
  so_luong: number
  so_luong_cu?: number
}

export interface WeeklyNewPatientStatistic {
  tuan: number
  label: string
  tu: number
  den: number
  so_luong: number
  so_luong_cu?: number
}

export interface YearlyNewPatientStatistic {
  nam: number
  label?: string
  so_luong: number
  so_luong_cu?: number
}

export type NewPatientStatisticMode = 'month' | 'year' | 'all'
export type NewPatientStatistic = MonthlyNewPatientStatistic | WeeklyNewPatientStatistic | YearlyNewPatientStatistic

export interface TopServiceStatistic {
  ten_dich_vu: string
  so_luot_dung: number
  doanh_thu: number
}

export interface DoctorRevenueDetail {
  chartData: {
    ngay: string
    doanh_thu: number
    so_luot_kham: number
  }[]
  topServices: TopServiceStatistic[]
  rating: {
    trung_binh: number
    so_luong: number
  }
  summary: {
    doanh_thu: number
    so_luot_kham: number
    benh_nhan_moi: number
    benh_nhan_cu: number
    tong_benh_nhan: number
  }
}
