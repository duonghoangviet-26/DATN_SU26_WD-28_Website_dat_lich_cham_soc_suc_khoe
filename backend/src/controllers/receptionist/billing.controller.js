import crypto from 'crypto'
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
import { ghiNhatKyLeTan } from '../../services/receptionistAudit.service.js'
import { emitDashboardAppointmentChanged } from '../../realtime/socket.js'
import { CLINIC_UTC_OFFSET_HOURS, startOfClinicDayUtc } from '../../utils/clinicTime.js'
import { created, fail, ok } from '../../utils/response.js'

const SOURCES = ['online', 'offline']
const OFFLINE_ELIGIBLE = ['hoan_thanh', 'cho_dich_vu']
const ONLINE_ELIGIBLE = ['waiting_record', 'completed']

const VNPAY_SESSION_MINUTES = Number(process.env.VNPAY_SESSION_MINUTES || process.env.PAYMENT_HOLD_MINUTES || 15)
const DEFAULT_CLIENT_BASE_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173'

function loi(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

function getGatewayResponseObject(payment) {
  return payment?.gateway_response && typeof payment.gateway_response === 'object'
    ? payment.gateway_response
    : {}
}

function toDateOrNull(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isGatewaySessionExpired(gateway) {
  const expiresAt = toDateOrNull(gateway?.expires_at)
  if (!expiresAt) return false
  return expiresAt.getTime() <= Date.now()
}

function formatVnpDate(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  let y = '', m = '', d = '', h = '', min = '', s = ''

  parts.forEach(part => {
    if (part.type === 'year') y = part.value
    if (part.type === 'month') m = part.value
    if (part.type === 'day') d = part.value
    if (part.type === 'hour') h = part.value
    if (part.type === 'minute') min = part.value
    if (part.type === 'second') s = part.value
  })

  if (h === '24') h = '00'

  return `${y}${m}${d}${h}${min}${s}`
}

// Sinh URL thanh toán VNPAY sandbox cho giao dịch "thanh_toan_bo_sung" (thu bổ sung sau khám,
// mục 10 rule lịch làm việc — hóa đơn không gắn appointment_id nên KHÔNG dùng chung được với
// buildMockVnpayUrl của patient/receptionist payment.controller.js, vốn bắt buộc appointment).
function buildTransferVnpayUrl({ payment, invoice, vnpTxnRef, createdAt, expiresAt }) {
  const tmnCode = process.env.VNP_TMNCODE || 'WVZUTWIX'
  const secretKey = process.env.VNP_HASHSECRET || 'MPCYVPEZAQLIXFLZLGWBKOIXOPTHNWVA'
  const vnpUrl = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'

  const rawParams = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Amount: String(Math.round((payment.so_tien || 0) * 100)),
    vnp_CurrCode: 'VND',
    vnp_TxnRef: vnpTxnRef,
    vnp_OrderInfo: invoice?.so_hoa_don ? `Thanh toan ${invoice.so_hoa_don}` : `Thanh toan giao dich ${payment.ma_giao_dich}`,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_BankCode: 'NCB',
    vnp_IpAddr: '127.0.0.1',
    vnp_CreateDate: formatVnpDate(createdAt),
    vnp_ExpireDate: formatVnpDate(expiresAt),
    vnp_ReturnUrl: `${DEFAULT_CLIENT_BASE_URL}/receptionist/payments?payment_id=${payment._id}&gateway=vnpay`,
  }

  const sortedKeys = Object.keys(rawParams).sort()
  const sortedParams = new URLSearchParams()
  sortedKeys.forEach((key) => {
    sortedParams.append(key, rawParams[key])
  })

  if (secretKey) {
    const hmac = crypto.createHmac('sha512', secretKey)
    const signed = hmac.update(Buffer.from(sortedParams.toString(), 'utf-8')).digest('hex')
    sortedParams.append('vnp_SecureHash', signed)
  }

  return `${vnpUrl}?${sortedParams.toString()}`
}

function buildTransferGateway({ payment, invoice, now }) {
  const expiresAt = new Date(now.getTime() + VNPAY_SESSION_MINUTES * 60 * 1000)
  const vnpTxnRef = `VNPAY-${payment.ma_giao_dich}-${now.getTime().toString().slice(-6)}`
  const paymentUrl = buildTransferVnpayUrl({ payment, invoice, vnpTxnRef, createdAt: now, expiresAt })
  return {
    provider: 'vnpay',
    mode: 'mock',
    merchant_name: 'ViteFamily',
    merchant_code: 'VITAFAMILY',
    note: invoice?.so_hoa_don || payment.ma_giao_dich,
    bank_code: 'VNBANK',
    locale: 'vn',
    vnp_txn_ref: vnpTxnRef,
    payment_url: paymentUrl,
    qr_payload: paymentUrl,
    expires_at: expiresAt.toISOString(),
    session_created_at: now.toISOString(),
  }
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
    .select('so_tien loai_thanh_toan phuong_thuc status ma_giao_dich ngay_tao ngay_thanh_toan')
    .sort({ ngay_tao: -1 })
    .lean()
}

async function confirmCashierReview(invoiceId, userId) {
  await HoaDon.updateOne(
    { _id: invoiceId, da_xac_nhan_thu_ngan: { $ne: true } },
    {
      $set: {
        da_xac_nhan_thu_ngan: true,
        nguoi_xac_nhan_thu_ngan_id: userId ?? null,
        thoi_diem_xac_nhan_thu_ngan: new Date(),
      },
    },
  )
}

function serializePendingPayment(payment) {
  if (!payment) return null
  const gateway = getGatewayResponseObject(payment)
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
    gateway: payment.phuong_thuc === 'chuyen_khoan' ? {
      qr_payload: gateway.qr_payload ?? null,
      expires_at: gateway.expires_at ?? null,
      is_expired: isGatewaySessionExpired(gateway),
    } : null,
  }
}

