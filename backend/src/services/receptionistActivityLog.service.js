import { HangDoi, HoaDon, LichHen, NhatKyThaoTac, ThanhToan } from '../models/index.js'
import { startOfDayUtc } from '../utils/clinicTime.js'
import {
  MA_HANH_DONG_LE_TAN,
  NHOM_HANH_DONG,
  nhanHanhDong,
  nhomCuaHanhDong,
} from './receptionistAudit.service.js'

// ============================================================
// WS-4 — Truy vấn "Nhật ký ca trực"
// ============================================================
// Mục đích vận hành: khi một trong hai lễ tân nghỉ, người còn lại mở trang này để biết
// việc đang dở tới đâu và ai đã xử lý khách nào. Vì vậy bộ lọc phải theo NGÀY và theo
// NGƯỜI, không phải theo từng bản ghi.

/**
 * Mã hành động cần lọc theo nhóm UI chọn.
 *
 * Nhóm rỗng hoặc không hợp lệ → trả TOÀN BỘ, không trả mảng rỗng. Trả rỗng sẽ làm trang
 * trắng trơn và người dùng hiểu nhầm là "hôm nay không ai làm gì".
 */
export function locMaTheoNhom(nhom = null) {
  // Object.hasOwn — `nhom` là query string tự do (VD `?nhom=constructor`), tra bằng `[nhom]`
  // trực tiếp sẽ khớp key kế thừa từ prototype (không lặp được) và làm 500 request.
  if (nhom && Object.hasOwn(NHOM_HANH_DONG, nhom)) return [...NHOM_HANH_DONG[nhom]]
  return [...MA_HANH_DONG_LE_TAN]
}

function layTenKhach(duLieu) {
  return duLieu?.ten_benh_nhan
    ?? duLieu?.ten_khach
    ?? duLieu?.patient_name
    ?? duLieu?.customer_name
    ?? null
}

/** Chuyển 1 document audit sang shape UI dùng. Hàm thuần — không chạm DB. */
export function dinhDangBanGhi(record) {
  const duLieu = record.du_lieu_moi ?? null
  return {
    id:             String(record._id),
    thoi_diem:      record.ngay_tao,
    hanh_dong:      record.hanh_dong,
    nhan_hanh_dong: nhanHanhDong(record.hanh_dong),
    nhom:           nhomCuaHanhDong(record.hanh_dong),
    nguoi_thuc_hien_id: record.nguoi_thuc_hien_id?._id
      ? String(record.nguoi_thuc_hien_id._id)
      : null,
    // Cron và migration ghi audit với `nguoi_thuc_hien_id = null` (vai_tro='system').
    nguoi_thuc_hien: record.nguoi_thuc_hien_id?.ho_ten ?? 'Hệ thống',
    loai_doi_tuong: record.loai_doi_tuong,
    doi_tuong_id:   String(record.doi_tuong_id),
    ten_khach:      layTenKhach(duLieu),
    chi_tiet:       duLieu,
  }
}

function ganTenKhach(rows, key, ten) {
  if (!ten) return
  const row = rows.find((item) => item._lookupKey === key)
  if (row && !row.ten_khach) row.ten_khach = ten
}

async function boSungTenKhachTuNghiepVu(rows) {
  const thieuTen = rows.filter((row) => !row.ten_khach)
  if (thieuTen.length === 0) return rows.map(({ _lookupKey, ...row }) => row)

  const invoiceIds = new Set(thieuTen
    .filter((row) => row.loai_doi_tuong === 'invoice')
    .map((row) => row.doi_tuong_id))
  const paymentIds = thieuTen
    .filter((row) => row.loai_doi_tuong === 'payment')
    .map((row) => row.doi_tuong_id)

  const payments = paymentIds.length > 0
    ? await ThanhToan.find({ _id: { $in: paymentIds } })
      .select('_id hoa_don_id hang_doi_id appointment_id')
      .lean()
    : []
  for (const payment of payments) {
    if (payment.hoa_don_id) invoiceIds.add(String(payment.hoa_don_id))
  }

  const invoices = invoiceIds.size > 0
    ? await HoaDon.find({ _id: { $in: [...invoiceIds] } })
      .select('_id hang_doi_id appointment_id')
      .lean()
    : []
  const invoiceById = new Map(invoices.map((invoice) => [String(invoice._id), invoice]))

  const queueIds = new Set()
  const appointmentIds = new Set()
  for (const row of thieuTen) {
    if (row.loai_doi_tuong === 'queue_entry' || row.loai_doi_tuong === 'walk_in_guest') {
      queueIds.add(row.doi_tuong_id)
    }
    if (row.loai_doi_tuong === 'appointment') {
      appointmentIds.add(row.doi_tuong_id)
    }
  }
  for (const invoice of invoices) {
    if (invoice.hang_doi_id) queueIds.add(String(invoice.hang_doi_id))
    if (invoice.appointment_id) appointmentIds.add(String(invoice.appointment_id))
  }
  for (const payment of payments) {
    if (payment.hang_doi_id) queueIds.add(String(payment.hang_doi_id))
    if (payment.appointment_id) appointmentIds.add(String(payment.appointment_id))
  }

  const [queues, appointments] = await Promise.all([
    queueIds.size > 0
      ? HangDoi.find({ _id: { $in: [...queueIds] } }).select('_id ten_benh_nhan').lean()
      : [],
    appointmentIds.size > 0
      ? LichHen.find({ _id: { $in: [...appointmentIds] } }).select('_id ten_khach').lean()
      : [],
  ])
  const tenTheoQueue = new Map(queues.map((queue) => [String(queue._id), queue.ten_benh_nhan]))
  const tenTheoAppointment = new Map(appointments.map((appointment) => [String(appointment._id), appointment.ten_khach]))

  for (const row of thieuTen) {
    if (row.loai_doi_tuong === 'queue_entry' || row.loai_doi_tuong === 'walk_in_guest') {
      ganTenKhach(thieuTen, row._lookupKey, tenTheoQueue.get(row.doi_tuong_id))
      continue
    }

    if (row.loai_doi_tuong === 'appointment') {
      ganTenKhach(thieuTen, row._lookupKey, tenTheoAppointment.get(row.doi_tuong_id))
      continue
    }

    if (row.loai_doi_tuong === 'invoice') {
      const invoice = invoiceById.get(row.doi_tuong_id)
      const ten = invoice?.hang_doi_id
        ? tenTheoQueue.get(String(invoice.hang_doi_id))
        : invoice?.appointment_id
          ? tenTheoAppointment.get(String(invoice.appointment_id))
          : null
      ganTenKhach(thieuTen, row._lookupKey, ten)
      continue
    }

    if (row.loai_doi_tuong === 'payment') {
      const payment = payments.find((item) => String(item._id) === row.doi_tuong_id)
      const invoice = payment?.hoa_don_id ? invoiceById.get(String(payment.hoa_don_id)) : null
      const ten = payment?.hang_doi_id
        ? tenTheoQueue.get(String(payment.hang_doi_id))
        : payment?.appointment_id
          ? tenTheoAppointment.get(String(payment.appointment_id))
          : invoice?.hang_doi_id
            ? tenTheoQueue.get(String(invoice.hang_doi_id))
            : invoice?.appointment_id
              ? tenTheoAppointment.get(String(invoice.appointment_id))
              : null
      ganTenKhach(thieuTen, row._lookupKey, ten)
    }
  }

  return rows.map(({ _lookupKey, ...row }) => row)
}

