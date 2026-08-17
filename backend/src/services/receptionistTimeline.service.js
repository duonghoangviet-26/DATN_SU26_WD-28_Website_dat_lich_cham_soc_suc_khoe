import mongoose from 'mongoose'
import { HoSoBenhNhan, LichHen, LichSuLichHen, NhatKyThaoTac } from '../models/index.js'

// ============================================================
// E-1 — Timeline hợp nhất cho lễ tân (mục "Ai sửa gần nhất")
// ============================================================
// Lễ tân và admin ghi audit vào hai loai_doi_tuong khác nhau cho cùng một
// bệnh nhân (patient_profile vs patient/user) nên không thấy thao tác của
// nhau. Service này gộp cả hai nguồn thành một danh sách duy nhất.
//
// Whitelist hanh_dong là bắt buộc: nhiều hanh_dong khác của admin (đổi giá
// dịch vụ, xoá tài khoản nhân viên...) không liên quan tới hồ sơ bệnh nhân
// nhưng có thể vô tình khớp filter theo doi_tuong_id nếu không lọc — chặn ở
// đây để lễ tân không bao giờ thấy thao tác ngoài phạm vi của mình.

export const HO_SO_WHITELIST_HANH_DONG = [
  'UPDATE_PATIENT_PROFILE_ADMINISTRATIVE',
  'UPDATE_PATIENT',
  'UPDATE_USER',
  'LOCK_PATIENT',
  'UNLOCK_PATIENT',
  'LOCK_USER',
  'UNLOCK_USER',
  'SOFT_DELETE_PATIENT',
  'RESTORE_PATIENT',
  'SOFT_DELETE_USER',
  'RESTORE_USER',
]

export const LICH_HEN_WHITELIST_HANH_DONG = [
  'DOI_LICH_HEN',
  'CUSTOMER_CONTACT_REQUIRED',
  'AUTO_MARK_NO_SHOW',
  'UNDO_AUTO_MARK_NO_SHOW',
  'AUTO_CANCEL_APPOINTMENT',
  // WS-4 — thao tác của lễ tân lên chính lịch hẹn/lượt khám này. Không có nhóm này thì
  // câu hỏi "ai check-in khách này, ai thu tiền" không trả lời được ở màn chi tiết khách.
  'LT_CHECK_IN',
  'LT_HUY_CHECK_IN',
  'LT_IN_PHIEU_STT',
  'LT_XAC_NHAN_THANH_TOAN',
  'LT_LAP_HOA_DON',
  'LT_DOI_LICH',
  'LT_HUY_LICH',
  'LT_GOI_KHACH',
]

// Trường an toàn để hiện cho lễ tân trong du_lieu_cu/du_lieu_moi (Mixed — có thể
// chứa bất cứ gì tuỳ hanh_dong). Trường không có mặt ở đây bị loại trước khi trả.
const FIELD_WHITELIST = new Set([
  'changed_fields',
  'ho_ten', 'so_dien_thoai', 'anh_dai_dien', 'status',
  'ngay_sinh', 'gioi_tinh', 'nhom_mau', 'di_ung', 'benh_nen', 'dia_chi', 'ghi_chu',
  'primary_member.ngay_sinh', 'primary_member.gioi_tinh', 'primary_member.nhom_mau',
  'primary_member.di_ung', 'primary_member.benh_nen',
  'doctor_id', 'gio_kham', 'ly_do_doi', 'trang_thai', 'no_show_confirmed_at',
  // WS-4 — trường do du_lieu_moi của các hanh_dong LT_* sinh ra (Task 8). Đã có sẵn
  // gio_kham/ly_do_doi ở trên nên không lặp lại. KHÔNG thêm so_dien_thoai, dia_chi,
  // di_ung, benh_nen vào đây — timeline này hiển thị công khai hơn trang nhật ký ca trực.
  'ma_so_thu_tu', 'so_thu_tu', 'nguon', 'ten_benh_nhan', 'phong_kham',
  'ma_lich_hen', 'payment_status', 'so_tien', 'hinh_thuc', 'ma_hoa_don',
  'tong_tien', 'ly_do', 'ngay_kham',
])

