import test from 'node:test'
import assert from 'node:assert/strict'

import { kiemTraDiUngThuoc } from '../src/services/drugAllergyCheck.service.js'

test('B47 khong di ung -> khong canh bao', () => {
  const res = kiemTraDiUngThuoc({ diUng: null, thuoc: [{ ten_thuoc: 'Amoxicillin' }] })
  assert.deepEqual(res, [])
})

test('B47 khong co thuoc -> khong canh bao', () => {
  const res = kiemTraDiUngThuoc({ diUng: 'Penicillin', thuoc: [] })
  assert.deepEqual(res, [])
})

test('B47 ten thuoc chua tu khoa di ung (khong dau, khong hoa/thuong)', () => {
  const res = kiemTraDiUngThuoc({
    diUng: 'Penicillin, tôm cua',
    thuoc: [{ ten_thuoc: 'Amoxicillin + Penicillin' }, { ten_thuoc: 'Paracetamol' }],
  })
  assert.equal(res.length, 1)
  assert.equal(res[0].ten_thuoc, 'Amoxicillin + Penicillin')
  assert.deepEqual(res[0].tu_khoa_trung, ['penicillin'])
})

test('B47 di ung ghi cum dai khong tach duoc, van bat duoc tu khoa nam trong cum', () => {
  const res = kiemTraDiUngThuoc({
    diUng: 'dị ứng nhóm Penicillin nặng',
    thuoc: [{ ten_thuoc: 'Penicillin' }],
  })
  assert.equal(res.length, 1)
  assert.equal(res[0].ten_thuoc, 'Penicillin')
})

test('B47 tu khoa qua ngan (duoi 3 ky tu) bi bo qua de tranh trung nham', () => {
  const res = kiemTraDiUngThuoc({
    diUng: 'đá, ho',
    thuoc: [{ ten_thuoc: 'Hoạt huyết dưỡng não' }],
  })
  assert.deepEqual(res, [])
})

test('B47 khong dau tieng Viet van khop dung (vd di ung "Tôm" ~ thuoc co "tom")', () => {
  const res = kiemTraDiUngThuoc({
    diUng: 'Tôm, cua',
    thuoc: [{ ten_thuoc: 'Dầu gan cá Tomcod' }],
  })
  assert.equal(res.length, 1)
  assert.deepEqual(res[0].tu_khoa_trung, ['tom'])
})

test('B47 nhieu thuoc, chi thuoc khap moi vao canh bao', () => {
  const res = kiemTraDiUngThuoc({
    diUng: 'Aspirin',
    thuoc: [{ ten_thuoc: 'Paracetamol' }, { ten_thuoc: 'Aspirin 81mg' }],
  })
  assert.equal(res.length, 1)
  assert.equal(res[0].ten_thuoc, 'Aspirin 81mg')
})
