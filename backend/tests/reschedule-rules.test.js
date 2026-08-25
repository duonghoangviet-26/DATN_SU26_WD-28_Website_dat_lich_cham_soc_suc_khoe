import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TRANG_THAI_DE_XUAT_MO,
  laSlotGiuChoDeXuat,
  nenKhoaSlotVaoDonNghi,
  dieuKienChiemSlot,
  capNhatSlotCuSauKhiDoi,
  nenSinhLaiDeXuat,
  khoangCachKhung,
  diemLechPhuongAn,
  SO_NGAY_TIM_PHUONG_AN,
  PHAT_MOI_NGAY_PHUT,
  demSlotSeKhoa,
} from '../src/services/rescheduleRules.js'

// ============================================================
// P0-3 — `locked` mang BA nghĩa, phải phân biệt được
// ============================================================

test('slot locked có người tạm giữ và không bị nghỉ phép = chỗ giữ sẵn cho đề xuất', () => {
  assert.equal(laSlotGiuChoDeXuat({
    status: 'locked', bi_khoa_boi_nghi_phep: false, benh_nhan_tam_giu_id: 'u1',
  }), true)
})

test('slot locked vì bác sĩ nghỉ KHÔNG phải chỗ giữ sẵn', () => {
  assert.equal(laSlotGiuChoDeXuat({
    status: 'locked', bi_khoa_boi_nghi_phep: true, benh_nhan_tam_giu_id: 'u1',
  }), false)
})

test('slot locked rỗng (slot cũ của lịch đã dời đi) KHÔNG phải chỗ giữ sẵn', () => {
  assert.equal(laSlotGiuChoDeXuat({
    status: 'locked', bi_khoa_boi_nghi_phep: false, benh_nhan_tam_giu_id: null,
  }), false)
})

test('slot active không bao giờ là chỗ giữ sẵn', () => {
  assert.equal(laSlotGiuChoDeXuat({ status: 'active', benh_nhan_tam_giu_id: 'u1' }), false)
})

// ── Chiều KHOÁ khi bác sĩ báo nghỉ ──────────────────────────────────────────

test('khoá slot vì nghỉ: bắt active và pending_payment', () => {
  assert.equal(nenKhoaSlotVaoDonNghi({ status: 'active' }), true)
  assert.equal(nenKhoaSlotVaoDonNghi({ status: 'pending_payment' }), true)
})

test('khoá slot vì nghỉ: BẮT cả slot đang giữ sẵn cho đề xuất khác (lỗ hổng P0-3)', () => {
  assert.equal(nenKhoaSlotVaoDonNghi({
    status: 'locked', bi_khoa_boi_nghi_phep: false, benh_nhan_tam_giu_id: 'u1',
  }), true)
})

test('khoá slot vì nghỉ: KHÔNG đụng slot đã booked', () => {
  assert.equal(nenKhoaSlotVaoDonNghi({ status: 'booked', benh_nhan_id: 'u1' }), false)
})

test('khoá slot vì nghỉ: bỏ qua slot đã bị khoá bởi đơn nghỉ khác', () => {
  assert.equal(nenKhoaSlotVaoDonNghi({
    status: 'locked', bi_khoa_boi_nghi_phep: true, benh_nhan_tam_giu_id: null,
  }), false)
})

// ── Chiều CHIẾM slot đích ───────────────────────────────────────────────────

test('chiếm slot đã giữ sẵn: chấp nhận locked, không đòi benh_nhan_id null', () => {
  const dk = dieuKienChiemSlot({ slot_id: 's1', da_giu_cho: true })
  assert.equal(dk.status, 'locked')
  assert.deepEqual(dk.bi_khoa_boi_nghi_phep, { $ne: true })
  assert.equal('benh_nhan_id' in dk, false)
})

test('chiếm slot chưa giữ: chỉ chấp nhận active và chưa có ai', () => {
  const dk = dieuKienChiemSlot({ slot_id: 's1', da_giu_cho: false })
  assert.equal(dk.status, 'active')
  assert.equal(dk.benh_nhan_id, null)
})

test('KHÔNG BAO GIỜ chiếm slot bị khoá vì bác sĩ nghỉ — cả hai nhánh', () => {
  for (const daGiuCho of [true, false]) {
    const dk = dieuKienChiemSlot({ slot_id: 's1', da_giu_cho: daGiuCho })
    assert.deepEqual(dk.bi_khoa_boi_nghi_phep, { $ne: true })
  }
})

// ============================================================
// P0-4 — slot CŨ: khách tự dời thì trả pool, phòng khám dời thì khoá
// ============================================================

test('lỗi phòng khám: slot cũ bị khoá, không bán lại', () => {
  const set = capNhatSlotCuSauKhiDoi(true)
  assert.equal(set['slots.$.status'], 'locked')
  assert.equal(set['slots.$.benh_nhan_id'], null)
})

test('khách tự dời: slot cũ trả về pool để bán lại', () => {
  const set = capNhatSlotCuSauKhiDoi(false)
  assert.equal(set['slots.$.status'], 'active')
  assert.equal(set['slots.$.benh_nhan_id'], null)
  assert.equal(set['slots.$.pending_expired_at'], null)
})

