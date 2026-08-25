export interface TongQuanChoQuyTrinh {
  so_lich_anh_huong: number
  so_cho_duyet: number
  so_da_doi: number
  so_khong_co_cho: number
  so_khong_co_cho_da_xu_ly: number
}

export interface BuocQuyTrinh {
  key: 'bao_nghi' | 'duyet' | 'bao_khach'
  label: string
  xong: boolean
  dangLam: boolean
  chiTiet: string
}

/** Thanh quy trình 3 bước (mục 3.2 spec) — suy hoàn toàn từ số liệu tong-quan, không lưu DB. */
export function xepBuocQuyTrinh(input: TongQuanChoQuyTrinh): BuocQuyTrinh[] {
  const buoc2Xong = input.so_cho_duyet === 0
  const buoc3Xong = input.so_da_doi + input.so_khong_co_cho_da_xu_ly >= input.so_lich_anh_huong

  return [
    {
      key: 'bao_nghi',
      label: 'Báo nghỉ',
      xong: true,
      dangLam: false,
      chiTiet: `${input.so_lich_anh_huong} lịch bị ảnh hưởng`,
    },
    {
      key: 'duyet',
      label: 'Duyệt phương án',
      xong: buoc2Xong,
      dangLam: !buoc2Xong,
      chiTiet: buoc2Xong ? 'Đã duyệt hết' : `Còn ${input.so_cho_duyet} chờ duyệt`,
    },
    {
      key: 'bao_khach',
      label: 'Báo khách',
      xong: buoc3Xong,
      dangLam: buoc2Xong && !buoc3Xong,
      chiTiet: `${input.so_da_doi} đã dời xong · ${input.so_khong_co_cho} không có chỗ`,
    },
  ]
}

export interface KetQuaDemNguoc {
  text: string
  quaHan: boolean
}

/** Định dạng hạn phản hồi sớm nhất của một đơn nghỉ thành chữ đếm ngược (Tab 2, thẻ bác sĩ c). */
export function dinhDangDemNguoc(hanPhanHoi: string | null, now: Date = new Date()): KetQuaDemNguoc | null {
  if (!hanPhanHoi) return null
  const han = new Date(hanPhanHoi).getTime()
  const conLaiPhut = Math.round((han - now.getTime()) / 60000)

  if (conLaiPhut < 0) {
    return { text: `QUÁ HẠN ${Math.abs(Math.round(conLaiPhut / 60))} giờ`, quaHan: true }
  }
  if (conLaiPhut < 60) {
    return { text: `còn ${conLaiPhut} phút`, quaHan: false }
  }
  return { text: `còn ${Math.round(conLaiPhut / 60)} giờ`, quaHan: false }
}

export type TrangThaiTheBacSi = 'lam_viec' | 'cho_duyet' | 'con_viec' | 'da_xong'

interface DoctorChoPhanLoai {
  trang_thai_ngay: string
  leave_id: string | null
  so_lich_chua_xu_ly: number
}

/** 4 trạng thái thẻ bác sĩ ở Tab 1 (mục 3.3 spec). */
export function xepTrangThaiTheBacSi(doctor: DoctorChoPhanLoai, leaveCuaBacSiChoDuyet: { _id: string } | null): TrangThaiTheBacSi {
  if (leaveCuaBacSiChoDuyet) return 'cho_duyet'
  if (doctor.leave_id) return doctor.so_lich_chua_xu_ly > 0 ? 'con_viec' : 'da_xong'
  return 'lam_viec'
}