export const HANH_DONG_NHAN = {
  UPDATE_PATIENT_PROFILE_ADMINISTRATIVE: 'Lễ tân sửa thông tin hồ sơ',
  UPDATE_PATIENT: 'Admin sửa thông tin bệnh nhân',
  UPDATE_USER: 'Admin sửa thông tin tài khoản',
  LOCK_PATIENT: 'Admin khoá tài khoản',
  UNLOCK_PATIENT: 'Admin mở khoá tài khoản',
  LOCK_USER: 'Admin khoá tài khoản',
  UNLOCK_USER: 'Admin mở khoá tài khoản',
  SOFT_DELETE_PATIENT: 'Admin đưa tài khoản vào thùng rác',
  RESTORE_PATIENT: 'Admin khôi phục tài khoản',
  SOFT_DELETE_USER: 'Admin đưa tài khoản vào thùng rác',
  RESTORE_USER: 'Admin khôi phục tài khoản',
  DOI_LICH_HEN: 'Dời lịch hẹn',
  CUSTOMER_CONTACT_REQUIRED: 'Cần liên hệ thủ công với khách',
  AUTO_MARK_NO_SHOW: 'Hệ thống tự đánh dấu không đến',
  UNDO_AUTO_MARK_NO_SHOW: 'Hoàn tác đánh dấu không đến',
  AUTO_CANCEL_APPOINTMENT: 'Hệ thống tự huỷ lịch (quá hạn thanh toán)',
  // WS-4 — nhãn khớp nguyên văn HANH_DONG_LE_TAN trong receptionistAudit.service.js (Task 1),
  // để cùng một mã hành động không hiện hai nhãn khác nhau ở hai màn hình.
  LT_CHECK_IN: 'Tiếp nhận bệnh nhân',
  LT_HUY_CHECK_IN: 'Hủy tiếp nhận',
  LT_IN_PHIEU_STT: 'In phiếu số thứ tự',
  LT_XAC_NHAN_THANH_TOAN: 'Xác nhận thu tiền',
  LT_LAP_HOA_DON: 'Lập hóa đơn',
  LT_DOI_LICH: 'Đổi lịch hẹn',
  LT_HUY_LICH: 'Hủy lịch hẹn',
  LT_GOI_KHACH: 'Gọi điện cho khách',
}

const VAI_TRO_NHAN = {
  admin: 'Admin',
  doctor: 'Bác sĩ',
  receptionist: 'Lễ tân',
  user: 'Bệnh nhân',
  system: 'Hệ thống',
  nurse: 'Y tá (đã ngừng dùng)',
}

export function locTruongNhayCam(obj) {
  if (!obj || typeof obj !== 'object') return null
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    if (FIELD_WHITELIST.has(key)) result[key] = value
  }
  return Object.keys(result).length ? result : null
}

export function diffThayDoi(cu, moi) {
  if (!cu && !moi) return []
  const fields = new Set([...Object.keys(cu || {}), ...Object.keys(moi || {})])
  fields.delete('changed_fields')
  return [...fields].map((truong) => ({
    truong,
    cu: cu?.[truong] ?? null,
    moi: moi?.[truong] ?? null,
  }))
}

const TRANG_THAI_LICH_HEN_CHUYEN_NHAN = {
  'pending->confirmed': 'Thanh toán thành công, lịch hẹn đã được xác nhận',
  'pending->checked_in': 'Bệnh nhân đã đến quầy và được check-in',
  'confirmed->checked_in': 'Bệnh nhân đã đến quầy và được check-in',
  'checked_in->in_progress': 'Bệnh nhân bắt đầu được khám',
  'in_progress->completed': 'Đã hoàn thành khám',
  'confirmed->completed': 'Đã hoàn thành khám',
  'confirmed->no_show': 'Lịch hẹn được đánh dấu không đến (quá giờ không tới)',
  'pending->no_show': 'Lịch hẹn được đánh dấu không đến (quá giờ không tới)',
}

