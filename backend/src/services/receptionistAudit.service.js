import { NhatKyThaoTac } from '../models/index.js'

// ============================================================
// WS-4 — Nhật ký thao tác lễ tân
// ============================================================
// Trước 2026-08-08, `checkIn.service.js` KHÔNG ghi audit dòng nào, và toàn hệ thống chỉ có
// đúng một hành động của lễ tân (`PRINT_INVOICE`). Hệ quả: không trả lời được "ai check-in
// khách này", "ai thu tiền khách này". Với 2 lễ tân chia việc và làm thay nhau khi một người
// nghỉ, đó là lỗ hổng vận hành, không phải chuyện kỹ thuật.
//
// `NhatKyThaoTac` là bảng INSERT-ONLY: không sửa, không xoá bản ghi. Muốn "hoàn tác" một
// hành động thì ghi một bản ghi mới (cách `CUSTOMER_CONTACT_REQUIRED` /
// `CUSTOMER_CONTACTED` đang làm), KHÔNG sửa bản ghi cũ.

export const HANH_DONG_LE_TAN = {
  LT_CHECK_IN:            'Tiếp nhận bệnh nhân',
  LT_HUY_CHECK_IN:        'Hủy tiếp nhận',
  LT_TAO_KHACH_VANG_LAI:  'Tạo lượt khách vãng lai',
  LT_XAC_NHAN_THANH_TOAN: 'Xác nhận thu tiền',
  LT_LAP_HOA_DON:         'Lập hóa đơn',
  LT_IN_PHIEU_STT:        'In phiếu số thứ tự',
  LT_DOI_LICH:            'Đổi lịch hẹn',
  LT_HUY_LICH:            'Hủy lịch hẹn',
  LT_GOI_KHACH:           'Gọi điện cho khách',
  LT_XU_LY_THONG_BAO_BS:  'Xử lý thông báo bác sĩ',
}

export const MA_HANH_DONG_LE_TAN = Object.keys(HANH_DONG_LE_TAN)

// Nhóm để lọc trên UI. Lễ tân nghĩ theo đầu việc ("hôm nay ai thu tiền"), không nghĩ theo
// từng mã hành động, nên bộ lọc phải theo nhóm.
export const NHOM_HANH_DONG = {
  tiep_nhan:  ['LT_CHECK_IN', 'LT_HUY_CHECK_IN', 'LT_TAO_KHACH_VANG_LAI', 'LT_IN_PHIEU_STT'],
  thanh_toan: ['LT_XAC_NHAN_THANH_TOAN', 'LT_LAP_HOA_DON'],
  lich_hen:   ['LT_DOI_LICH', 'LT_HUY_LICH'],
  lien_he:    ['LT_GOI_KHACH', 'LT_XU_LY_THONG_BAO_BS'],
}

export function nhanHanhDong(ma) {
  return HANH_DONG_LE_TAN[ma] ?? ma
}

export function nhomCuaHanhDong(ma) {
  for (const [nhom, danhSach] of Object.entries(NHOM_HANH_DONG)) {
    if (danhSach.includes(ma)) return nhom
  }
  return null
}

/**
 * Ghi một thao tác của lễ tân.
 *
 * ⚠️ HÀM NÀY KHÔNG BAO GIỜ THROW, và phải được gọi NGOÀI transaction nghiệp vụ.
 * Lý do: bệnh nhân đang đứng trước quầy. Nếu ghi log lỗi (mất kết nối, validate sai) mà
 * làm check-in thất bại thì người đó không vào được hàng đợi, và cuối ca bị quét thành
 * `no_show` — mất 100% tiền theo rule mục 5, 8. Nhật ký là thứ yếu so với việc tiếp nhận.
 */
export async function ghiNhatKyLeTan({
  hanhDong,
  actorUserId = null,
  actorRole = 'receptionist',
  loaiDoiTuong,
  doiTuongId,
  duLieuMoi = null,
  duLieuCu = null,
} = {}) {
  try {
    if (!hanhDong || !loaiDoiTuong || !doiTuongId) return
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: actorUserId,
      vai_tro: actorRole,
      hanh_dong: hanhDong,
      loai_doi_tuong: loaiDoiTuong,
      doi_tuong_id: doiTuongId,
      du_lieu_cu: duLieuCu,
      du_lieu_moi: duLieuMoi,
    })
  } catch (err) {
    console.error(`[receptionistAudit] Không ghi được nhật ký ${hanhDong}:`, err.message)
  }
}
