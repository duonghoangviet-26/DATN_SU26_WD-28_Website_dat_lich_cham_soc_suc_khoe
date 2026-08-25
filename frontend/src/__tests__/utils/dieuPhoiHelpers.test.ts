import { describe, expect, it } from 'vitest'
import { xepBuocQuyTrinh, dinhDangDemNguoc } from '@/utils/dieuPhoiHelpers'

describe('xepBuocQuyTrinh', () => {
  it('bước 1 luôn xong khi đơn tồn tại', () => {
    const buoc = xepBuocQuyTrinh({ so_lich_anh_huong: 5, so_cho_duyet: 3, so_da_doi: 0, so_khong_co_cho: 0, so_khong_co_cho_da_xu_ly: 0 })
    expect(buoc[0].xong).toBe(true)
  })

  it('bước 2 đang làm khi còn lịch chờ duyệt', () => {
    const buoc = xepBuocQuyTrinh({ so_lich_anh_huong: 5, so_cho_duyet: 3, so_da_doi: 0, so_khong_co_cho: 0, so_khong_co_cho_da_xu_ly: 0 })
    expect(buoc[1].dangLam).toBe(true)
    expect(buoc[1].xong).toBe(false)
  })

  it('bước 2 xong khi hết lịch chờ duyệt', () => {
    const buoc = xepBuocQuyTrinh({ so_lich_anh_huong: 5, so_cho_duyet: 0, so_da_doi: 5, so_khong_co_cho: 0, so_khong_co_cho_da_xu_ly: 0 })
    expect(buoc[1].xong).toBe(true)
  })

  it('bước 3 CHƯA xong nếu còn lịch không có chỗ chưa xử lý, dù đã dời hết phần còn lại', () => {
    const buoc = xepBuocQuyTrinh({ so_lich_anh_huong: 5, so_cho_duyet: 0, so_da_doi: 4, so_khong_co_cho: 1, so_khong_co_cho_da_xu_ly: 0 })
    expect(buoc[2].xong).toBe(false)
  })

  it('bước 3 xong khi đã dời + đã xử lý xong nhóm không có chỗ bằng đúng tổng ảnh hưởng', () => {
    const buoc = xepBuocQuyTrinh({ so_lich_anh_huong: 5, so_cho_duyet: 0, so_da_doi: 4, so_khong_co_cho: 1, so_khong_co_cho_da_xu_ly: 1 })
    expect(buoc[2].xong).toBe(true)
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
