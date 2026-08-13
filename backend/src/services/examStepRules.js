// ============================================================
// WS-1 — Quy tắc các bước của một phiên khám (HÀM THUẦN, không chạm DB)
// ============================================================
// Tách khỏi service để test được thứ tự bước và điều kiện từng bước mà không cần Mongo.
// Trước WS-1, toàn bộ hồ sơ khám nhập trong MỘT form phẳng: sinh hiệu, chẩn đoán, đơn
// thuốc hiện ra cùng lúc và không có thứ tự nào. Hội đồng chấm "quá sơ sài" chính vì
// không nhìn thấy quy trình.

export const CAC_BUOC = ['tiep_nhan', 'chan_doan', 'dich_vu', 'ke_don', 'hoan_tat']

export const NHAN_BUOC = {
  tiep_nhan: 'Tiếp nhận',
  chan_doan: 'Chẩn đoán',
  dich_vu:   'Dịch vụ',
  ke_don:    'Kê đơn',
  hoan_tat:  'Xác nhận',
}

// Ngưỡng sinh hiệu — chặn số phi lý (gõ nhầm đơn vị, thừa số 0), KHÔNG phải chuẩn y khoa.
const GIOI_HAN = {
  can_nang:  { min: 0.5, max: 400, ten: 'Cân nặng (kg)' },
  chieu_cao: { min: 20,  max: 300, ten: 'Chiều cao (cm)' },
  nhiet_do:  { min: 25,  max: 45,  ten: 'Nhiệt độ (°C)' },
  nhip_tim:  { min: 20,  max: 300, ten: 'Nhịp tim (lần/phút)' },
}

export function buocKeTiep(buoc) {
  const i = CAC_BUOC.indexOf(buoc)
  if (i < 0 || i === CAC_BUOC.length - 1) return null
  return CAC_BUOC[i + 1]
}

export function buocTruoc(buoc) {
  const i = CAC_BUOC.indexOf(buoc)
  if (i <= 0) return null
  return CAC_BUOC[i - 1]
}

/**
 * Có được mở bước `buocDich` khi phiên đang ở `buocHienTai` không?
 *
 * Được QUAY LẠI bước đã qua để sửa, nhưng KHÔNG được nhảy cóc tới bước chưa tới —
 * nhảy cóc đẻ ra đúng thứ hội đồng chê: hồ sơ có đơn thuốc mà không có chẩn đoán.
 */
export function duocPhepVaoBuoc(buocDich, buocHienTai) {
  const dich = CAC_BUOC.indexOf(buocDich)
  const hienTai = CAC_BUOC.indexOf(buocHienTai)
  if (dich < 0 || hienTai < 0) return false
  return dich <= hienTai
}

function kiemSoDo(payload, loi) {
  for (const [khoa, { min, max, ten }] of Object.entries(GIOI_HAN)) {
    const giaTri = payload[khoa]
    if (giaTri === null || giaTri === undefined || giaTri === '') continue
    const so = Number(giaTri)
    if (!Number.isFinite(so) || so < min || so > max) {
      loi.push(`${ten} phải nằm trong khoảng ${min}–${max}`)
    }
  }
}

/**
 * Bước 1. Quyết định Q7: CHỈ triệu chứng là bắt buộc.
 * Cân nặng/chiều cao thiếu thì cảnh báo vàng, không chặn — bắt buộc sẽ khiến bác sĩ
 * nhập bừa khi tái khám người lớn, sinh dữ liệu rác còn tệ hơn để trống.
 */
export function kiemTraBuocTiepNhan(payload = {}) {
  const loi = []
  const canhBao = []

  if (!payload.trieu_chung_ban_dau || !String(payload.trieu_chung_ban_dau).trim()) {
    loi.push('Triệu chứng / lý do khám là bắt buộc')
  }
  kiemSoDo(payload, loi)

  const thieu = []
  if (!payload.can_nang) thieu.push('cân nặng')
  if (!payload.chieu_cao) thieu.push('chiều cao')
  if (thieu.length) canhBao.push(`Chưa ghi ${thieu.join(' và ')} — hồ sơ sẽ thiếu chỉ số thể trạng`)

  return { ok: loi.length === 0, loi, canhBao }
}

/** Bước 2. `chan_doan` là `required` ở schema — chặn sớm để báo lỗi đọc được. */
export function kiemTraBuocChanDoan(payload = {}) {
  const loi = []
  if (!payload.chan_doan || !String(payload.chan_doan).trim()) {
    loi.push('Chẩn đoán là bắt buộc')
  }
  return { ok: loi.length === 0, loi }
}

// D78/D80 — kết cục ca khám. 'dieu_tri_thuong' mặc định, không cần thông tin thêm.
// 'chuyen_vien'/'cap_cuu_ngoai_vien' bắt buộc kèm nơi chuyển + lý do (hồ sơ y tế phải ghi
// lại được ca chuyển đi, không chỉ nằm trong ô ghi chú tự do).
export const KET_CUC = ['dieu_tri_thuong', 'chuyen_chuyen_khoa', 'chuyen_vien', 'cap_cuu_ngoai_vien']
const KET_CUC_CAN_THONG_TIN_CHUYEN = ['chuyen_vien', 'cap_cuu_ngoai_vien']

/**
 * Kiểm + chuẩn hóa kết cục ca khám (bước 'chan_doan').
 * @returns {{ok: boolean, loi: string[], ketCuc: string, thongTinChuyen: object|null}}
 */
export function kiemTraKetCuc(payload = {}) {
  const loi = []
  const ketCuc = payload.ket_cuc || 'dieu_tri_thuong'
  if (!KET_CUC.includes(ketCuc)) {
    return { ok: false, loi: ['Kết cục khám không hợp lệ'], ketCuc: 'dieu_tri_thuong', thongTinChuyen: null }
  }

  let thongTinChuyen = null
  if (KET_CUC_CAN_THONG_TIN_CHUYEN.includes(ketCuc)) {
    const tt = payload.chuyen_vien_thong_tin ?? {}
    const noiChuyenDen = String(tt.noi_chuyen_den ?? '').trim()
    const lyDo = String(tt.ly_do ?? '').trim()
    if (!noiChuyenDen) loi.push('Cần nhập nơi chuyển đến')
    if (!lyDo) loi.push('Cần nhập lý do chuyển viện / cấp cứu ngoài viện')
    if (loi.length === 0) {
      thongTinChuyen = {
        noi_chuyen_den: noiChuyenDen,
        ly_do: lyDo,
        tinh_trang_luc_chuyen: String(tt.tinh_trang_luc_chuyen ?? '').trim() || null,
        giay_to_kem_theo: String(tt.giay_to_kem_theo ?? '').trim() || null,
        thoi_diem: new Date(),
      }
    }
  }

  return { ok: loi.length === 0, loi, ketCuc, thongTinChuyen }
}

/** BMI = kg / m². Trả null khi thiếu dữ liệu — KHÔNG trả 0 (0 trông như một chỉ số thật). */
export function tinhBMI(canNang, chieuCao) {
  const kg = Number(canNang)
  const cm = Number(chieuCao)
  if (!Number.isFinite(kg) || !Number.isFinite(cm) || kg <= 0 || cm <= 0) return null
  const bmi = kg / ((cm / 100) ** 2)
  return Math.round(bmi * 10) / 10
}