// ============================================================
// P1-6 — đề xuất còn mở phải được sinh lại, không bị bỏ qua
// ============================================================

test('chưa có đề xuất nào -> được sinh', () => {
  assert.equal(nenSinhLaiDeXuat(null), true)
})

test('đề xuất còn mở -> ĐƯỢC sinh lại (trước đây bị chặn)', () => {
  for (const trangThai of TRANG_THAI_DE_XUAT_MO) {
    assert.equal(nenSinhLaiDeXuat({ trang_thai: trangThai }), true)
  }
})

test('đề xuất đã áp dụng hoặc đã huỷ -> bỏ qua', () => {
  assert.equal(nenSinhLaiDeXuat({ trang_thai: 'da_ap_dung' }), false)
  assert.equal(nenSinhLaiDeXuat({ trang_thai: 'da_huy' }), false)
})

// ============================================================
// Đợt 4 — chấm điểm phương án khi mở rộng ra nhiều ngày (A3, A4)
// ============================================================

test('khoảng cách khung tính bằng phút, có dấu', () => {
  assert.equal(khoangCachKhung('10:00', '09:00'), 60)
  assert.equal(khoangCachKhung('09:00', '10:00'), -60)
  assert.equal(khoangCachKhung('13:30', '13:30'), 0)
})

test('cùng ngày cùng giờ = điểm 0', () => {
  assert.equal(diemLechPhuongAn({ gioSlot: '10:00', gioGoc: '10:00', soNgayLech: 0 }), 0)
})

test('cùng ngày lệch giờ = số phút lệch tuyệt đối', () => {
  assert.equal(diemLechPhuongAn({ gioSlot: '09:00', gioGoc: '10:00', soNgayLech: 0 }), 60)
  assert.equal(diemLechPhuongAn({ gioSlot: '11:00', gioGoc: '10:00', soNgayLech: 0 }), 60)
})

test('cùng ngày lệch 7 tiếng (420) vẫn XẾP TRƯỚC ngày mai đúng giờ (480) — A4', () => {
  const cungNgay = diemLechPhuongAn({ gioSlot: '17:00', gioGoc: '10:00', soNgayLech: 0 })
  const ngayMai = diemLechPhuongAn({ gioSlot: '10:00', gioGoc: '10:00', soNgayLech: 1 })
  assert.equal(cungNgay, 420)
  assert.equal(ngayMai, 480)
  assert.ok(cungNgay < ngayMai)
})

test('phạt cộng dồn theo số ngày nhảy', () => {
  assert.equal(diemLechPhuongAn({ gioSlot: '10:30', gioGoc: '10:00', soNgayLech: 2 }), 30 + 960)
})

test('mặc định tìm 7 ngày, phạt 480 phút mỗi ngày', () => {
  assert.equal(SO_NGAY_TIM_PHUONG_AN, 7)
  assert.equal(PHAT_MOI_NGAY_PHUT, 480)
})

// ============================================================
// B1 — đếm slot sẽ bị khoá nếu một đơn nghỉ được duyệt (preview, chưa tạo NghiPhepBacSi thật)
// ============================================================

test('demSlotSeKhoa: đếm đúng slot active/pending_payment trong khoảng giờ, bỏ qua slot khác trạng thái', () => {
  const slots = [
    { gio_bat_dau: '10:00', gio_ket_thuc: '10:30', status: 'active' },
    { gio_bat_dau: '10:00', gio_ket_thuc: '10:30', status: 'pending_payment' },
    { gio_bat_dau: '10:00', gio_ket_thuc: '10:30', status: 'booked' },
    { gio_bat_dau: '10:00', gio_ket_thuc: '10:30', status: 'locked', bi_khoa_boi_nghi_phep: true },
  ]
  assert.equal(demSlotSeKhoa(slots, '10:00', '10:30'), 2)
})

test('demSlotSeKhoa: bỏ qua slot ngoài khoảng giờ nghỉ', () => {
  const slots = [
    { gio_bat_dau: '09:00', gio_ket_thuc: '09:30', status: 'active' },
    { gio_bat_dau: '10:00', gio_ket_thuc: '10:30', status: 'active' },
  ]
  assert.equal(demSlotSeKhoa(slots, '10:00', '10:30'), 1)
})

test('demSlotSeKhoa: không truyền giờ (nghỉ cả ngày) -> đếm mọi slot khớp trạng thái', () => {
  const slots = [
    { gio_bat_dau: '08:00', gio_ket_thuc: '08:30', status: 'active' },
    { gio_bat_dau: '14:00', gio_ket_thuc: '14:30', status: 'active' },
  ]
  assert.equal(demSlotSeKhoa(slots, null, null), 2)
})

test('demSlotSeKhoa: mảng slots rỗng hoặc undefined -> trả 0, không throw', () => {
  assert.equal(demSlotSeKhoa([], '10:00', '10:30'), 0)
  assert.equal(demSlotSeKhoa(undefined, '10:00', '10:30'), 0)
})
