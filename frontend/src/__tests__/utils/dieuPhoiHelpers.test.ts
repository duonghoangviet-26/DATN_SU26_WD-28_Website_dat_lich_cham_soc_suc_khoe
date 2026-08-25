import { describe, expect, it } from 'vitest'
import { xepBuocQuyTrinh, dinhDangDemNguoc, xepTrangThaiTheBacSi } from '@/utils/dieuPhoiHelpers'

describe('xepBuocQuyTrinh', () => {
  it('bước 1 luôn xong khi đơn tồn tại', () => {
    const buoc = xepBuocQuyTrinh({ so_lich_anh_huong: 5, so_cho_duyet: 3, so_da_doi: 0, so_khong_co_cho: 0, so_khong_co_cho_da_xu_ly: 0, so_da_ket_thuc: 0 })
    expect(buoc[0].xong).toBe(true)
  })

  it('bước 2 đang làm khi còn lịch chờ duyệt', () => {
    const buoc = xepBuocQuyTrinh({ so_lich_anh_huong: 5, so_cho_duyet: 3, so_da_doi: 0, so_khong_co_cho: 0, so_khong_co_cho_da_xu_ly: 0, so_da_ket_thuc: 0 })
    expect(buoc[1].dangLam).toBe(true)
    expect(buoc[1].xong).toBe(false)
  })

  it('bước 2 xong khi hết lịch chờ duyệt', () => {
    const buoc = xepBuocQuyTrinh({ so_lich_anh_huong: 5, so_cho_duyet: 0, so_da_doi: 5, so_khong_co_cho: 0, so_khong_co_cho_da_xu_ly: 0, so_da_ket_thuc: 0 })
    expect(buoc[1].xong).toBe(true)
  })

  it('bước 3 CHƯA xong nếu còn lịch không có chỗ chưa xử lý, dù đã dời hết phần còn lại', () => {
    const buoc = xepBuocQuyTrinh({ so_lich_anh_huong: 5, so_cho_duyet: 0, so_da_doi: 4, so_khong_co_cho: 1, so_khong_co_cho_da_xu_ly: 0, so_da_ket_thuc: 0 })
    expect(buoc[2].xong).toBe(false)
  })

  it('bước 3 xong khi đã dời + đã xử lý xong nhóm không có chỗ bằng đúng tổng ảnh hưởng', () => {
    const buoc = xepBuocQuyTrinh({ so_lich_anh_huong: 5, so_cho_duyet: 0, so_da_doi: 4, so_khong_co_cho: 1, so_khong_co_cho_da_xu_ly: 1, so_da_ket_thuc: 0 })
    expect(buoc[2].xong).toBe(true)
  })

  // I1 (2026-08-25): một đề xuất bị từ chối (reject) hoặc tự huỷ quá hạn không phương án
  // (apDungDeXuatQuaHan) chuyển de_xuat_doi.trang_thai='da_huy' — không rơi vào so_da_doi
  // (chưa dời) lẫn so_khong_co_cho_da_xu_ly (không phải lúc nào cũng có nhật ký liên hệ).
  // Trước fix, bước 3 KHÔNG BAO GIỜ đạt 100% nếu có bất kỳ lịch nào bị da_huy dù không còn
  // việc gì phải làm cho lịch đó nữa.
  it('bước 3 xong nhờ so_da_ket_thuc dù so_da_doi + so_khong_co_cho_da_xu_ly chưa đủ', () => {
    const buoc = xepBuocQuyTrinh({ so_lich_anh_huong: 5, so_cho_duyet: 0, so_da_doi: 3, so_khong_co_cho: 0, so_khong_co_cho_da_xu_ly: 0, so_da_ket_thuc: 2 })
    expect(buoc[2].xong).toBe(true)
  })

  // Một lịch da_huy với 0 phương án đồng thời là "cần liên hệ tay" (I2, so_khong_co_cho) VÀ
  // "giai đoạn này đã kết thúc" (I1, so_da_ket_thuc) — hai điều không loại trừ nhau.
  it('bước 3 xong nhờ so_da_ket_thuc dù còn so_khong_co_cho chưa được lễ tân đánh dấu đã gọi', () => {
    const buoc = xepBuocQuyTrinh({ so_lich_anh_huong: 5, so_cho_duyet: 0, so_da_doi: 3, so_khong_co_cho: 2, so_khong_co_cho_da_xu_ly: 0, so_da_ket_thuc: 2 })
    expect(buoc[2].xong).toBe(true)
  })

  it('bước 3 chưa xong nếu so_da_doi + so_khong_co_cho_da_xu_ly + so_da_ket_thuc vẫn thiếu', () => {
    const buoc = xepBuocQuyTrinh({ so_lich_anh_huong: 5, so_cho_duyet: 0, so_da_doi: 3, so_khong_co_cho: 1, so_khong_co_cho_da_xu_ly: 0, so_da_ket_thuc: 1 })
    expect(buoc[2].xong).toBe(false)
  })
})

