import test from 'node:test'
import assert from 'node:assert/strict'

import { buildOverloadAffectedList } from '../src/controllers/receptionist/appointment.controller.js'

const NGAY = new Date('2026-08-03T00:00:00.000Z')

function apt(overrides) {
  return {
    _id: 'apt-id',
    ma_lich_hen: 'LH-001',
    ten_khach: 'Khach hang',
    so_dien_thoai_khach: '0900000000',
    ngay_kham: NGAY,
    gio_kham: '09:00',
    status: 'confirmed',
    user_id: null,
    ...overrides,
  }
}

test('E-6 excludes appointments whose slot time already passed', () => {
  // now = 10:00 gio VN (03:00 UTC) -> khung 09:00 da qua, khung 11:00 chua toi.
  const now = new Date('2026-08-03T03:00:00.000Z')
  const list = buildOverloadAffectedList(
    [apt({ gio_kham: '09:00' }), apt({ gio_kham: '11:00' })],
    now,
    20,
  )
  assert.equal(list.length, 1)
  assert.equal(list[0].gio_kham, '11:00')
})

test('E-6 sorts remaining appointments by gio_kham ascending', () => {
  const now = new Date('2026-08-03T00:00:00.000Z')
  const list = buildOverloadAffectedList(
    [apt({ gio_kham: '15:00' }), apt({ gio_kham: '09:00' }), apt({ gio_kham: '11:00' })],
    now,
    10,
  )
  assert.deepEqual(list.map((row) => row.gio_kham), ['09:00', '11:00', '15:00'])
})

test('E-6 prefers user_id contact info over guest fields when both present', () => {
  const now = new Date('2026-08-03T00:00:00.000Z')
  const list = buildOverloadAffectedList(
    [apt({ user_id: { ho_ten: 'Nguyen Van A', so_dien_thoai: '0911111111' }, ten_khach: 'Khach vang lai', so_dien_thoai_khach: '0922222222' })],
    now,
    5,
  )
  assert.equal(list[0].ten_benh_nhan, 'Nguyen Van A')
  assert.equal(list[0].so_dien_thoai, '0911111111')
})

test('E-6 stamps every row with the same do_tre_ca_phut for the doctor', () => {
  const now = new Date('2026-08-03T00:00:00.000Z')
  const list = buildOverloadAffectedList(
    [apt({ gio_kham: '09:00' }), apt({ gio_kham: '10:00' })],
    now,
    45,
  )
  assert.deepEqual(list.map((row) => row.thoi_gian_tre_uoc_tinh_phut), [45, 45])
})
