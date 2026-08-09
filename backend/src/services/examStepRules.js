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

/** BMI = kg / m². Trả null khi thiếu dữ liệu — KHÔNG trả 0 (0 trông như một chỉ số thật). */
export function tinhBMI(canNang, chieuCao) {
  const kg = Number(canNang)
  const cm = Number(chieuCao)
  if (!Number.isFinite(kg) || !Number.isFinite(cm) || kg <= 0 || cm <= 0) return null
  const bmi = kg / ((cm / 100) ** 2)
  return Math.round(bmi * 10) / 10
}
