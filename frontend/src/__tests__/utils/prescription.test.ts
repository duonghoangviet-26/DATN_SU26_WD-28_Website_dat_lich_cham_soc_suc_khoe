import { describe, expect, it } from 'vitest'
import { stripEmptyDrugs } from '@/utils/prescription'

describe('stripEmptyDrugs', () => {
  it('loại bỏ dòng thuốc chỉ toàn khoảng trắng / thiếu tên thuốc', () => {
    const drugs = [
      { ten_thuoc: 'Paracetamol', lieu_luong: '1 viên', tan_suat: '', gio_uong: [], so_ngay: 5, ghi_chu: null },
      { ten_thuoc: '   ', lieu_luong: '', tan_suat: '', gio_uong: [], so_ngay: 1, ghi_chu: null },
      { ten_thuoc: '', lieu_luong: '', tan_suat: '', gio_uong: [], so_ngay: 1, ghi_chu: null },
    ]
    const result = stripEmptyDrugs(drugs)
    expect(result).toHaveLength(1)
    expect(result[0].ten_thuoc).toBe('Paracetamol')
  })

  it('giữ nguyên khi mọi dòng đều có tên thuốc', () => {
    const drugs = [
      { ten_thuoc: 'A', lieu_luong: '', tan_suat: '', gio_uong: [], so_ngay: 3, ghi_chu: null },
      { ten_thuoc: 'B', lieu_luong: '', tan_suat: '', gio_uong: [], so_ngay: 3, ghi_chu: null },
    ]
    expect(stripEmptyDrugs(drugs)).toHaveLength(2)
  })

  it('trả mảng rỗng khi không có dòng nào hợp lệ', () => {
    expect(stripEmptyDrugs([{ ten_thuoc: '', lieu_luong: '', tan_suat: '', gio_uong: [], so_ngay: 1, ghi_chu: null }])).toEqual([])
  })
})
