import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CAC_BUOC,
  buocKeTiep,
  buocTruoc,
  duocPhepVaoBuoc,
  kiemTraBuocTiepNhan,
  kiemTraBuocChanDoan,
  tinhBMI,
} from '../src/services/examStepRules.js'

test('WS-1 thứ tự 5 bước cố định', () => {
  assert.deepEqual(CAC_BUOC, ['tiep_nhan', 'chan_doan', 'dich_vu', 'ke_don', 'hoan_tat'])
})

test('WS-1 buocKeTiep đi đúng thứ tự và dừng ở bước cuối', () => {
  assert.equal(buocKeTiep('tiep_nhan'), 'chan_doan')
  assert.equal(buocKeTiep('ke_don'), 'hoan_tat')
  assert.equal(buocKeTiep('hoan_tat'), null)
  assert.equal(buocKeTiep('buoc_la'), null)
})

test('WS-1 buocTruoc lùi đúng và dừng ở bước đầu', () => {
  assert.equal(buocTruoc('chan_doan'), 'tiep_nhan')
  assert.equal(buocTruoc('tiep_nhan'), null)
})

test('WS-1 được phép quay lại bước đã qua để sửa', () => {
  assert.equal(duocPhepVaoBuoc('tiep_nhan', 'ke_don'), true)
  assert.equal(duocPhepVaoBuoc('chan_doan', 'chan_doan'), true)
})

test('WS-1 KHÔNG được nhảy cóc sang bước chưa tới', () => {
  // Nhảy thẳng sang kê đơn khi mới ở bước tiếp nhận = hồ sơ thiếu chẩn đoán,
  // đúng lỗi "quá sơ sài" mà hội đồng nêu.
  assert.equal(duocPhepVaoBuoc('ke_don', 'tiep_nhan'), false)
  assert.equal(duocPhepVaoBuoc('chan_doan', 'tiep_nhan'), false)
})

test('WS-1 bước tiếp nhận bắt buộc triệu chứng', () => {
  const r = kiemTraBuocTiepNhan({ trieu_chung_ban_dau: '   ' })
  assert.equal(r.ok, false)
  assert.ok(r.loi.some((m) => m.includes('Triệu chứng')))
})

test('WS-1 bước tiếp nhận KHÔNG bắt buộc cân nặng/chiều cao, chỉ cảnh báo', () => {
  // Quyết định Q7: bắt buộc sẽ khiến bác sĩ nhập bừa khi tái khám -> dữ liệu rác.
  const r = kiemTraBuocTiepNhan({ trieu_chung_ban_dau: 'Đau họng 3 ngày' })
  assert.equal(r.ok, true)
  assert.equal(r.loi.length, 0)
  assert.ok(r.canhBao.some((m) => m.includes('cân nặng')))
})

test('WS-1 bước tiếp nhận đủ sinh hiệu thì không còn cảnh báo', () => {
  const r = kiemTraBuocTiepNhan({
    trieu_chung_ban_dau: 'Đau họng 3 ngày',
    can_nang: 60,
    chieu_cao: 165,
  })
  assert.equal(r.ok, true)
  assert.deepEqual(r.canhBao, [])
})

test('WS-1 bước tiếp nhận từ chối sinh hiệu âm hoặc phi lý', () => {
  const r = kiemTraBuocTiepNhan({ trieu_chung_ban_dau: 'Sốt', can_nang: -5, chieu_cao: 900 })
  assert.equal(r.ok, false)
  assert.equal(r.loi.length, 2)
})

test('WS-1 bước chẩn đoán bắt buộc chẩn đoán', () => {
  assert.equal(kiemTraBuocChanDoan({ chan_doan: '' }).ok, false)
  assert.equal(kiemTraBuocChanDoan({ chan_doan: 'Viêm họng cấp' }).ok, true)
})

test('WS-1 BMI tính đúng và làm tròn 1 chữ số', () => {
  assert.equal(tinhBMI(60, 165), 22)
  assert.equal(tinhBMI(75, 180), 23.1)
})

test('WS-1 BMI trả null khi thiếu dữ liệu', () => {
  assert.equal(tinhBMI(null, 165), null)
  assert.equal(tinhBMI(60, null), null)
  assert.equal(tinhBMI(60, 0), null)
})
