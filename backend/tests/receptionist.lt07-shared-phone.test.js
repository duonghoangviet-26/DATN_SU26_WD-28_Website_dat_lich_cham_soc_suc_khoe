import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPatientIdentityFilters } from '../src/controllers/receptionist/booking.controller.js'
import { appointmentBelongsToProfile } from '../src/controllers/receptionist/appointment.controller.js'

test('LT-07: receptionist booking identifies a family member by member_id, not shared phone', () => {
  const filters = buildPatientIdentityFilters({
    userId: 'parent-1',
    memberId: 'child-1',
    tenKhach: 'Be Minh',
    soDienThoaiKhach: '0900000001',
  })

  assert.deepEqual(filters, [{ member_id: 'child-1' }])
})

test('LT-07: receptionist booking keeps two different walk-in names on the same phone separate', () => {
  const filters = buildPatientIdentityFilters({
    userId: 'shared-account',
    memberId: null,
    tenKhach: 'Nguyen Van A',
    soDienThoaiKhach: '+84 900 000 001',
  })

  assert.equal(filters.length, 1)
  assert.equal(filters[0].member_id, null)
  assert.equal(filters[0].so_dien_thoai_khach.$in.includes('0900000001'), true)
  assert.equal(filters[0].user_id, undefined)
})

test('LT-07: check-in rejects matching a proxy appointment by the guardian account alone', () => {
  const appointment = {
    _id: 'appointment-1',
    user_id: 'parent-1',
    member_id: 'child-1',
    nguoi_dat_ho_id: 'parent-1',
    dat_ho: true,
    ten_khach: 'Be Minh',
    so_dien_thoai_khach: '0900000001',
  }
  const guardianProfile = {
    _id: 'profile-parent',
    tai_khoan_id: 'parent-1',
    ho_ten: 'Nguyen Thi Me',
    so_dien_thoai: '0900000001',
  }
  const childProfile = {
    _id: 'profile-child',
    member_id: 'child-1',
    ho_ten: 'Be Minh',
    so_dien_thoai: '0900000001',
  }

  assert.equal(appointmentBelongsToProfile(appointment, guardianProfile), false)
  assert.equal(appointmentBelongsToProfile(appointment, childProfile), true)
})

test('LT-07: legacy phone-only appointment is ambiguous when the confirmed profile does not match name', () => {
  const appointment = {
    _id: 'appointment-legacy',
    ten_khach: 'Tran Van B',
    so_dien_thoai_khach: '0900000001',
  }
  const profile = {
    _id: 'profile-a',
    ho_ten: 'Nguyen Van A',
    so_dien_thoai: '0900000001',
  }

  assert.equal(appointmentBelongsToProfile(appointment, profile), false)
})
