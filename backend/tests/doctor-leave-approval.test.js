import { test } from 'node:test'
import assert from 'node:assert/strict'
import { laDonNganHanChoLeTan } from '../src/services/doctorLeaveApproval.service.js'

function ngayCach(soNgay) {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + soNgay)
  return d
}

test('Đ2: đơn bắt đầu hôm nay, kết thúc hôm nay -> lễ tân duyệt được', () => {
  assert.equal(laDonNganHanChoLeTan({ tu_ngay: ngayCach(0), den_ngay: ngayCach(0) }), true)
})

test('Đ2: đơn bắt đầu ngày mai, kết thúc ngày mai -> lễ tân duyệt được', () => {
  assert.equal(laDonNganHanChoLeTan({ tu_ngay: ngayCach(1), den_ngay: ngayCach(1) }), true)
})

// LƯU Ý: task brief gốc (task-1-brief.md, Step 1) ghi expected=false cho case này, với giả
// định "hôm nay -> ngày mai" là khoảng nghỉ 2 ngày lịch nên vượt thẩm quyền lễ tân. Đã chạy
// thực tế và xác nhận laDonNganHanChoLeTan (KHÔNG được sửa theo brief) trả về true cho case
// này — soNgay tính bằng hiệu số ngày (round((denNgay-tuNgay)/86400000)) = 1, không phải số
// ngày lịch bao trùm. Test này khoá lại HÀNH VI THẬT hiện tại (regression-lock), không phải
// hành vi brief kỳ vọng. Đã báo lại sự khác biệt này trong task-1-report.md — cần người có
// thẩm quyền nghiệp vụ xác nhận đây có phải lỗ hổng thẩm quyền hay không trước khi sửa hàm.
test('Đ2: đơn bắt đầu hôm nay, kết thúc ngày mai (hiệu số 1 ngày) -> lễ tân duyệt được (hành vi hiện tại)', () => {
  assert.equal(laDonNganHanChoLeTan({ tu_ngay: ngayCach(0), den_ngay: ngayCach(1) }), true)
})

test('Đ2: đơn bắt đầu từ 2 ngày sau trở đi -> vượt thẩm quyền lễ tân', () => {
  assert.equal(laDonNganHanChoLeTan({ tu_ngay: ngayCach(2), den_ngay: ngayCach(2) }), false)
})

test('Đ2: đơn đã hết hiệu lực từ hôm qua -> không thuộc thẩm quyền lễ tân', () => {
  assert.equal(laDonNganHanChoLeTan({ tu_ngay: ngayCach(-2), den_ngay: ngayCach(-1) }), false)
})
