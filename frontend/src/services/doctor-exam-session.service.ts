import axiosInstance from './axiosInstance'

export type BuocKham = 'tiep_nhan' | 'chan_doan' | 'dich_vu' | 'ke_don' | 'hoan_tat'

export interface DichVuChiDinh {
  service_id: string
  ten: string
  so_luong: number
  don_gia: number
  thanh_tien: number
}

export interface ThuocItem {
  ten_thuoc: string
  lieu_luong?: string | null
  tan_suat?: string | null
  gio_uong?: string[]
  so_ngay: number
  ghi_chu?: string | null
}

// B47 — cảnh báo dị ứng: so khớp chuỗi mềm, không phải tra cứu hoạt chất y khoa (xem
// backend/src/services/drugAllergyCheck.service.js). Trả kèm theo lỗi 409 khi lưu bước kê đơn.
export interface CanhBaoDiUngItem {
  ten_thuoc: string
  tu_khoa_trung: string[]
}

// D78/D80 — kết cục ca khám, khớp enum backend/src/services/examStepRules.js (KET_CUC).
export type KetCuc = 'dieu_tri_thuong' | 'chuyen_chuyen_khoa' | 'chuyen_vien' | 'cap_cuu_ngoai_vien'

export interface ChuyenVienThongTin {
  noi_chuyen_den: string
  ly_do: string
  tinh_trang_luc_chuyen: string | null
  giay_to_kem_theo: string | null
  thoi_diem: string
}

export interface PhienKham {
  queue: {
    id: string
    ten_benh_nhan: string
    tuoi: number | null
    gioi_tinh: string | null
    nhom_mau: string | null
    di_ung: string | null
    benh_nen: string | null
    ma_so_thu_tu: string | null
    nguon: string
    trang_thai: string
    phong_kham: string | null
    appointment_id: string | null
  }
  ho_so: {
    id: string
    status: string
    trieu_chung_ban_dau: string | null
    chan_doan: string | null
    huong_dan_dieu_tri: string | null
    ghi_chu: string | null
    ngay_tai_kham: string | null
    dich_vu_phat_sinh: DichVuChiDinh[]
    ket_cuc: KetCuc
    chuyen_vien_thong_tin: ChuyenVienThongTin | null
  } | null
  sinh_hieu: {
    can_nang: number | null
    chieu_cao: number | null
    huyet_ap: string | null
    nhiet_do: number | null
    nhip_tim: number | null
  } | null
  buoc_hien_tai: BuocKham
  bmi: number | null
  thuoc: ThuocItem[]
  dich_vu_kha_dung: { service_id: string; ten: string; gia: number; ma_dich_vu: string | null }[]
}

export interface KetQuaHoanTat {
  ho_so_id: string
  ten_benh_nhan: string
  co_dich_vu_can_thu: boolean
  tong_tien_dich_vu: number
  benh_nhan_ke_tiep: {
    queue_id: string
    ten_benh_nhan: string
    ma_so_thu_tu: string | null
    nguon: string
    trang_thai: string
  } | null
}

export const doctorExamSessionService = {
  async get(queueId: string) {
    const { data } = await axiosInstance.get(`/doctor/exam-session/${queueId}`)
    return data.data as PhienKham
  },
  async saveStep(queueId: string, buoc: BuocKham, payload: Record<string, unknown>) {
    const { data } = await axiosInstance.patch(`/doctor/exam-session/${queueId}/step/${buoc}`, payload)
    return data.data as PhienKham
  },
  async complete(queueId: string) {
    const { data } = await axiosInstance.post(`/doctor/exam-session/${queueId}/complete`)
    return data.data as KetQuaHoanTat
  },
}
