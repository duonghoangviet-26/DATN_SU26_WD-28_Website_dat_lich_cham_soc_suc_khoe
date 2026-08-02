import test from 'node:test'
import assert from 'node:assert/strict'

import { detectReceptionistMedicalPatchViolation } from '../src/controllers/receptionist/medical-record.controller.js'
import { normalizeAdminMedicalRecordOverride } from '../src/controllers/admin/medical-read.controller.js'

test('LT-11 receptionist direct medical patch detects professional fields', () => {
  const fields = detectReceptionistMedicalPatchViolation({
    chan_doan: 'Viem hong',
    don_thuoc: [{ ten_thuoc: 'A' }],
    ghi_chu_hanh_chinh: 'khong nam trong chuyen mon',
  })

  assert.deepEqual(fields, ['chan_doan', 'don_thuoc'])
})

test('LT-11 admin override requires reason', () => {
  assert.throws(
    () => normalizeAdminMedicalRecordOverride({ chan_doan: 'Viem hong' }),
    (error) => error.statusCode === 400 && /ly do/i.test(error.message),
  )
})

test('LT-11 admin override cannot edit history array', () => {
  assert.throws(
    () => normalizeAdminMedicalRecordOverride({
      ly_do: 'Nhap sai chan doan',
      lich_su_sua: [],
    }),
    (error) => error.statusCode === 403 && /lich su/i.test(error.message),
  )
})

test('LT-11 admin override normalizes allowed medical fields only', () => {
  const { ly_do, update } = normalizeAdminMedicalRecordOverride({
    ly_do_override: 'Sua loi nhap lieu sau khi doi soat',
    chan_doan: '  Viem amidan  ',
    huong_dan_dieu_tri: '  Uong nhieu nuoc  ',
    ghi_chu: '',
    ngay_tai_kham: '2026-08-10',
  })

  assert.equal(ly_do, 'Sua loi nhap lieu sau khi doi soat')
  assert.equal(update.chan_doan, 'Viem amidan')
  assert.equal(update.huong_dan_dieu_tri, 'Uong nhieu nuoc')
  assert.equal(update.ghi_chu, null)
  assert.equal(update.ngay_tai_kham.toISOString(), '2026-08-10T00:00:00.000Z')
})