describe('dinhDangDemNguoc', () => {
  const now = new Date('2026-08-25T10:00:00.000Z')

  it('trả null khi không có hạn', () => {
    expect(dinhDangDemNguoc(null, now)).toBe(null)
  })

  it('còn hạn -> quaHan false, hiện số giờ còn lại', () => {
    const han = new Date('2026-08-25T13:00:00.000Z').toISOString()
    const kq = dinhDangDemNguoc(han, now)
    expect(kq?.quaHan).toBe(false)
    expect(kq?.text).toContain('3')
  })

  it('quá hạn -> quaHan true', () => {
    const han = new Date('2026-08-25T08:00:00.000Z').toISOString()
    const kq = dinhDangDemNguoc(han, now)
    expect(kq?.quaHan).toBe(true)
  })
})

describe('xepTrangThaiTheBacSi', () => {
  it('lam_viec: bác sĩ đang làm việc bình thường', () => {
    expect(xepTrangThaiTheBacSi({ trang_thai_ngay: 'lam_viec', leave_id: null, so_lich_chua_xu_ly: 0 }, null)).toBe('lam_viec')
  })

  it('cho_duyet: có đơn xin nghỉ đang chờ duyệt (bác sĩ tự gửi)', () => {
    expect(xepTrangThaiTheBacSi({ trang_thai_ngay: 'lam_viec', leave_id: null, so_lich_chua_xu_ly: 0 }, { _id: 'l1' } as any)).toBe('cho_duyet')
  })

  it('con_viec: đang nghỉ, còn lịch chưa điều phối', () => {
    expect(xepTrangThaiTheBacSi({ trang_thai_ngay: 'nghi_phep', leave_id: 'l1', so_lich_chua_xu_ly: 2 }, null)).toBe('con_viec')
  })

  it('da_xong: đang nghỉ, hết việc điều phối', () => {
    expect(xepTrangThaiTheBacSi({ trang_thai_ngay: 'nghi_phep', leave_id: 'l1', so_lich_chua_xu_ly: 0 }, null)).toBe('da_xong')
  })

  it('đơn chờ duyệt (bác sĩ tự gửi) ưu tiên hơn trạng thái đang làm việc hôm nay', () => {
    // Đơn xin nghỉ NGÀY MAI trong khi hôm nay vẫn 'lam_viec' -> vẫn phải hiện badge chờ duyệt.
    expect(xepTrangThaiTheBacSi({ trang_thai_ngay: 'lam_viec', leave_id: null, so_lich_chua_xu_ly: 0 }, { _id: 'l1' } as any)).toBe('cho_duyet')
  })

  // I4 (2026-08-25): một đơn nghỉ MỘT KHUNG (mục 15, vd bác sĩ bận 10:00-10:30) KHÔNG đổi
  // trang_thai_ngay khỏi 'lam_viec' — bác sĩ vẫn làm việc gần trọn ngày. Trước fix, hàm này
  // chỉ nhìn leave_id (được set cho MỌI đơn da_duyet phủ ngày, kể cả đơn 1 khung) nên bác sĩ
  // bị xếp nhầm vào trạng thái điều phối, mất luôn nút "Báo nghỉ đột xuất".
  it('lam_viec: leave_id có giá trị nhưng trang_thai_ngay vẫn lam_viec (nghỉ 1 khung, mục 15) -> vẫn là lam_viec', () => {
    expect(xepTrangThaiTheBacSi({ trang_thai_ngay: 'lam_viec', leave_id: 'l1', so_lich_chua_xu_ly: 3 }, null)).toBe('lam_viec')
  })

  it('con_viec: trang_thai_ngay = nghi (không phải nghi_phep) vẫn được coi là đang nghỉ điều phối', () => {
    expect(xepTrangThaiTheBacSi({ trang_thai_ngay: 'nghi', leave_id: 'l1', so_lich_chua_xu_ly: 1 }, null)).toBe('con_viec')
  })
})
