import test from 'node:test'
import assert from 'node:assert/strict'

import { ganTrangThaiLienHe } from '../src/services/contactTasks.service.js'

const APT_1 = '65a000000000000000000101'
const APT_2 = '65a000000000000000000102'

function req(overrides) {
  return { _id: 'req-1', doi_tuong_id: APT_1, ngay_tao: new Date('2026-08-01T03:00:00.000Z'), ...overrides }
}

test('E-3 a request with no later CUSTOMER_CONTACTED is chua_goi', () => {
  const [result] = ganTrangThaiLienHe([req({})], [])
  assert.equal(result.daGoi, false)
  assert.equal(result.contactedRecord, null)
})

test('E-3 a request with a CUSTOMER_CONTACTED created AFTER it is da_goi', () => {
  const contacted = [{ doi_tuong_id: APT_1, ngay_tao: new Date('2026-08-01T04:00:00.000Z'), nguoi_thuc_hien_id: { ho_ten: 'Le tan A' }, ly_do: 'Da lien lac duoc' }]
  const [result] = ganTrangThaiLienHe([req({})], contacted)
  assert.equal(result.daGoi, true)
  assert.equal(result.contactedRecord.nguoi_thuc_hien_id.ho_ten, 'Le tan A')
})

test('E-3 a CUSTOMER_CONTACTED created BEFORE the request does not count (stale/unrelated record)', () => {
  const contacted = [{ doi_tuong_id: APT_1, ngay_tao: new Date('2026-07-30T00:00:00.000Z') }]
  const [result] = ganTrangThaiLienHe([req({})], contacted)
  assert.equal(result.daGoi, false)
})

test('E-3 does not block a second CUSTOMER_CONTACTED from two receptionists calling the same customer — keeps the first one', () => {
  const contacted = [
    { doi_tuong_id: APT_1, ngay_tao: new Date('2026-08-01T04:00:00.000Z'), nguoi_thuc_hien_id: { ho_ten: 'Le tan A' } },
    { doi_tuong_id: APT_1, ngay_tao: new Date('2026-08-01T04:05:00.000Z'), nguoi_thuc_hien_id: { ho_ten: 'Le tan B' } },
  ]
  const [result] = ganTrangThaiLienHe([req({})], contacted)
  assert.equal(result.daGoi, true)
  assert.equal(result.contactedRecord.nguoi_thuc_hien_id.ho_ten, 'Le tan A')
})

test('E-3 correlates each request to contacted records of the SAME appointment only, not other appointments', () => {
  const contacted = [{ doi_tuong_id: APT_2, ngay_tao: new Date('2026-08-01T04:00:00.000Z') }]
  const [result] = ganTrangThaiLienHe([req({ doi_tuong_id: APT_1 })], contacted)
  assert.equal(result.daGoi, false)
})

test('E-3 handles multiple independent requests in one call', () => {
  const requests = [req({ _id: 'r1', doi_tuong_id: APT_1 }), req({ _id: 'r2', doi_tuong_id: APT_2 })]
  const contacted = [{ doi_tuong_id: APT_2, ngay_tao: new Date('2026-08-01T04:00:00.000Z') }]
  const results = ganTrangThaiLienHe(requests, contacted)
  assert.equal(results.find((r) => r.request._id === 'r1').daGoi, false)
  assert.equal(results.find((r) => r.request._id === 'r2').daGoi, true)
})
