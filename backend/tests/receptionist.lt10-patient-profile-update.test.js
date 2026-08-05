import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildAdministrativeProfileAuditDiff,
  normalizeAdministrativeProfileUpdate,
} from '../src/controllers/receptionist/patient-intake.controller.js'

test('LT-10 normalizes allowed administrative profile update', () => {
  const { ly_do, update } = normalizeAdministrativeProfileUpdate({
    ly_do: 'Sai so dien thoai tren ho so cu',
    ho_ten: '  Nguyen   Van   A  ',
    so_dien_thoai: '+84 912 345 678',
    ngay_sinh: '1990-01-02',
    gioi_tinh: 'nam',
    ghi_chu: '  Cap nhat tai quay  ',
  })

  assert.equal(ly_do, 'Sai so dien thoai tren ho so cu')
  assert.equal(update.ho_ten, 'Nguyen Van A')
  assert.equal(update.so_dien_thoai, '0912345678')
  assert.equal(update.so_dien_thoai_tim_kiem, '0912345678')
  assert.equal(update.ngay_sinh.toISOString(), '1990-01-02T00:00:00.000Z')
  assert.equal(update.gioi_tinh, 'nam')
  assert.equal(update.ghi_chu, 'Cap nhat tai quay')
})

test('LT-10 requires update reason', () => {
  assert.throws(
    () => normalizeAdministrativeProfileUpdate({ ho_ten: 'Nguyen Van A' }),
    (error) => error.statusCode === 400 && /ly do/i.test(error.message),
  )
})

test('LT-10 rejects professional fields for receptionist profile update', () => {
  assert.throws(
    () => normalizeAdministrativeProfileUpdate({
      ly_do: 'Thu sua chuyen mon',
      chan_doan: 'Viem hong',
    }),
    (error) => error.statusCode === 403 && /chuyen mon/i.test(error.message),
  )
})

test('LT-10 builds audit diff with changed fields only', () => {
  const profile = {
    ho_ten: 'Nguyen Van A',
    so_dien_thoai: '0900000000',
    ngay_sinh: new Date('1990-01-02T00:00:00.000Z'),
    ghi_chu: null,
  }
  const diff = buildAdministrativeProfileAuditDiff(profile, {
    ho_ten: 'Nguyen Van A',
    so_dien_thoai: '0912345678',
    so_dien_thoai_tim_kiem: '0912345678',
    ngay_sinh: new Date('1990-01-02T00:00:00.000Z'),
    ghi_chu: 'Cap nhat tai quay',
  })

  assert.deepEqual(diff.changed_fields, ['so_dien_thoai', 'ghi_chu'])
  assert.equal(diff.du_lieu_cu.so_dien_thoai, '0900000000')
  assert.equal(diff.du_lieu_moi.so_dien_thoai, '0912345678')
  assert.equal(diff.du_lieu_cu.ghi_chu, null)
  assert.equal(diff.du_lieu_moi.ghi_chu, 'Cap nhat tai quay')
})
