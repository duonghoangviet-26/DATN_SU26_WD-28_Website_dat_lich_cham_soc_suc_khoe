import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cacKhungDuocBanTaiQuay } from '../src/services/walkInWindow.service.js'

const ngay = new Date('2026-07-29T00:00:00.000Z')
const slots = [
  { khung_index: 6, gio_bat_dau: '11:00' },
  { khung_index: 7, gio_bat_dau: '13:30' },
  { khung_index: 8, gio_bat_dau: '14:00' },
]

test('walk-in trong giờ nghỉ trưa không được giữ slot ca chiều', () => {
  // 11:37 Asia/Ho_Chi_Minh = 04:37 UTC.
  const allowed = cacKhungDuocBanTaiQuay(slots, ngay, new Date('2026-07-29T04:37:00.000Z'))
  assert.deepEqual([...allowed], [])
})

test('walk-in trong ca sáng không được chọn chéo sang ca chiều', () => {
  // 11:10 Asia/Ho_Chi_Minh = 04:10 UTC.
  const allowed = cacKhungDuocBanTaiQuay(slots, ngay, new Date('2026-07-29T04:10:00.000Z'))
  assert.deepEqual([...allowed], [6])
})

test('walk-in chỉ mở khung hiện tại và kế tiếp trong cùng ca đang làm việc', () => {
  // 13:35 Asia/Ho_Chi_Minh = 06:35 UTC.
  const allowed = cacKhungDuocBanTaiQuay(slots, ngay, new Date('2026-07-29T06:35:00.000Z'))
  assert.deepEqual([...allowed], [7, 8])
})
