import test from 'node:test'
import assert from 'node:assert/strict'

import {
  validateTransferReason,
  doctorCoChuyenKhoa,
} from '../src/services/queueTransfer.service.js'

test('E-4 requires a non-empty transfer reason', () => {
  assert.throws(
    () => validateTransferReason(''),
    (error) => error.statusCode === 400 && /lý do/i.test(error.message),
  )
  assert.throws(
    () => validateTransferReason('   '),
    (error) => error.statusCode === 400,
  )
})

test('E-4 trims a valid transfer reason', () => {
  assert.equal(validateTransferReason('  Bac si ban dot xuat  '), 'Bac si ban dot xuat')
})

test('E-4 matches target doctor specialty against the queue entry specialty', () => {
  const specialtyId = '65a000000000000000000001'
  const otherSpecialtyId = '65a000000000000000000002'

  assert.equal(doctorCoChuyenKhoa([specialtyId], specialtyId), true)
  assert.equal(doctorCoChuyenKhoa([otherSpecialtyId], specialtyId), false)
  assert.equal(doctorCoChuyenKhoa([], specialtyId), false)
  assert.equal(doctorCoChuyenKhoa(undefined, specialtyId), false)
})

test('E-4 specialty match compares ObjectId-like values by string, not reference', () => {
  // Mongoose tra ve ObjectId instance, khong phai string — phai so String(id), khong duoc dung ===.
  class FakeObjectId {
    constructor(value) { this.value = value }
    toString() { return this.value }
  }
  const id = '65a000000000000000000001'
  assert.equal(doctorCoChuyenKhoa([new FakeObjectId(id)], new FakeObjectId(id)), true)
})
