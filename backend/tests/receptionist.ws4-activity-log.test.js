import test from 'node:test'
import assert from 'node:assert/strict'

import { locMaTheoNhom, dinhDangBanGhi } from '../src/services/receptionistActivityLog.service.js'
import { MA_HANH_DONG_LE_TAN } from '../src/services/receptionistAudit.service.js'

test('WS-4 không truyền nhóm thì lọc toàn bộ hành động lễ tân', () => {
  assert.deepEqual(locMaTheoNhom().sort(), [...MA_HANH_DONG_LE_TAN].sort())
  assert.deepEqual(locMaTheoNhom('').sort(), [...MA_HANH_DONG_LE_TAN].sort())
})

test('WS-4 nhóm không hợp lệ vẫn trả toàn bộ, không trả mảng rỗng', () => {
  // Trả rỗng sẽ làm trang nhật ký trắng trơn và người dùng tưởng "hôm nay không ai làm gì".
  assert.deepEqual(locMaTheoNhom('nhom_khong_ton_tai').sort(), [...MA_HANH_DONG_LE_TAN].sort())
})

test('WS-4 lọc theo nhóm thanh_toan chỉ trả 2 mã tiền', () => {
  assert.deepEqual(locMaTheoNhom('thanh_toan').sort(), ['LT_LAP_HOA_DON', 'LT_XAC_NHAN_THANH_TOAN'])
})

test('WS-4 định dạng bản ghi trả đủ trường UI cần', () => {
  const record = {
    _id: 'a1',
    ngay_tao: new Date('2026-08-08T02:12:00.000Z'),
    hanh_dong: 'LT_CHECK_IN',
    loai_doi_tuong: 'queue_entry',
    doi_tuong_id: 'q1',
    nguoi_thuc_hien_id: { _id: 'u1', ho_ten: 'Le tan Hoa' },
    du_lieu_moi: { ten_benh_nhan: 'Nguyen Van A', ma_so_thu_tu: 'A012' },
  }

  const row = dinhDangBanGhi(record)

  assert.equal(row.id, 'a1')
  assert.equal(row.hanh_dong, 'LT_CHECK_IN')
  assert.equal(row.nhan_hanh_dong, 'Tiếp nhận bệnh nhân')
  assert.equal(row.nhom, 'tiep_nhan')
  assert.equal(row.nguoi_thuc_hien, 'Le tan Hoa')
  assert.equal(row.ten_khach, 'Nguyen Van A')
})

test('WS-4 bản ghi do cron/hệ thống tạo (không có người thực hiện) vẫn hiển thị được', () => {
  const row = dinhDangBanGhi({
    _id: 'a2',
    ngay_tao: new Date('2026-08-08T02:12:00.000Z'),
    hanh_dong: 'LT_CHECK_IN',
    loai_doi_tuong: 'queue_entry',
    doi_tuong_id: 'q2',
    nguoi_thuc_hien_id: null,
    du_lieu_moi: null,
  })

  assert.equal(row.nguoi_thuc_hien, 'Hệ thống')
  assert.equal(row.ten_khach, null)
})