const PAYMENT_STATUS_CHUYEN_NHAN = {
  'unpaid->paid': 'Thanh toán thành công',
  'unpaid->partial': 'Đã thu một phần tiền khám',
  'partial->paid': 'Đã thu đủ số tiền còn lại',
  'paid->refunded': 'Đã hoàn tiền',
  'partial->refunded': 'Đã hoàn tiền',
}

// Sinh nhan nghiep vu cu the tu danh sach thay_doi (uu tien hon nhan mac dinh theo ma hanh_dong),
// vi mot ma hanh_dong (vd LT_CHECK_IN) co the ung voi nhieu chuyen doi trang_thai khac nhau va
// nguoi doc can biet CHINH XAC chuyen gi xay ra, khong chi "co thao tac check-in".
function nhanTheoNghiepVu(thayDoi, nhanMacDinh) {
  for (const item of thayDoi) {
    if (item.truong !== 'trang_thai' && item.truong !== 'status') continue
    if (item.moi === 'cancelled') return 'Lịch hẹn đã được hủy'
    const nhan = TRANG_THAI_LICH_HEN_CHUYEN_NHAN[`${item.cu}->${item.moi}`]
    if (nhan) return nhan
  }
  for (const item of thayDoi) {
    if (item.truong !== 'payment_status') continue
    const nhan = PAYMENT_STATUS_CHUYEN_NHAN[`${item.cu}->${item.moi}`]
    if (nhan) return nhan
  }
  const doiBacSi = thayDoi.some((item) => item.truong === 'doctor_id')
  const doiGio = thayDoi.some((item) => item.truong === 'gio_kham' || item.truong === 'ngay_kham')
  if (doiGio && doiBacSi) return 'Đổi bác sĩ và thời gian khám'
  if (doiGio) return 'Đổi thời gian khám'
  if (doiBacSi) return 'Đổi bác sĩ phụ trách'
  return nhanMacDinh
}

export function tuNhatKy(log) {
  const cu = locTruongNhayCam(log.du_lieu_cu)
  const moi = locTruongNhayCam(log.du_lieu_moi)
  const thayDoi = diffThayDoi(cu, moi)
  return {
    nguon: 'nhat_ky',
    thoi_diem: log.ngay_tao,
    nguoi: {
      ho_ten: log.nguoi_thuc_hien_id?.ho_ten ?? null,
      vai_tro: VAI_TRO_NHAN[log.vai_tro] ?? log.vai_tro,
    },
    hanh_dong: log.hanh_dong,
    nhan: nhanTheoNghiepVu(thayDoi, HANH_DONG_NHAN[log.hanh_dong] ?? log.hanh_dong),
    ly_do: log.ly_do ?? null,
    thay_doi: thayDoi,
  }
}

