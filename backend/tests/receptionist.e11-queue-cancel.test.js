import test from 'node:test'
import assert from 'node:assert/strict'

import { chuanHoaLyDoHuyLuot } from '../src/services/queueCancel.service.js'

test('E-11 requires a reason when the actor is receptionist', () => {
  assert.throws(
    () => chuanHoaLyDoHuyLuot('', true),
    (error) => error.statusCode === 400 && /lý do/i.test(error.message),
  )
  assert.throws(
    () => chuanHoaLyDoHuyLuot('   ', true),
    (error) => error.statusCode === 400,
  )
})

test('E-11 trims a valid reason for receptionist', () => {
  assert.equal(chuanHoaLyDoHuyLuot('  Khach bo ve  ', true), 'Khach bo ve')
})

test('E-11 does not require a reason for other actors (keeps doctor behavior unchanged)', () => {
  assert.equal(chuanHoaLyDoHuyLuot(null, false), null)
  assert.equal(chuanHoaLyDoHuyLuot('', false), null)
  assert.equal(chuanHoaLyDoHuyLuot('Ban dot xuat', false), 'Ban dot xuat')
})
