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
 * Nhật ký của một ngày.
 *
 * @param {object}  p
 * @param {string?} p.ngay     - ISO date; thiếu thì lấy hôm nay
 * @param {string?} p.nguoiId  - lọc theo người thực hiện
 * @param {string?} p.nhom     - 'tiep_nhan' | 'thanh_toan' | 'lich_hen' | 'lien_he'
 */
export async function layNhatKyCaTruc({ ngay = null, nguoiId = null, nhom = null } = {}) {
  const tu = ngay ? startOfDayUtc(new Date(ngay)) : startOfDayUtc(new Date())
  const den = new Date(tu)
  den.setUTCDate(den.getUTCDate() + 1)

  const filter = {
    hanh_dong: { $in: locMaTheoNhom(nhom) },
    ngay_tao: { $gte: tu, $lt: den },
  }
  if (nguoiId) filter.nguoi_thuc_hien_id = nguoiId

  const records = await NhatKyThaoTac.find(filter)
    .populate('nguoi_thuc_hien_id', 'ho_ten')
    .sort({ ngay_tao: -1, _id: -1 })
    .limit(500)
    .lean()

  const rows = records.map((record) => ({
    ...dinhDangBanGhi(record),
    _lookupKey: String(record._id),
  }))
  return boSungTenKhachTuNghiepVu(rows)
}