export function tuLichSuLichHen(entry) {
  const ngayCuMs = entry.ngay_kham_cu ? new Date(entry.ngay_kham_cu).getTime() : null
  const ngayMoiMs = entry.ngay_kham_moi ? new Date(entry.ngay_kham_moi).getTime() : null
  const thayDoi = [
    entry.tu_trang_thai !== entry.den_trang_thai
      ? { truong: 'trang_thai', cu: entry.tu_trang_thai, moi: entry.den_trang_thai }
      : null,
    entry.gio_kham_cu !== entry.gio_kham_moi && (entry.gio_kham_cu || entry.gio_kham_moi)
      ? { truong: 'gio_kham', cu: entry.gio_kham_cu, moi: entry.gio_kham_moi }
      : null,
    ngayCuMs !== null && ngayMoiMs !== null && ngayCuMs !== ngayMoiMs
      ? { truong: 'ngay_kham', cu: entry.ngay_kham_cu, moi: entry.ngay_kham_moi }
      : null,
    String(entry.bac_si_cu_id ?? '') !== String(entry.bac_si_moi_id ?? '') && (entry.bac_si_cu_id || entry.bac_si_moi_id)
      ? { truong: 'doctor_id', cu: entry.bac_si_cu_id, moi: entry.bac_si_moi_id }
      : null,
  ].filter(Boolean)
  return {
    nguon: 'lich_su_lich_hen',
    thoi_diem: entry.thoi_diem,
    nguoi: {
      ho_ten: entry.nguoi_thay_doi_id?.ho_ten ?? null,
      vai_tro: VAI_TRO_NHAN[entry.vai_tro] ?? entry.vai_tro ?? entry.kenh_thay_doi,
    },
    hanh_dong: entry.loai_thay_doi ?? 'UPDATE_APPOINTMENT',
    nhan: nhanTheoNghiepVu(thayDoi, 'Cập nhật lịch hẹn'),
    ly_do: entry.ly_do_thay_doi ?? entry.ly_do ?? null,
    thay_doi: thayDoi,
  }
}

/** loai='ho_so' — hợp nhất audit của patient_profile (lễ tân) + patient/user (admin). */
export async function layTimelineHoSo(hoSoBenhNhanId) {
  if (!mongoose.Types.ObjectId.isValid(hoSoBenhNhanId)) {
    throw Object.assign(new Error('Ma ho so benh nhan khong hop le'), { statusCode: 400 })
  }
  const profile = await HoSoBenhNhan.findById(hoSoBenhNhanId).select('_id tai_khoan_id nguoi_giam_ho_id').lean()
  if (!profile) throw Object.assign(new Error('Khong tim thay ho so benh nhan'), { statusCode: 404 })

  const accountIds = [profile.tai_khoan_id, profile.nguoi_giam_ho_id].filter(Boolean)

  const logs = await NhatKyThaoTac.find({
    $or: [
      { loai_doi_tuong: 'patient_profile', doi_tuong_id: profile._id, hanh_dong: { $in: HO_SO_WHITELIST_HANH_DONG } },
      ...(accountIds.length
        ? [{ loai_doi_tuong: { $in: ['patient', 'user'] }, doi_tuong_id: { $in: accountIds }, hanh_dong: { $in: HO_SO_WHITELIST_HANH_DONG } }]
        : []),
    ],
  })
    .populate('nguoi_thuc_hien_id', 'ho_ten')
    .sort({ ngay_tao: -1 })
    .lean()

  const rows = logs.map(tuNhatKy)
  return { rows, sua_gan_nhat: rows[0] ?? null }
}

/** loai='lich_hen' — hợp nhất LichSuLichHen + NhatKyThaoTac (loai_doi_tuong='appointment'). */
export async function layTimelineLichHen(lichHenId) {
  if (!mongoose.Types.ObjectId.isValid(lichHenId)) {
    throw Object.assign(new Error('Ma lich hen khong hop le'), { statusCode: 400 })
  }
  const appointment = await LichHen.findById(lichHenId).select('_id').lean()
  if (!appointment) throw Object.assign(new Error('Khong tim thay lich hen'), { statusCode: 404 })

  const [history, logs] = await Promise.all([
    LichSuLichHen.find({ appointment_id: appointment._id })
      .populate('nguoi_thay_doi_id', 'ho_ten')
      .sort({ thoi_diem: -1 })
      .lean(),
    NhatKyThaoTac.find({
      loai_doi_tuong: 'appointment',
      doi_tuong_id: appointment._id,
      hanh_dong: { $in: LICH_HEN_WHITELIST_HANH_DONG },
    })
      .populate('nguoi_thuc_hien_id', 'ho_ten')
      .sort({ ngay_tao: -1 })
      .lean(),
  ])

  const rows = [...history.map(tuLichSuLichHen), ...logs.map(tuNhatKy)]
    .sort((a, b) => new Date(b.thoi_diem).getTime() - new Date(a.thoi_diem).getTime())

  return { rows, sua_gan_nhat: rows[0] ?? null }
}

