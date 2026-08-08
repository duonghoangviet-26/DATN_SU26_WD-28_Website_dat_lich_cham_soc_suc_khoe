import test from 'node:test'
import assert from 'node:assert/strict'

import { gomLichSuKham } from '../src/controllers/receptionist/patient-intake.controller.js'

const PROFILE_A = '65a000000000000000000001'
const PROFILE_B = '65a000000000000000000002'
const APT_1 = '65a000000000000000000101'
const APT_2 = '65a000000000000000000102'

test('E-10 counts HangDoi hoan_thanh entries as completed visits', () => {
  const hangDoi = [
    { ho_so_benh_nhan_id: PROFILE_A, appointment_id: null, thoi_diem_ket_thuc: new Date('2026-06-01'), doctor_id: { user_id: { ho_ten: 'BS A' } } },
    { ho_so_benh_nhan_id: PROFILE_A, appointment_id: null, thoi_diem_ket_thuc: new Date('2026-07-01'), doctor_id: { user_id: { ho_ten: 'BS B' } } },
  ]
  const result = gomLichSuKham(hangDoi, [], [PROFILE_A, PROFILE_B])
  assert.deepEqual(result.get(PROFILE_A), { so_lan: 2, lan_gan_nhat: new Date('2026-07-01'), bac_si_gan_nhat: 'BS B' })
  assert.equal(result.get(PROFILE_B), null)
})

test('E-10 does not double-count a visit that has both HangDoi.hoan_thanh and LichHen.completed', () => {
  const hangDoi = [
    { ho_so_benh_nhan_id: PROFILE_A, appointment_id: APT_1, thoi_diem_ket_thuc: new Date('2026-06-14'), doctor_id: { user_id: { ho_ten: 'BS A' } } },
  ]
  const lichHen = [
    { _id: APT_1, ho_so_benh_nhan_id: PROFILE_A, ngay_kham: new Date('2026-06-14'), doctor_id: { user_id: { ho_ten: 'BS A' } } },
  ]
  const result = gomLichSuKham(hangDoi, lichHen, [PROFILE_A])
  assert.equal(result.get(PROFILE_A).so_lan, 1)
})

test('E-10 still counts a legacy completed LichHen that has no matching HangDoi', () => {
  const hangDoi = [
    { ho_so_benh_nhan_id: PROFILE_A, appointment_id: APT_1, thoi_diem_ket_thuc: new Date('2026-06-14'), doctor_id: null },
  ]
  const lichHen = [
    { _id: APT_1, ho_so_benh_nhan_id: PROFILE_A, ngay_kham: new Date('2026-06-14'), doctor_id: null },
    { _id: APT_2, ho_so_benh_nhan_id: PROFILE_A, ngay_kham: new Date('2026-01-01'), doctor_id: { user_id: { ho_ten: 'BS cu' } } },
  ]
  const result = gomLichSuKham(hangDoi, lichHen, [PROFILE_A])
  assert.equal(result.get(PROFILE_A).so_lan, 2)
})

test('E-10 picks the doctor and date of the most recent visit across both sources', () => {
  const hangDoi = [
    { ho_so_benh_nhan_id: PROFILE_A, appointment_id: null, thoi_diem_ket_thuc: new Date('2026-01-01'), doctor_id: { user_id: { ho_ten: 'BS cu' } } },
  ]
  const lichHen = [
    { _id: APT_2, ho_so_benh_nhan_id: PROFILE_A, ngay_kham: new Date('2026-06-14'), doctor_id: { user_id: { ho_ten: 'BS moi' } } },
  ]
  const result = gomLichSuKham(hangDoi, lichHen, [PROFILE_A])
  assert.equal(result.get(PROFILE_A).bac_si_gan_nhat, 'BS moi')
  assert.deepEqual(result.get(PROFILE_A).lan_gan_nhat, new Date('2026-06-14'))
})

test('E-10 returns null for a profile with no completed visits at all', () => {
  const result = gomLichSuKham([], [], [PROFILE_A])
  assert.equal(result.get(PROFILE_A), null)
})
