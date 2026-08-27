export interface TongQuanChoQuyTrinh {
  so_lich_anh_huong: number
  so_cho_duyet: number
  so_da_doi: number
  so_khong_co_cho: number
  so_khong_co_cho_da_xu_ly: number
  /** I1 (2026-08-25): lịch có de_xuat_doi.trang_thai='da_huy' (từ chối thủ công hoặc tự huỷ
   * quá hạn không phương án) — không rơi vào so_da_doi lẫn so_khong_co_cho_da_xu_ly nhưng
   * giai đoạn "báo khách" của lịch đó ĐÃ kết thúc, không còn việc gì để chờ. CHỈ dùng để
   * hiển thị (chiTiet) — KHÔNG dùng để tính buoc3Xong nữa, xem so_hoan_tat. */
  so_da_ket_thuc: number
  /** N1 (2026-08-25): số lịch ĐÃ XONG giai đoạn báo khách, đã khử trùng lặp ở BE (union của
   * da_ap_dung ∪ da_huy ∪ khong_co_cho-đã-liên-hệ). Trước đây buoc3Xong CỘNG so_da_doi +
   * so_khong_co_cho_da_xu_ly + so_da_ket_thuc — một lịch da_huy với 0 phương án rơi vào CẢ
   * so_khong_co_cho_da_xu_ly LẪN so_da_ket_thuc nên bị đếm 2 lần, có thể báo "xong 100%"
   * trong khi một lịch KHÁC vẫn chưa được xử lý. so_hoan_tat là số ĐÃ khử trùng lặp — dùng
   * số này thay vì tự cộng lại 3 counter kia. */
  so_hoan_tat: number
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
  const buoc3Xong = input.so_hoan_tat >= input.so_lich_anh_huong

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
  // I4 (2026-08-25): leave_id được set cho MỌI đơn nghỉ da_duyet phủ ngày, kể cả đơn nghỉ
  // MỘT KHUNG (mục 15, vd bác sĩ bận 10:00-10:30) — loại này KHÔNG đổi trang_thai_ngay khỏi
  // 'lam_viec' vì bác sĩ vẫn làm việc gần trọn ngày. Chỉ coi là đang điều phối nghỉ khi
  // trang_thai_ngay thực sự là 'nghi' hoặc 'nghi_phep' — nếu không, một đơn nghỉ 30 phút sẽ
  // làm bác sĩ mất nút "Báo nghỉ đột xuất" và hiện nhầm badge "Đang nghỉ"/"Đã điều phối xong".
  // N2 (2026-08-25): trước đây chỉ coi 'nghi'/'nghi_phep' là đang nghỉ — bỏ sót
  // 'khong_co_lich' (đơn nghỉ nhiều ngày phủ một ngày bác sĩ chưa từng đăng ký ca, nên
  // không có LichLamViec nào cho ngày đó). Trường hợp này leave_id vẫn có giá trị thật
  // (đơn nghỉ đang hiệu lực) nhưng bị xếp nhầm 'lam_viec' — hiện badge xanh + nút "Báo nghỉ"
  // sống trong khi bấm vào sẽ 409 vì đã có đơn nghỉ. Mọi giá trị trang_thai_ngay KHÁC
  // 'lam_viec' đều nghĩa là "không đang làm việc bình thường hôm nay".
  const dangNghiTheoNgay = doctor.trang_thai_ngay !== 'lam_viec'
  if (doctor.leave_id && dangNghiTheoNgay) return doctor.so_lich_chua_xu_ly > 0 ? 'con_viec' : 'da_xong'
  return 'lam_viec'
}
