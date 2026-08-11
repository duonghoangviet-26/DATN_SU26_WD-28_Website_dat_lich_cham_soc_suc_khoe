import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ketLuanSucChuaHangDoiOfflineTrungTam,
  sapXepHangDoiTrungTam,
} from '../src/services/centralOfflineQueue.service.js'

const baseCapacity = {
  doctorCount: 2,
  usableDoctorCount: 1,
  centralAhead: 0,
  maxCentralOfflineQueueSize: 10,
  maxOfflinePerShiftPerSpecialty: 20,
  estimatedWaitMinutes: 15,
  maxOfflineWaitMinutes: 90,
  offlineWarningWaitMinutes: 60,
}

test('offline central queue accepts when there is safe doctor capacity', () => {
  const result = ketLuanSucChuaHangDoiOfflineTrungTam(baseCapacity)
  assert.equal(result.trangThai, 'co_the_nhan')
  assert.equal(result.lyDo, null)
})

test('offline central queue pauses when no doctor can safely receive walk-ins', () => {
  const result = ketLuanSucChuaHangDoiOfflineTrungTam({
    ...baseCapacity,
    usableDoctorCount: 0,
  })
  assert.equal(result.trangThai, 'tam_dung_nhan')
  assert.match(result.lyDo, /du thoi gian an toan/i)
})

test('offline central queue pauses when central queue reaches the active waiting limit', () => {
  const result = ketLuanSucChuaHangDoiOfflineTrungTam({
    ...baseCapacity,
    centralAhead: 10,
  })
  assert.equal(result.trangThai, 'tam_dung_nhan')
  assert.match(result.lyDo, /gioi han so khach/i)
})

test('offline central queue requires warning confirmation before max wait is exceeded', () => {
  const result = ketLuanSucChuaHangDoiOfflineTrungTam({
    ...baseCapacity,
    estimatedWaitMinutes: 60,
  })
  assert.equal(result.trangThai, 'canh_bao_day')
  assert.match(result.lyDo, /can thong bao khach/i)
})

test('offline central queue pauses when estimated wait exceeds the allowed max wait', () => {
  const result = ketLuanSucChuaHangDoiOfflineTrungTam({
    ...baseCapacity,
    estimatedWaitMinutes: 91,
  })
  assert.equal(result.trangThai, 'tam_dung_nhan')
  assert.match(result.lyDo, /vuot nguong 90 phut/i)
})

test('offline central queue sorts emergency and priority before normal FIFO entries', () => {
  const rows = [
    { id: 'normal-old', muc_uu_tien_tiep_nhan: 'binh_thuong', thoi_diem_vao_hang_doi_trung_tam: '2026-08-11T01:00:00.000Z' },
    { id: 'priority-new', muc_uu_tien_tiep_nhan: 'uu_tien', thoi_diem_vao_hang_doi_trung_tam: '2026-08-11T01:20:00.000Z' },
    { id: 'emergency-new', muc_uu_tien_tiep_nhan: 'cap_cuu', thoi_diem_vao_hang_doi_trung_tam: '2026-08-11T01:30:00.000Z' },
    { id: 'normal-new', muc_uu_tien_tiep_nhan: 'binh_thuong', thoi_diem_vao_hang_doi_trung_tam: '2026-08-11T01:10:00.000Z' },
  ]

  rows.sort(sapXepHangDoiTrungTam)

  assert.deepEqual(rows.map((row) => row.id), ['emergency-new', 'priority-new', 'normal-old', 'normal-new'])
})
