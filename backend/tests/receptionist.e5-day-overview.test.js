import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildDoctorKhungRows,
  chiaCaSangChieu,
} from '../src/controllers/receptionist/booking.controller.js'

test('E-5 groups multiple slots sharing the same khung_index into one row', () => {
  const schedule = {
    slots: [
      { khung_index: 0, gio_bat_dau: '08:00', gio_ket_thuc: '08:30', status: 'active' },
      { khung_index: 0, gio_bat_dau: '08:00', gio_ket_thuc: '08:30', status: 'booked', benh_nhan_id: 'x' },
      { khung_index: 1, gio_bat_dau: '08:30', gio_ket_thuc: '09:00', status: 'active' },
    ],
  }

  const rows = buildDoctorKhungRows(schedule)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].khung_index, 0)
  assert.equal(rows[0].tong_slot, 2)
  assert.equal(rows[0].con_trong, 1)
  assert.equal(rows[1].tong_slot, 1)
  assert.equal(rows[1].con_trong, 1)
})

test('E-5 marks a slot locked by doctor leave and excludes it from con_trong', () => {
  const schedule = {
    slots: [
      { khung_index: 4, gio_bat_dau: '10:00', gio_ket_thuc: '10:30', status: 'locked', bi_khoa_boi_nghi_phep: true },
    ],
  }

  const rows = buildDoctorKhungRows(schedule)
  assert.equal(rows[0].khoa_boi_nghi_phep, true)
  assert.equal(rows[0].con_trong, 0)
})

test('E-5 ignores slots without khung_index (legacy data)', () => {
  const schedule = {
    slots: [
      { khung_index: null, gio_bat_dau: '08:00', gio_ket_thuc: '08:30', status: 'active' },
      { khung_index: 0, gio_bat_dau: '08:00', gio_ket_thuc: '08:30', status: 'active' },
    ],
  }

  const rows = buildDoctorKhungRows(schedule)
  assert.equal(rows.length, 1)
})

test('E-5 returns empty rows when schedule is null (bac si khong co lich)', () => {
  assert.deepEqual(buildDoctorKhungRows(null), [])
})

test('E-5 splits morning/afternoon shifts at the 13:30 lunch boundary', () => {
  const rows = [
    { khung_index: 0, gio_bat_dau: '08:00', gio_ket_thuc: '08:30' },
    { khung_index: 6, gio_bat_dau: '11:00', gio_ket_thuc: '11:30' },
    { khung_index: 7, gio_bat_dau: '13:30', gio_ket_thuc: '14:00' },
    { khung_index: 14, gio_bat_dau: '17:00', gio_ket_thuc: '17:30' },
  ]

  const { ca_sang, ca_chieu } = chiaCaSangChieu(rows)
  assert.equal(ca_sang.length, 2)
  assert.equal(ca_chieu.length, 2)
  assert.equal(ca_chieu[0].gio_bat_dau, '13:30')
})
