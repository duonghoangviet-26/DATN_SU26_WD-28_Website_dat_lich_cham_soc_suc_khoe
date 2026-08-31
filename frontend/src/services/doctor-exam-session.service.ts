import axiosInstance from './axiosInstance'

export type BuocKham = 'tiep_nhan' | 'chan_doan' | 'dich_vu' | 'ke_don' | 'hoan_tat'

export interface DichVuChiDinh {
  service_id: string
  ten: string
  so_luong: number
  don_gia: number
  thanh_tien: number
  hinh_anh?: DichVuHinhAnh[]
}

export interface DichVuHinhAnh {
  url: string
  mo_ta?: string | null
  uploaded_at?: string | null
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
export type MucDoThongBaoLeTan = 'urgent' | 'warning' | 'info'

export interface ChuyenVienThongTin {
  noi_chuyen_den: string
  ly_do: string
  tinh_trang_luc_chuyen: string | null
  giay_to_kem_theo: string | null
  thoi_diem: string
}

export interface HoaDonTomTat {
  tong_tien_kham: number
  tong_tien_phat_sinh: number
  tong_thanh_toan: number
  trang_thai_hoa_don: 'chua_thanh_toan' | 'da_dat_coc' | 'da_thanh_toan_du' | 'qua_han'
  chi_tiet_thu_phi?: {
    loai: string
    ten?: string | null
    so_tien: number
    so_luong: number
    thanh_tien: number
    ghi_chu?: string | null
  }[]
  da_xac_nhan_thu_ngan?: boolean
  tong_da_thu?: number
  con_thieu?: number
  thanh_toan?: {
    so_tien: number
    loai_thanh_toan: string
    phuong_thuc: string
    thoi_diem: string | null
  }[]
}

export interface PhienKham {
  queue: {
    id: string
    ho_so_benh_nhan_id: string | null
    ten_benh_nhan: string
    so_dien_thoai: string | null
    tuoi: number | null
    ngay_sinh: string | null
    gioi_tinh: string | null
    nhom_mau: string | null
    di_ung: string | null
    benh_nen: string | null
    ghi_chu: string | null
    ma_so_thu_tu: string | null
    nguon: string
    trang_thai: string
    phong_kham: string | null
    appointment_id: string | null
    ly_do_kham: string | null
  }
  ho_so: {
    id: string
    status: string
    trieu_chung_ban_dau: string | null
    chan_doan: string | null
    huong_dan_dieu_tri: string | null
    ghi_chu: string | null
    ngay_tai_kham: string | null
    chi_dinh_tai_kham?: boolean
    dich_vu_phat_sinh: DichVuChiDinh[]
    ket_cuc: KetCuc
    chuyen_vien_thong_tin: ChuyenVienThongTin | null
    lich_su_sua: { thoi_diem_sua: string; noi_dung: string | null; la_dinh_chinh: boolean }[]
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
  hoa_don: HoaDonTomTat | null
  // Tái khám: thông tin hồ sơ khám đợt trước — null nếu là khám mới hoặc chưa có hồ sơ cũ
  is_tai_kham: boolean
  ho_so_cu: {
    ngay_kham: string | null
    ten_bac_si: string | null
    chan_doan: string | null
    huong_dan_dieu_tri: string | null
    ghi_chu: string | null
    sinh_hieu: {
      can_nang: number | null
      chieu_cao: number | null
      huyet_ap: string | null
      nhiet_do: number | null
      nhip_tim: number | null
    } | null
    thuoc: ThuocItem[]
  } | null
}

// C4 — hàng trong danh sách "Bệnh nhân đã khám" (GET /doctor/exam-history).
export interface ExamHistoryRow {
  queue_id: string
  ten_benh_nhan: string
  so_dien_thoai: string | null
  nguon: string
  ma_so_thu_tu: string | null
  checkin_time: string
  thoi_diem_xac_nhan: string | null
  chan_doan: string
  ket_cuc: KetCuc
  so_dich_vu_phat_sinh: number
  tong_thanh_toan: number | null
  trang_thai_hoa_don: HoaDonTomTat['trang_thai_hoa_don'] | null
}

export interface ExamHistoryFilters {
  date?: string
  tu?: string
  den?: string
  q?: string
}

// B54/B55 — chỉ các trường được phép đính chính sau khi hồ sơ đã xác nhận (khớp
// TRUONG_DINH_CHINH_DUOC_PHEP trong examSession.service.js).
export interface DinhChinhHoSoPayload {
  chan_doan?: string
  huong_dan_dieu_tri?: string | null
  ghi_chu?: string | null
  ngay_tai_kham?: string | null
  chi_dinh_tai_kham?: boolean
  ket_cuc?: KetCuc
  chuyen_vien_thong_tin?: Partial<ChuyenVienThongTin> | null
  dich_vu_phat_sinh?: { service_id: string; so_luong: number; hinh_anh?: DichVuHinhAnh[] }[]
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
  async uploadExamImage(file: File) {
    const formData = new FormData()
    formData.append('image', file)
    const { data } = await axiosInstance.post('/doctor/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.data.url as string
  },
  async complete(queueId: string) {
    const { data } = await axiosInstance.post(`/doctor/exam-session/${queueId}/complete`)
    return data.data as KetQuaHoanTat
  },
  async notifyReception(queueId: string, payload: { noi_dung: string; muc_do: MucDoThongBaoLeTan }) {
    const { data } = await axiosInstance.post(`/doctor/exam-session/${queueId}/notify-reception`, payload)
    return data.data as { sent: number }
  },
  // B54/B55 — đính chính hồ sơ ĐÃ XÁC NHẬN. `ly_do` bắt buộc (backend chặn 400 nếu rỗng).
  async amend(queueId: string, thayDoi: DinhChinhHoSoPayload, lyDo: string) {
    const { data } = await axiosInstance.patch(`/doctor/exam-session/${queueId}/amendment`, { thay_doi: thayDoi, ly_do: lyDo })
    return data.data as PhienKham
  },
  // C4 — danh sách "Bệnh nhân đã khám". Không truyền gì -> hôm nay; có `q` -> nới 90 ngày gần nhất.
  async listHistory(filters: ExamHistoryFilters = {}) {
    const { data } = await axiosInstance.get('/doctor/exam-history', { params: filters })
    return (Array.isArray(data.data) ? data.data : []) as ExamHistoryRow[]
  },
}
