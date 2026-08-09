import test from 'node:test'
import assert from 'node:assert/strict'

import { moTaCheckIn, tinhTuoi } from '../src/services/checkIn.service.js'

test('WS-4 mô tả check-in ghi đủ STT, nguồn, khung giờ và phòng', () => {
  const entry = {
    ma_so_thu_tu: 'A012',
    so_thu_tu_checkin: 12,
    nguon: 'online',
    phong_kham: '101',
    ten_benh_nhan: 'Nguyen Van A',
  }
  const appt = { gio_kham: '08:30', payment_status: 'paid', ma_lich_hen: 'LH0007' }

  const mo_ta = moTaCheckIn(entry, appt)

  assert.equal(mo_ta.ma_so_thu_tu, 'A012')
  assert.equal(mo_ta.nguon, 'online')
  assert.equal(mo_ta.gio_kham, '08:30')
  assert.equal(mo_ta.phong_kham, '101')
  assert.equal(mo_ta.ten_benh_nhan, 'Nguyen Van A')
  assert.equal(mo_ta.payment_status, 'paid')
  assert.equal(mo_ta.ma_lich_hen, 'LH0007')
})

test('WS-4 mô tả check-in khách vãng lai không có lịch hẹn vẫn hợp lệ', () => {
  const entry = { ma_so_thu_tu: 'A013', nguon: 'offline', ten_benh_nhan: 'Tran Thi B', phong_kham: null }

  const mo_ta = moTaCheckIn(entry, null)

  assert.equal(mo_ta.nguon, 'offline')
  assert.equal(mo_ta.gio_kham, null)
  assert.equal(mo_ta.ma_lich_hen, null)
  assert.equal(mo_ta.payment_status, null)
})

// ── Lỗi có thật đang sửa kèm ───────────────────────────────────────────────
// `layLichChoTiepNhan` gọi `tinhTuoi(member, a, now)` — 3 tham số cho hàm nhận 4
// (member, profile, appt, now). `appt` nhận nhầm `now` nên nhánh `nam_sinh_khach`
// không bao giờ chạy: tuổi khách lẻ luôn ra null ở danh sách chờ tiếp nhận.
test('WS-4 tinhTuoi suy tuổi từ nam_sinh_khach khi không có member và không có profile', () => {
  const now = new Date('2026-08-08T00:00:00.000Z')
  assert.equal(tinhTuoi(null, null, { nam_sinh_khach: 1990 }, now), 36)
})

test('WS-4 tinhTuoi ưu tiên ngày sinh của member hơn nam_sinh_khach', () => {
  const now = new Date('2026-08-08T00:00:00.000Z')
  const member = { ngay_sinh: new Date('2000-05-01T00:00:00.000Z') }
  assert.equal(tinhTuoi(member, null, { nam_sinh_khach: 1990 }, now), 26)
})

test('WS-4 tinhTuoi trả null khi không có nguồn dữ liệu nào', () => {
  assert.equal(tinhTuoi(null, null, {}, new Date('2026-08-08T00:00:00.000Z')), null)
})
