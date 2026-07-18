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
  so_luong: number
}

export interface TopServiceStatistic {
  ten_dich_vu: string
  so_luot_dung: number
  doanh_thu: number
}