function serializePaymentHistory(payments) {
  return payments.map((payment) => ({
    id: String(payment._id),
    so_tien: Number(payment.so_tien || 0),
    loai_thanh_toan: payment.loai_thanh_toan,
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
  const apptId = caseItem.appointment?._id ?? caseItem.queue?.appointment_id ?? null
  const queueId = caseItem.queue?._id ?? null

  const conditions = []
  if (queueId) conditions.push({ hang_doi_id: queueId })
  if (apptId) conditions.push({ appointment_id: apptId })

  if (conditions.length === 0) return { _id: null }
  return conditions.length === 1 ? conditions[0] : { $or: conditions }
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

  const isFollowUp = caseItem.queue && (caseItem.queue.loai_lich_hen === 'tai_kham' || caseItem.queue.lich_hen_goc_id != null)
  if (isFollowUp) return 0

  return Number((await layGiaKhamChuyenKhoa(caseItem.specialty_id)).gia_kham ?? 0)
}

async function serializeCase(caseItem) {
  const invoice = await HoaDon.findOne(invoiceFilter(caseItem)).lean()
  const paid = invoice ? await paidTotal(invoice._id) : 0
  const pending = invoice ? await pendingPayment(invoice._id) : null
  const payments = invoice ? await paymentHistory(invoice._id) : []
  // Luôn dựng lại bản xem trước từ hồ sơ khám mới nhất. Hóa đơn online được
  // tạo từ lúc đặt lịch chỉ có phí khám; nếu bác sĩ thêm dịch vụ thì không được
  // tiếp tục hiển thị tổng cũ và kết luận là đã thanh toán đủ.
  const fee = await getFee(caseItem)
  const { lines, serviceTotal } = invoiceLines(caseItem, fee)
  const total = fee + serviceTotal
  const paidBeforeExam = payments
    .filter((payment) => payment.status === 'paid' && ['phi_dat_lich', 'dat_coc'].includes(payment.loai_thanh_toan))
    .reduce((sum, payment) => sum + Number(payment.so_tien || 0), 0)
  const paidAfterExam = payments
    .filter((payment) => payment.status === 'paid' && payment.loai_thanh_toan === 'thanh_toan_bo_sung')
    .reduce((sum, payment) => sum + Number(payment.so_tien || 0), 0)
  const remainingAfterExam = Math.max(0, total - paidBeforeExam - paidAfterExam)
  const invoiceStatus = total <= 0 || paid >= total
    ? 'da_thanh_toan_du'
    : paid > 0 ? 'da_dat_coc' : 'chua_thanh_toan'
  const preview = {
    tong_tien_kham: fee,
    chi_tiet_thu_phi: lines,
    tong_tien_phat_sinh: serviceTotal,
    tong_thanh_toan: total,
    tong_da_thu: paid,
    tong_da_thu_truoc: paidBeforeExam,
    tong_da_thu_sau_kham: paidAfterExam,
    con_phai_thu_sau_kham: remainingAfterExam,
    con_phai_thu: Math.max(0, total - paid),
    trang_thai_hoa_don: invoiceStatus,
    da_xac_nhan_thu_ngan: Boolean(invoice?.da_xac_nhan_thu_ngan && Number(invoice.tong_thanh_toan || 0) === total),
    source: invoice ? 'invoice' : 'medical_record',
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
      tong_tien_kham: preview.tong_tien_kham,
      chi_tiet_thu_phi: preview.chi_tiet_thu_phi,
      tong_tien_phat_sinh: preview.tong_tien_phat_sinh,
      tong_thanh_toan: preview.tong_thanh_toan,
      tong_da_thu: paid,
      con_phai_thu: preview.con_phai_thu,
      trang_thai_hoa_don: preview.trang_thai_hoa_don,
      da_xac_nhan_thu_ngan: preview.da_xac_nhan_thu_ngan,
    } : null,
    billing_summary: preview,
    da_xac_nhan_thu_ngan: preview.da_xac_nhan_thu_ngan,
    pending_payment: serializePendingPayment(pending),
    payments: serializePaymentHistory(payments),
    dich_vu_chi_dinh: caseItem.result.dich_vu_phat_sinh ?? [],
  }
}

export async function listBillingCases(req, res) {
  try {
    const view = req.query.view ?? 'pending'
    if (!['pending', 'paid'].includes(view)) return fail(res, 400, 'Bộ lọc thanh toán không hợp lệ')
    const scope = req.query.scope ?? 'today'
    if (!['today', 'all'].includes(scope)) return fail(res, 400, 'Phạm vi ngày thanh toán không hợp lệ')

    const filterToday = scope === 'today'
    const todayDateStart = filterToday ? startOfClinicDayUtc() : null
    const todayDateEnd = todayDateStart ? new Date(todayDateStart) : null
    if (todayDateEnd) todayDateEnd.setUTCDate(todayDateEnd.getUTCDate() + 1)
    const clinicOffsetMs = CLINIC_UTC_OFFSET_HOURS * 60 * 60 * 1000
    const todayInstantStart = todayDateStart ? new Date(todayDateStart.getTime() - clinicOffsetMs) : null
    const todayInstantEnd = todayDateEnd ? new Date(todayDateEnd.getTime() - clinicOffsetMs) : null
    const offlineQuery = { nguon: 'offline', trang_thai: { $in: OFFLINE_ELIGIBLE } }
    if (todayInstantStart && todayInstantEnd) offlineQuery.checkin_time = { $gte: todayInstantStart, $lt: todayInstantEnd }
    const baseApptQuery = {
      loai_kham: 'clinic',
      status: { $in: ONLINE_ELIGIBLE },
      hinh_thuc_dat_lich: { $ne: 'offline' },
    }
    if (todayDateStart && todayDateEnd) {
      baseApptQuery.ngay_kham = { $gte: todayDateStart, $lt: todayDateEnd }
    }
    const onlineAppointmentIds = await LichHen.find(baseApptQuery).distinct('_id')
    const onlineQuery = { status: 'da_xac_nhan', appointment_id: { $in: onlineAppointmentIds } }

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
        ? row.billing_summary.trang_thai_hoa_don === 'da_thanh_toan_du' && row.billing_summary.da_xac_nhan_thu_ngan
        : row.billing_summary.trang_thai_hoa_don !== 'da_thanh_toan_du' || !row.billing_summary.da_xac_nhan_thu_ngan
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
      const payment = await ThanhToan.create({
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

      // Giao dịch chuyển khoản chờ xác nhận: sinh sẵn URL thanh toán VNPAY sandbox đúng số tiền
      // `due` để lễ tân hiển thị QR cho khách quét — khách chuyển đúng số tiền, lễ tân vẫn tự
      // xác nhận thủ công sau khi đối chiếu (không tự động hoá xác nhận qua IPN/return).
      if (!paid) {
        const gateway = buildTransferGateway({ payment, invoice, now: new Date() })
        await ThanhToan.updateOne({ _id: payment._id }, { $set: { gateway_response: gateway } })
      }

      // Thanh toán tiền mặt được chốt NGAY lúc lập hóa đơn (không qua bước xác nhận riêng như
      // chuyển khoản), nên phải ghi nhật ký ở đây — nếu không, nguồn thu tiền mặt (phổ biến nhất
      // ở quầy) sẽ không có dấu vết ai thu. Chỉ ghi khi ĐÃ thu thật (paid); giao dịch chuyển
      // khoản `pending` chưa thu, không được ghi LT_XAC_NHAN_THANH_TOAN ở đây.
      if (paid) {
        await ghiNhatKyLeTan({
          hanhDong: 'LT_XAC_NHAN_THANH_TOAN',
          actorUserId: req.user.id,
          actorRole: req.user.role,
          loaiDoiTuong: 'payment',
          doiTuongId: payment._id,
          duLieuMoi: {
            ten_benh_nhan: caseItem.patient_name,
            so_tien: payment.so_tien,
            hinh_thuc: method,
            hoa_don_id: String(invoice._id),
            ma_hoa_don: invoice.so_hoa_don ?? null,
          },
        })
      }
    }
    const trangThaiHoaDon = await tinhTrangThaiHoaDon(invoice._id)
    if (trangThaiHoaDon.trang_thai_hoa_don === 'da_thanh_toan_du' && !await pendingPayment(invoice._id)) {
      await confirmCashierReview(invoice._id, req.user?._id ?? req.user?.id ?? null)
    }
    await hoanTatLuotKhamOnlineNeuDaThuDu(caseItem, trangThaiHoaDon)

    // Ghi nhật ký thao tác lễ tân (WS-4). Biến thực tế là `invoice` (không phải `hoaDon`), và
    // các field trên schema HoaDon là `so_hoa_don` / `chi_tiet_thu_phi` (không phải `ma_hoa_don` /
    // `chi_tiet` như bản mô tả gốc) — dùng đúng tên biến/field sẵn có.
    await ghiNhatKyLeTan({
      hanhDong: 'LT_LAP_HOA_DON',
      actorUserId: req.user.id,
      actorRole: req.user.role,
      loaiDoiTuong: 'invoice',
      doiTuongId: invoice._id,
      duLieuMoi: {
        ten_benh_nhan: caseItem.patient_name,
        ma_hoa_don: invoice.so_hoa_don ?? null,
        tong_tien: invoice.tong_thanh_toan ?? null,
        so_khoan: Array.isArray(invoice.chi_tiet_thu_phi) ? invoice.chi_tiet_thu_phi.length : 0,
      },
    })

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
    if (trangThaiHoaDon.trang_thai_hoa_don === 'da_thanh_toan_du') {
      await confirmCashierReview(invoice._id, req.user?._id ?? req.user?.id ?? null)
    }
    await hoanTatLuotKhamOnlineNeuDaThuDu(caseItem, trangThaiHoaDon)
    return ok(res, await serializeCase(caseItem), 'Đã xác nhận chuyển khoản')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}

export async function createTransferVnpaySession(req, res) {
  try {
    const source = sourceFrom(req)
    const { caseItem, invoice, payment } = await getPendingForCase(req.params.referenceId, source, req.params.paymentId)
    if (payment.phuong_thuc !== 'chuyen_khoan') throw loi(400, 'Chỉ tạo mã QR cho giao dịch chuyển khoản')

    const gateway = getGatewayResponseObject(payment)
    const canReuse = Boolean(gateway.qr_payload) && !isGatewaySessionExpired(gateway)
    if (!canReuse) {
      const fresh = buildTransferGateway({ payment, invoice, now: new Date() })
      await ThanhToan.updateOne({ _id: payment._id }, { $set: { gateway_response: fresh } })
    }

    return ok(res, await serializeCase(caseItem), 'Đã tạo mã QR chuyển khoản')
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
    const fee = await getFee(caseItem)
    const { serviceTotal } = invoiceLines(caseItem, fee)
    const currentTotal = fee + serviceTotal
    if (invoice && Number(invoice.tong_thanh_toan || 0) !== currentTotal) {
      throw loi(409, 'Dịch vụ phát sinh đã thay đổi; lễ tân cần đối chiếu và cập nhật lại hóa đơn trước khi in')
    }
    if (invoice && !invoice.da_xac_nhan_thu_ngan) throw loi(409, 'Hóa đơn chưa được lễ tân xác nhận thu ngân')
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