/**
 * Nhật ký của một ngày hoặc một khoảng thời gian.
 *
 * @param {object}  p
 * @param {string?} p.ngay     - ISO date (Tương thích ngược)
 * @param {string?} p.tu_ngay  - ISO date; từ ngày
 * @param {string?} p.den_ngay - ISO date; đến ngày
 * @param {string?} p.tu_khoa  - chuỗi tìm kiếm (tên khách, tên nhân viên)
 * @param {string?} p.nguoiId  - lọc theo người thực hiện
 * @param {string?} p.nhom     - 'tiep_nhan' | 'thanh_toan' | 'lich_hen' | 'lien_he'
 * @param {number?} p.page     - trang hiện tại (mặc định 1)
 * @param {number?} p.limit    - số lượng trên 1 trang (mặc định 50)
 */
export async function layNhatKyCaTruc({
  ngay = null,
  tu_ngay = null,
  den_ngay = null,
  tu_khoa = null,
  nguoiId = null,
  nhom = null,
  page = 1,
  limit = 50,
} = {}) {
  // Tương thích ngược: nếu truyền ngay thì gán tu_ngay và den_ngay bằng ngay
  const startStr = tu_ngay || ngay || new Date().toISOString()
  const endStr = den_ngay || ngay || new Date().toISOString()

  const tu = startOfDayUtc(new Date(startStr))
  const den = startOfDayUtc(new Date(endStr))
  den.setUTCDate(den.getUTCDate() + 1) // Đến hết ngày (00:00 hôm sau)

  const filter = {
    hanh_dong: { $in: locMaTheoNhom(nhom) },
    ngay_tao: { $gte: tu, $lt: den },
  }
  if (nguoiId) filter.nguoi_thuc_hien_id = nguoiId

  // Lấy dữ liệu thô từ DB (Giới hạn 5000 để bảo vệ memory)
  const records = await NhatKyThaoTac.find(filter)
    .populate('nguoi_thuc_hien_id', 'ho_ten')
    .sort({ ngay_tao: -1, _id: -1 })
    .limit(5000)
    .lean()

  const rawRows = records.map((record) => ({
    ...dinhDangBanGhi(record),
    _lookupKey: String(record._id),
  }))

  // Resolve ten_khach từ các collection khác
  let rows = await boSungTenKhachTuNghiepVu(rawRows)

  // Lọc in-memory theo từ khóa (nếu có)
  if (tu_khoa && tu_khoa.trim() !== '') {
    const kw = tu_khoa.toLowerCase().trim()
    rows = rows.filter((r) => {
      const matchNguoiThucHien = r.nguoi_thuc_hien?.toLowerCase().includes(kw)
      const matchTenKhach = r.ten_khach?.toLowerCase().includes(kw)
      const matchNhanHanhDong = r.nhan_hanh_dong?.toLowerCase().includes(kw)
      
      // Tìm trong chi tiết (lý do, v.v.)
      let matchChiTiet = false
      if (r.chi_tiet) {
        const strChiTiet = JSON.stringify(r.chi_tiet).toLowerCase()
        if (strChiTiet.includes(kw)) {
          matchChiTiet = true
        }
      }

      return matchNguoiThucHien || matchTenKhach || matchNhanHanhDong || matchChiTiet
    })
  }

  // Phân trang
  const total = rows.length
  const pageNum = Math.max(1, Number(page) || 1)
  const limitNum = Math.max(1, Number(limit) || 50)
  const startIndex = (pageNum - 1) * limitNum
  const paginatedRows = rows.slice(startIndex, startIndex + limitNum)

  return {
    rows: paginatedRows,
    total,
    page: pageNum,
    limit: limitNum,
  }
}