/**
 * Gom `sua_gan_nhat` cho NHIỀU hồ sơ trong một truy vấn (tránh N+1 khi liệt kê danh sách).
 * Trả về Map<String(hoSoBenhNhanId), dòng timeline mới nhất | null>.
 */
export async function layDongSuaGanNhatChoNhieuHoSo(profiles) {
  const validProfiles = (profiles || []).filter((p) => p?._id)
  if (validProfiles.length === 0) return new Map()

  const profileIds = validProfiles.map((p) => p._id)
  const accountIds = validProfiles.flatMap((p) => [p.tai_khoan_id, p.nguoi_giam_ho_id]).filter(Boolean)

  const logs = await NhatKyThaoTac.find({
    $or: [
      { loai_doi_tuong: 'patient_profile', doi_tuong_id: { $in: profileIds }, hanh_dong: { $in: HO_SO_WHITELIST_HANH_DONG } },
      ...(accountIds.length
        ? [{ loai_doi_tuong: { $in: ['patient', 'user'] }, doi_tuong_id: { $in: accountIds }, hanh_dong: { $in: HO_SO_WHITELIST_HANH_DONG } }]
        : []),
    ],
  })
    .populate('nguoi_thuc_hien_id', 'ho_ten')
    .sort({ ngay_tao: -1 })
    .lean()

  const logsByProfileKey = new Map(profileIds.map((id) => [String(id), []]))
  for (const profile of validProfiles) {
    const key = String(profile._id)
    const targetIds = new Set([String(profile._id), String(profile.tai_khoan_id ?? ''), String(profile.nguoi_giam_ho_id ?? '')])
    for (const log of logs) {
      if (targetIds.has(String(log.doi_tuong_id))) logsByProfileKey.get(key).push(log)
    }
  }

  const result = new Map()
  for (const [key, profileLogs] of logsByProfileKey) {
    profileLogs.sort((a, b) => new Date(b.ngay_tao).getTime() - new Date(a.ngay_tao).getTime())
    result.set(key, profileLogs[0] ? tuNhatKy(profileLogs[0]) : null)
  }
  return result
}

/**
 * Gom `sua_gan_nhat` cho NHIỀU lịch hẹn trong danh sách (2 truy vấn, không N+1).
 * Trả về Map<String(appointmentId), dòng timeline mới nhất | null>.
 */
export async function layDongSuaGanNhatChoNhieuLichHen(appointmentIds) {
  const ids = (appointmentIds || []).filter(Boolean)
  if (ids.length === 0) return new Map()

  const [history, logs] = await Promise.all([
    LichSuLichHen.find({ appointment_id: { $in: ids } })
      .populate('nguoi_thay_doi_id', 'ho_ten')
      .sort({ thoi_diem: -1 })
      .lean(),
    NhatKyThaoTac.find({
      loai_doi_tuong: 'appointment',
      doi_tuong_id: { $in: ids },
      hanh_dong: { $in: LICH_HEN_WHITELIST_HANH_DONG },
    })
      .populate('nguoi_thuc_hien_id', 'ho_ten')
      .sort({ ngay_tao: -1 })
      .lean(),
  ])

  const rowsByAppointment = new Map(ids.map((id) => [String(id), []]))
  for (const entry of history) {
    rowsByAppointment.get(String(entry.appointment_id))?.push(tuLichSuLichHen(entry))
  }
  for (const log of logs) {
    rowsByAppointment.get(String(log.doi_tuong_id))?.push(tuNhatKy(log))
  }

  const result = new Map()
  for (const [key, rows] of rowsByAppointment) {
    rows.sort((a, b) => new Date(b.thoi_diem).getTime() - new Date(a.thoi_diem).getTime())
    result.set(key, rows[0] ?? null)
  }
  return result
}
