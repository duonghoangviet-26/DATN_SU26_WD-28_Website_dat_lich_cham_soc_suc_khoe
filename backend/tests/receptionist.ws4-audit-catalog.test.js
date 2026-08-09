import test from 'node:test'
import assert from 'node:assert/strict'

import {
  HANH_DONG_LE_TAN,
  MA_HANH_DONG_LE_TAN,
  NHOM_HANH_DONG,
  nhanHanhDong,
  nhomCuaHanhDong,
} from '../src/services/receptionistAudit.service.js'

test('WS-4 danh mục có đúng 10 hành động lễ tân', () => {
  assert.equal(MA_HANH_DONG_LE_TAN.length, 10)
  assert.equal(new Set(MA_HANH_DONG_LE_TAN).size, 10)
})

test('WS-4 mọi mã đều bắt đầu bằng LT_ và không quá 100 ký tự (giới hạn schema)', () => {
  for (const ma of MA_HANH_DONG_LE_TAN) {
    assert.ok(ma.startsWith('LT_'), `${ma} phải bắt đầu bằng LT_`)
    assert.ok(ma.length <= 100, `${ma} vượt maxlength 100 của NhatKyThaoTac.hanh_dong`)
  }
})

test('WS-4 mỗi mã có nhãn tiếng Việt để hiển thị', () => {
  for (const ma of MA_HANH_DONG_LE_TAN) {
    assert.equal(typeof HANH_DONG_LE_TAN[ma], 'string')
    assert.ok(HANH_DONG_LE_TAN[ma].length > 0)
  }
})

test('WS-4 nhanHanhDong trả nhãn đã biết, và trả lại chính mã khi không biết', () => {
  assert.equal(nhanHanhDong('LT_CHECK_IN'), 'Tiếp nhận bệnh nhân')
  assert.equal(nhanHanhDong('KHONG_TON_TAI'), 'KHONG_TON_TAI')
})

test('WS-4 mọi mã thuộc đúng một nhóm, không mã nào lọt ra ngoài', () => {
  const trongNhom = Object.values(NHOM_HANH_DONG).flat()
  assert.equal(trongNhom.length, MA_HANH_DONG_LE_TAN.length)
  assert.equal(new Set(trongNhom).size, MA_HANH_DONG_LE_TAN.length)
  for (const ma of MA_HANH_DONG_LE_TAN) {
    assert.ok(nhomCuaHanhDong(ma), `${ma} chưa được xếp nhóm`)
  }
})

test('WS-4 nhomCuaHanhDong trả null cho mã lạ', () => {
  assert.equal(nhomCuaHanhDong('ADMIN_LOCK_USER'), null)
})
