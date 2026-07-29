import mongoose from 'mongoose'
import {
  Counter,
  HangDoi,
  HoaDon,
  KetQuaKham,
  LichHen,
  NguoiDung,
  NhatKyThaoTac,
  ThanhToan,
} from '../../models/index.js'
import { layGiaKhamChuyenKhoa } from '../../services/doctorAssignment.service.js'
import { tinhTrangThaiHoaDon } from '../../services/hoaDon.service.js'
import { emitDashboardAppointmentChanged } from '../../realtime/socket.js'
import { CLINIC_UTC_OFFSET_HOURS, startOfClinicDayUtc } from '../../utils/clinicTime.js'
import { created, fail, ok } from '../../utils/response.js'

const SOURCES = ['online', 'offline']
const OFFLINE_ELIGIBLE = ['hoan_thanh', 'cho_dich_vu']
const ONLINE_ELIGIBLE = ['waiting_record', 'completed']

function loi(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

function sourceFrom(req) {
  const source = req.query.source ?? req.body?.source
  if (!SOURCES.includes(source)) throw loi(400, 'Nguồn ca khám không hợp lệ')
  return source
}

async function nextInvoiceNumber(date = new Date()) {
  const part = `${String(date.getUTCFullYear()).slice(-2)}${String(date.getUTCMonth() + 1).padStart(2, '0')}${String(date.getUTCDate()).padStart(2, '0')}`
  const seq = await Counter.nextSeq(`so_hoa_don_${part}`)
  return `HD-${part}-${String(seq).padStart(4, '0')}`
}

async function paidTotal(invoiceId) {
  const payments = await ThanhToan.find({ hoa_don_id: invoiceId, status: 'paid' }).select('so_tien').lean()
  return payments.reduce((total, payment) => total + Number(payment.so_tien || 0), 0)
}

async function pendingPayment(invoiceId) {
  return ThanhToan.findOne({ hoa_don_id: invoiceId, status: 'pending' }).sort({ ngay_tao: -1 }).lean()
}

async function paymentHistory(invoiceId) {
  return ThanhToan.find({ hoa_don_id: invoiceId })
    .select('so_tien phuong_thuc status ma_giao_dich ngay_tao ngay_thanh_toan')
    .sort({ ngay_tao: -1 })
    .lean()
}

function serializePendingPayment(payment) {
  if (!payment) return null
  return {
    id: String(payment._id),
    hoa_don_id: String(payment.hoa_don_id),
    hang_doi_id: payment.hang_doi_id ? String(payment.hang_doi_id) : null,
    so_tien: payment.so_tien,
    phuong_thuc: payment.phuong_thuc,
    status: payment.status,
    ma_giao_dich: payment.ma_giao_dich ?? null,
    ngay_tao: payment.ngay_tao,
    ngay_thanh_toan: payment.ngay_thanh_toan,
  }
}

function serializePaymentHistory(payments) {
  return payments.map((payment) => ({
    id: String(payment._id),
    so_tien: Number(payment.so_tien || 0),
    phuong_thuc: payment.phuong_thuc,
    status: payment.status,
    ma_giao_dich: payment.ma_giao_dich ?? null,
    ngay_tao: payment.ngay_tao,
    ngay_thanh_toan: payment.ngay_thanh_toan ?? null,
  }))
}

async function hoanTatLuotKhamOnlineNeuDaThuDu(caseItem, trangThaiHoaDon) {
  if (caseItem.source !== 'online' || trangThaiHoaDon?.trang_thai_hoa_don !== 'da_thanh_toan_du') return

  const previous = await LichHen.findOneAndUpdate(
    { _id: caseItem.reference_id, status: 'waiting_record' },
    { $set: { status: 'completed' } },
    { new: false }
  ).select('status').lean()

  if (previous) emitDashboardAppointmentChanged(previous.status, 'completed')
}

async function resolveBillingCase(referenceId, source) {
  if (!mongoose.Types.ObjectId.isValid(referenceId)) throw loi(400, 'Mã ca khám không hợp lệ')

  if (source === 'offline') {
    const entry = await HangDoi.findOne({ _id: referenceId, nguon: 'offline' }).lean()
    if (!entry) throw loi(404, 'Không tìm thấy lượt khám vãng lai')
    if (!OFFLINE_ELIGIBLE.includes(entry.trang_thai)) throw loi(409, 'Chỉ thanh toán sau khi lượt khám đã kết thúc')
    const result = await KetQuaKham.findOne({ hang_doi_id: entry._id, status: 'da_xac_nhan' }).lean()
    if (!result) throw loi(409, 'Bác sĩ chưa xác nhận hồ sơ khám, chưa thể lập hóa đơn')
    return {
      source,
      reference_id: entry._id,
      patient_id: entry.ho_so_benh_nhan_id ?? null,
      patient_name: entry.ten_benh_nhan,
      phone: entry.so_dien_thoai ?? null,
      specialty_id: entry.specialty_id,
      queue: entry,
      appointment: null,
      result,
    }
  }

  const appointment = await LichHen.findById(referenceId).lean()
  if (!appointment || appointment.loai_kham !== 'clinic') throw loi(404, 'Không tìm thấy lịch khám tại phòng khám')
  if (!ONLINE_ELIGIBLE.includes(appointment.status)) throw loi(409, 'Ca khám chưa hoàn tất lâm sàng, chưa thể thanh toán')
  const result = await KetQuaKham.findOne({ appointment_id: appointment._id, status: 'da_xac_nhan' }).lean()
  if (!result) throw loi(409, 'Bác sĩ chưa xác nhận hồ sơ khám, chưa thể lập hóa đơn')
  const user = appointment.user_id ? await NguoiDung.findById(appointment.user_id).select('ho_ten so_dien_thoai').lean() : null
  return {
    source,
    reference_id: appointment._id,
    patient_id: appointment.ho_so_benh_nhan_id ?? null,
    patient_name: appointment.ten_khach ?? user?.ho_ten ?? 'Bệnh nhân',
    phone: appointment.so_dien_thoai_khach ?? user?.so_dien_thoai ?? null,
    specialty_id: appointment.specialty_id,
    queue: null,
    appointment,
    result,
  }
}

function invoiceFilter(caseItem) {
  return caseItem.source === 'online'
    ? { appointment_id: caseItem.reference_id }
    : { hang_doi_id: caseItem.reference_id }
}

async function attachOnlinePrepayment(caseItem, invoiceId) {
  if (caseItem.source !== 'online') return
  await ThanhToan.updateMany(
    { appointment_id: caseItem.reference_id, status: 'paid', hoa_don_id: null },
    { $set: { hoa_don_id: invoiceId } },
  )
}

function invoiceLines(caseItem, fee) {
  const orders = caseItem.result.dich_vu_phat_sinh ?? []
  const services = orders.map((line) => ({
    loai: 'dich_vu',
    service_id: line.service_id,
    ten: line.ten,
    so_tien: line.don_gia,
    so_luong: line.so_luong,
    thanh_tien: line.thanh_tien,
    created_at: new Date(),
  }))
  return {
    lines: [
      { loai: 'phi_kham', ten: 'Phí khám', so_tien: fee, so_luong: 1, thanh_tien: fee, created_at: new Date() },
      ...services,
    ],
    serviceTotal: services.reduce((sum, line) => sum + Number(line.thanh_tien || 0), 0),
  }
}

async function getFee(caseItem) {
  if (caseItem.source === 'online') return Number(caseItem.appointment.gia_kham ?? 0)
  return Number((await layGiaKhamChuyenKhoa(caseItem.specialty_id)).gia_kham ?? 0)
}

async function serializeCase(caseItem) {
  const invoice = await HoaDon.findOne(invoiceFilter(caseItem)).lean()
  const paid = invoice ? await paidTotal(invoice._id) : 0
  const pending = invoice ? await pendingPayment(invoice._id) : null
  const payments = invoice ? await paymentHistory(invoice._id) : []
  const preview = invoice
    ? {
      tong_tien_kham: Number(invoice.tong_tien_kham || 0),
      chi_tiet_thu_phi: invoice.chi_tiet_thu_phi,
      tong_tien_phat_sinh: Number(invoice.tong_tien_phat_sinh || 0),
      tong_thanh_toan: Number(invoice.tong_thanh_toan || 0),
      tong_da_thu: paid,
      con_phai_thu: Math.max(0, Number(invoice.tong_thanh_toan || 0) - paid),
      trang_thai_hoa_don: invoice.trang_thai_hoa_don,
      source: 'invoice',
    }
    : (() => {
      const fee = Number(caseItem.appointment?.gia_kham ?? 0)
      const { lines, serviceTotal } = invoiceLines(caseItem, fee)
      const total = fee + serviceTotal
      return {
        tong_tien_kham: fee,
        chi_tiet_thu_phi: lines,
        tong_tien_phat_sinh: serviceTotal,
        tong_thanh_toan: total,
        tong_da_thu: 0,
        con_phai_thu: total,
        trang_thai_hoa_don: 'chua_thanh_toan',
        source: 'medical_record',
      }
    })()

  // Walk-in does not have an appointment price snapshot, so derive its preview
  // from the specialty rate before any invoice is persisted.
  if (!invoice && caseItem.source === 'offline') {
    const fee = await getFee(caseItem)
    const { lines, serviceTotal } = invoiceLines(caseItem, fee)
    preview.tong_tien_kham = fee
    preview.chi_tiet_thu_phi = lines
    preview.tong_tien_phat_sinh = serviceTotal
    preview.tong_thanh_toan = fee + serviceTotal
    preview.con_phai_thu = fee + serviceTotal
  }

  return {
    id: String(caseItem.reference_id),
    source: caseItem.source,
    ten_benh_nhan: caseItem.patient_name,
    so_dien_thoai: caseItem.phone,
    specialty_id: caseItem.specialty_id,
    ngay_kham: caseItem.appointment?.ngay_kham ?? caseItem.queue?.checkin_time ?? null,
    gio_kham: caseItem.appointment?.gio_kham ?? null,
    invoice: invoice ? {
      id: String(invoice._id), so_hoa_don: invoice.so_hoa_don,
      tong_tien_kham: invoice.tong_tien_kham,
      chi_tiet_thu_phi: invoice.chi_tiet_thu_phi,
      tong_tien_phat_sinh: invoice.tong_tien_phat_sinh,
      tong_thanh_toan: invoice.tong_thanh_toan,
      tong_da_thu: paid,
      con_phai_thu: Math.max(0, invoice.tong_thanh_toan - paid),
      trang_thai_hoa_don: invoice.trang_thai_hoa_don,
    } : null,
    billing_summary: preview,
    pending_payment: serializePendingPayment(pending),
    payments: serializePaymentHistory(payments),
    dich_vu_chi_dinh: caseItem.result.dich_vu_phat_sinh ?? [],
  }
}

export async function listBillingCases(req, res) {
  try {
    const view = req.query.view ?? 'pending'
    if (!['pending', 'paid'].includes(view)) return fail(res, 400, 'Bộ lọc thanh toán không hợp lệ')
    const scope = req.query.scope ?? (view === 'pending' ? 'today' : 'all')
    if (!['today', 'all'].includes(scope)) return fail(res, 400, 'Phạm vi ngày thanh toán không hợp lệ')

    const filterToday = view === 'pending' && scope === 'today'
    const todayDateStart = filterToday ? startOfClinicDayUtc() : null
    const todayDateEnd = todayDateStart ? new Date(todayDateStart) : null
    if (todayDateEnd) todayDateEnd.setUTCDate(todayDateEnd.getUTCDate() + 1)
    const clinicOffsetMs = CLINIC_UTC_OFFSET_HOURS * 60 * 60 * 1000
    const todayInstantStart = todayDateStart ? new Date(todayDateStart.getTime() - clinicOffsetMs) : null
    const todayInstantEnd = todayDateEnd ? new Date(todayDateEnd.getTime() - clinicOffsetMs) : null
    const offlineQuery = { nguon: 'offline', trang_thai: { $in: OFFLINE_ELIGIBLE } }
    if (todayInstantStart && todayInstantEnd) offlineQuery.checkin_time = { $gte: todayInstantStart, $lt: todayInstantEnd }
    const todayAppointmentIds = todayDateStart && todayDateEnd
      ? await LichHen.find({
        loai_kham: 'clinic',
        status: { $in: ONLINE_ELIGIBLE },
        ngay_kham: { $gte: todayDateStart, $lt: todayDateEnd },
      }).distinct('_id')
      : null
    const onlineQuery = { status: 'da_xac_nhan', appointment_id: { $exists: true } }
    if (todayAppointmentIds) onlineQuery.appointment_id = { $in: todayAppointmentIds }

    const [offlineEntries, onlineResults] = await Promise.all([
      HangDoi.find(offlineQuery).sort({ checkin_time: -1 }).limit(100).lean(),
      KetQuaKham.find(onlineQuery).sort({ ngay_cap_nhat: -1 }).limit(100).select('appointment_id').lean(),
    ])
    const candidates = [
      ...offlineEntries.map((entry) => ({ source: 'offline', id: entry._id })),
      ...onlineResults.map((result) => ({ source: 'online', id: result.appointment_id })),
    ]
    const resolved = await Promise.all(candidates.map(async (candidate) => {
      try { return await resolveBillingCase(candidate.id, candidate.source) } catch { return null }
    }))
    const scopedCases = resolved.filter(Boolean).filter((caseItem) => {
      if (!todayDateStart || !todayDateEnd || !todayInstantStart || !todayInstantEnd) return true
      const caseDate = caseItem.source === 'offline' ? caseItem.queue?.checkin_time : caseItem.appointment?.ngay_kham
      if (!caseDate) return false
      const timestamp = new Date(caseDate).getTime()
      return caseItem.source === 'offline'
        ? timestamp >= todayInstantStart.getTime() && timestamp < todayInstantEnd.getTime()
        : timestamp >= todayDateStart.getTime() && timestamp < todayDateEnd.getTime()
    })
    const rows = await Promise.all(scopedCases.map(serializeCase))
    const filteredRows = rows.filter((row) => (
      view === 'paid'
        ? row.billing_summary.trang_thai_hoa_don === 'da_thanh_toan_du'
        : row.billing_summary.trang_thai_hoa_don !== 'da_thanh_toan_du'
    ))
    return ok(res, filteredRows)
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export async function getBillingCase(req, res) {
  try {
    const caseItem = await resolveBillingCase(req.params.referenceId, sourceFrom(req))
    return ok(res, await serializeCase(caseItem))
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export async function createBillingInvoice(req, res) {
  try {
    const caseItem = await resolveBillingCase(req.params.referenceId, sourceFrom(req))
    const fee = await getFee(caseItem)
    const { lines, serviceTotal } = invoiceLines(caseItem, fee)
    const total = fee + serviceTotal
    let invoice = await HoaDon.findOne(invoiceFilter(caseItem))
    if (!invoice) {
      invoice = new HoaDon({
        ...(caseItem.source === 'online' ? { appointment_id: caseItem.reference_id } : { hang_doi_id: caseItem.reference_id }),
        ho_so_benh_nhan_id: caseItem.patient_id,
        so_hoa_don: await nextInvoiceNumber(),
      })
    }
    await attachOnlinePrepayment(caseItem, invoice._id)
    const pending = invoice._id ? await pendingPayment(invoice._id) : null
    if (pending) throw loi(409, 'Hóa đơn đang có giao dịch chuyển khoản chờ xác nhận; hãy xác nhận hoặc hủy giao dịch đó trước')
    const paidBefore = invoice._id ? await paidTotal(invoice._id) : 0
    if (paidBefore > total) throw loi(409, 'Tổng hóa đơn mới nhỏ hơn số tiền đã thu')

    invoice.ho_so_benh_nhan_id = caseItem.patient_id
    invoice.specialty_id = caseItem.specialty_id
    invoice.tong_tien_kham = fee
    invoice.chi_tiet_thu_phi = lines
    invoice.tong_tien_phat_sinh = serviceTotal
    invoice.tong_thanh_toan = total
    await invoice.save()

    const due = Math.max(0, total - paidBefore)
    const method = req.body?.phuong_thuc
    if (due > 0 && method) {
      if (!['tien_mat', 'chuyen_khoan'].includes(method)) throw loi(400, 'Phương thức thanh toán không hợp lệ')
      const paid = method === 'tien_mat'
      await ThanhToan.create({
        hoa_don_id: invoice._id,
        ...(caseItem.source === 'offline' ? { hang_doi_id: caseItem.reference_id } : {}),
        ho_so_benh_nhan_id: caseItem.patient_id,
        so_tien: due,
        loai_thanh_toan: 'thanh_toan_bo_sung',
        phuong_thuc: method,
        status: paid ? 'paid' : 'pending',
        ngay_thanh_toan: paid ? new Date() : null,
        thoi_diem_thanh_toan: paid ? new Date() : null,
        nguoi_thu_id: req.user?._id ?? req.user?.id ?? null,
      })
    }
    const trangThaiHoaDon = await tinhTrangThaiHoaDon(invoice._id)
    await hoanTatLuotKhamOnlineNeuDaThuDu(caseItem, trangThaiHoaDon)
    return created(res, await serializeCase(caseItem), 'Đã lập hoặc cập nhật hóa đơn')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

async function getPendingForCase(referenceId, source, paymentId) {
  const caseItem = await resolveBillingCase(referenceId, source)
  const invoice = await HoaDon.findOne(invoiceFilter(caseItem)).lean()
  if (!invoice) throw loi(404, 'Chưa có hóa đơn')
  const payment = await ThanhToan.findOne({ _id: paymentId, hoa_don_id: invoice._id, status: 'pending' }).lean()
  if (!payment) throw loi(409, 'Giao dịch không còn ở trạng thái chờ xử lý')
  return { caseItem, invoice, payment }
}

export async function confirmTransfer(req, res) {
  try {
    const source = sourceFrom(req)
    const { caseItem, invoice, payment } = await getPendingForCase(req.params.referenceId, source, req.params.paymentId)
    if (payment.phuong_thuc !== 'chuyen_khoan') throw loi(400, 'Chỉ xác nhận giao dịch chuyển khoản')
    const now = new Date()
    const updated = await ThanhToan.findOneAndUpdate({ _id: payment._id, status: 'pending' }, {
      $set: { status: 'paid', ngay_thanh_toan: now, thoi_diem_thanh_toan: now, nguoi_thu_id: req.user?.id ?? null },
    }, { new: true }).lean()
    if (!updated) throw loi(409, 'Giao dịch vừa được xử lý ở tab khác')
    const trangThaiHoaDon = await tinhTrangThaiHoaDon(invoice._id)
    await hoanTatLuotKhamOnlineNeuDaThuDu(caseItem, trangThaiHoaDon)
    return ok(res, await serializeCase(caseItem), 'Đã xác nhận chuyển khoản')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export async function cancelTransfer(req, res) {
  try {
    const source = sourceFrom(req)
    const { caseItem, payment } = await getPendingForCase(req.params.referenceId, source, req.params.paymentId)
    const updated = await ThanhToan.findOneAndUpdate({ _id: payment._id, status: 'pending' }, {
      $set: { status: 'failed', gateway_response: { cancelled_by: 'receptionist', cancelled_at: new Date().toISOString() } },
    }, { new: true }).lean()
    if (!updated) throw loi(409, 'Giao dịch vừa được xử lý ở tab khác')
    return ok(res, await serializeCase(caseItem), 'Đã hủy giao dịch chuyển khoản')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export async function markReceiptPrinted(req, res) {
  try {
    const caseItem = await resolveBillingCase(req.params.referenceId, sourceFrom(req))
    const invoice = await HoaDon.findOne(invoiceFilter(caseItem)).lean()
    if (!invoice || invoice.trang_thai_hoa_don !== 'da_thanh_toan_du') throw loi(409, 'Chỉ in/giao hóa đơn khi đã thanh toán đủ')
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user?._id ?? req.user?.id ?? null,
      vai_tro: 'receptionist', hanh_dong: 'PRINT_INVOICE', loai_doi_tuong: 'invoice', doi_tuong_id: invoice._id,
      du_lieu_moi: { so_hoa_don: invoice.so_hoa_don, source: caseItem.source },
    })
    return ok(res, await serializeCase(caseItem), 'Đã ghi nhận in/giao hóa đơn')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}
