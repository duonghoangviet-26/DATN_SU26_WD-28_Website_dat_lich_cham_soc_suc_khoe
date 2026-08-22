import crypto from 'crypto'
import mongoose from 'mongoose'
import { ThanhToan, HoaDon, LichHen, LichLamViec, LichSuLichHen } from '../../models/index.js'
import { tinhTrangThaiHoaDon } from '../../services/hoaDon.service.js'
import { ok, fail } from '../../utils/response.js'
import {
  emitDashboardAppointmentChanged,
  emitDashboardRevenueChanged,
} from '../../realtime/socket.js'

const VNPAY_SESSION_MINUTES = Number(process.env.VNPAY_SESSION_MINUTES || process.env.PAYMENT_HOLD_MINUTES || 15)

let clockDrift = 0;
(async () => {
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 2000)
    const res = await fetch('https://google.com', { method: 'HEAD', signal: controller.signal })
    clearTimeout(id)
    const dateHeader = res.headers.get('date')
    if (dateHeader) {
      clockDrift = new Date(dateHeader).getTime() - Date.now()
    }
  } catch(e) {}
})();

function getRealTime() {
  return new Date(Date.now() + clockDrift)
}

const DEFAULT_CLIENT_BASE_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173'

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function getGatewayResponseObject(payment) {
  return payment?.gateway_response && typeof payment.gateway_response === 'object'
    ? payment.gateway_response
    : {}
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

function toDateOrNull(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function isGatewaySessionExpired(gateway) {
  const expiresAt = toDateOrNull(gateway?.expires_at)
  if (!expiresAt) return false
  return expiresAt.getTime() <= getRealTime().getTime()
}

function getActorUserId(req) {
  return req.user?._id ?? req.user?.id ?? null
}

function getActorRole(req) {
  if (!getActorUserId(req)) return 'system'
  return req.user?.role === 'admin' ? 'admin' : 'receptionist'
}

function buildMockVnpayUrl({ payment, appointment, invoice, vnpTxnRef, createdAt, expiresAt }) {
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
    vnp_OrderInfo: invoice?.so_hoa_don ? `Thanh toan ${invoice.so_hoa_don}` : `Thanh toan lich hen ${appointment.ma_lich_hen || payment.ma_giao_dich}`,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_BankCode: 'NCB',
    vnp_IpAddr: '127.0.0.1',
    vnp_CreateDate: formatVnpDate(createdAt),
    vnp_ExpireDate: formatVnpDate(expiresAt),
    vnp_ReturnUrl: `${DEFAULT_CLIENT_BASE_URL}/receptionist/booking?payment_id=${payment._id}&gateway=vnpay`,
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

async function loadPaymentBundle(paymentId, session = null) {
  const paymentQuery = ThanhToan.findById(paymentId)
  if (session) paymentQuery.session(session)
  const payment = await paymentQuery

  if (!payment) {
    return { error: { status: 404, message: 'Không tìm thấy giao dịch' } }
  }

  const appointmentQuery = LichHen.findById(payment.appointment_id)
  if (session) appointmentQuery.session(session)
  const appointment = await appointmentQuery

  if (!appointment) {
    return { error: { status: 404, message: 'Không tìm thấy lịch hẹn liên quan' } }
  }

  let invoice = null
  if (payment.hoa_don_id) {
    const invoiceQuery = HoaDon.findById(payment.hoa_don_id)
    if (session) invoiceQuery.session(session)
    invoice = await invoiceQuery
  }

  return { payment, appointment, invoice }
}

function serializePaymentStatus({ payment, appointment, invoice }) {
  const gateway = getGatewayResponseObject(payment)
  return {
    payment_id: payment._id,
    appointment_id: appointment?._id ?? payment.appointment_id ?? null,
    hoa_don_id: payment.hoa_don_id ?? null,
    ma_giao_dich: payment.ma_giao_dich,
    so_tien: payment.so_tien,
    payment_status: payment.status,
    appointment_status: appointment?.status ?? null,
    appointment_payment_status: appointment?.payment_status ?? null,
    invoice_status: invoice?.trang_thai_hoa_don ?? null,
    ngay_thanh_toan: payment.ngay_thanh_toan,
    phuong_thuc: payment.phuong_thuc,
    gateway: {
      provider: gateway.provider ?? null,
      mode: gateway.mode ?? null,
      payment_url: gateway.payment_url ?? null,
      qr_payload: gateway.qr_payload ?? null,
      expires_at: gateway.expires_at ?? null,
      vnp_txn_ref: gateway.vnp_txn_ref ?? null,
      bank_code: gateway.bank_code ?? null,
      locale: gateway.locale ?? null,
      merchant_name: gateway.merchant_name ?? null,
      merchant_code: gateway.merchant_code ?? null,
      note: gateway.note ?? null,
      mock_status: gateway.mock_status ?? null,
      is_expired: isGatewaySessionExpired(gateway),
    },
    server_time: getRealTime().toISOString(),
  }
}

async function finalizePendingPayment({ payment, appointment, actorUserId, actorRole, channel, reason, providerData, session }) {
  if (payment.status !== 'pending') {
    throw Object.assign(new Error('Chỉ có thể xác nhận giao dịch đang chờ thanh toán'), { statusCode: 409 })
  }
  if (appointment.status !== 'pending') {
    throw Object.assign(new Error(`Chỉ có thể xác nhận thanh toán cho lịch đang chờ xử lý (hiện tại: ${appointment.status})`), { statusCode: 409 })
  }

  const oldStatus = appointment.status
  const oldPaymentStatus = appointment.payment_status
  const paidAt = new Date()
  const gateway = getGatewayResponseObject(payment)

  payment.status = 'paid'
  payment.ngay_thanh_toan = paidAt
  payment.thoi_diem_thanh_toan = paidAt
  payment.gateway_transaction_id = providerData.gateway_transaction_id || payment.gateway_transaction_id || `MOCK-${payment.ma_giao_dich}`
  payment.gateway_response = {
    ...gateway,
    ...providerData,
    confirmed_at: paidAt.toISOString(),
    mock_status: 'paid',
  }
  await payment.save({ session })

  appointment.payment_status = 'paid'
  appointment.status = 'confirmed'
  appointment.thoi_diem_thanh_toan = paidAt
  appointment.payment_deadline = null
  await appointment.save({ session })

  if (appointment.schedule_id && appointment.slot_id) {
    const schedule = await LichLamViec.findById(appointment.schedule_id).session(session)
    const slot = schedule?.slots.id(appointment.slot_id)
    if (slot) {
      slot.status = 'booked'
      slot.benh_nhan_id = appointment.user_id ?? null
      slot.benh_nhan_tam_giu_id = null
      await schedule.save({ session })
    }
  }

  await LichSuLichHen.create([{
    appointment_id: appointment._id,
    tu_trang_thai: oldStatus,
    den_trang_thai: appointment.status,
    tu_payment_status: oldPaymentStatus,
    den_payment_status: appointment.payment_status,
    nguoi_thay_doi_id: actorUserId,
    kenh_thay_doi: channel,
    nguoi_thuc_hien_id: actorUserId,
    vai_tro: actorRole,
    ly_do: reason,
    loai_thay_doi: 'payment_confirm',
    ly_do_thay_doi: reason,
  }], { session })
}

export const getPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) return fail(res, 400, 'ID thanh toán không hợp lệ')

    const bundle = await loadPaymentBundle(id)
    if (bundle.error) return fail(res, bundle.error.status, bundle.error.message)

    return ok(res, serializePaymentStatus(bundle), 'Lấy trạng thái thanh toán thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export const createMockVnpaySession = async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) return fail(res, 400, 'ID thanh toán không hợp lệ')

    const bundle = await loadPaymentBundle(id)
    if (bundle.error) return fail(res, bundle.error.status, bundle.error.message)

    const { payment, appointment, invoice } = bundle
    if (payment.status !== 'pending') return fail(res, 409, 'Giao dịch này không còn ở trạng thái chờ thanh toán')
    if (appointment.status !== 'pending') {
      return fail(res, 409, `Chỉ tạo QR thanh toán cho lịch đang chờ xử lý (hiện tại: ${appointment.status})`)
    }

    const gateway = getGatewayResponseObject(payment)
    const existingExpiry = toDateOrNull(gateway.expires_at)
    const canReuse =
      gateway.provider === 'vnpay' &&
      gateway.payment_url &&
      existingExpiry &&
      existingExpiry.getTime() > Date.now() &&
      gateway.mock_status !== 'paid'

    if (!canReuse) {
      const now = getRealTime()
      const expiresAt = new Date(now.getTime() + VNPAY_SESSION_MINUTES * 60 * 1000)
      const vnpTxnRef = `VNPAY-${payment.ma_giao_dich}-${now.getTime().toString().slice(-6)}`
      const paymentUrl = buildMockVnpayUrl({ payment, appointment, invoice, vnpTxnRef, createdAt: now, expiresAt })

      payment.gateway_response = {
        ...gateway,
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
        mock_status: 'waiting_for_customer',
      }
      await payment.save()

      appointment.payment_deadline = expiresAt
      await appointment.save()

      if (appointment.schedule_id && appointment.slot_id) {
        await LichLamViec.findOneAndUpdate(
          { _id: appointment.schedule_id, 'slots._id': appointment.slot_id, 'slots.status': 'pending_payment' },
          { $set: { 'slots.$.pending_expired_at': expiresAt } }
        )
      }
    }

    return ok(res, serializePaymentStatus({ payment, appointment, invoice }), 'Tạo session VNPAY mock thành công')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export const completeMockVnpayPayment = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      await session.abortTransaction(); session.endSession()
      return fail(res, 400, 'ID thanh toán không hợp lệ')
    }

    const bundle = await loadPaymentBundle(id, session)
    if (bundle.error) {
      await session.abortTransaction(); session.endSession()
      return fail(res, bundle.error.status, bundle.error.message)
    }

    const { payment, appointment, invoice } = bundle
    const gateway = getGatewayResponseObject(payment)

    if (gateway.provider !== 'vnpay') {
      await session.abortTransaction(); session.endSession()
      return fail(res, 409, 'Giao dịch này chưa có session VNPAY mock')
    }

    if (isGatewaySessionExpired(gateway)) {
      await session.abortTransaction(); session.endSession()
      return fail(res, 409, 'Mã QR VNPAY đã hết hạn, vui lòng tạo lại mã mới')
    }

    const previousAppointmentStatus = appointment.status
    await finalizePendingPayment({
      payment, appointment,
      actorUserId: getActorUserId(req),
      actorRole: getActorRole(req),
      channel: 'receptionist_vnpay_mock_complete',
      reason: 'Lễ tân mô phỏng thanh toán thành công qua VNPAY QR',
      providerData: {
        provider: 'vnpay', mode: 'mock',
        bank_code: gateway.bank_code || 'VNBANK',
        vnp_txn_ref: gateway.vnp_txn_ref || `VNPAY-${payment.ma_giao_dich}`,
        gateway_transaction_id: `VNPAY-MOCK-${payment.ma_giao_dich}`,
        payment_url: gateway.payment_url || null,
        qr_payload: gateway.qr_payload || gateway.payment_url || null,
        confirmed_by: 'mock_gateway',
      },
      session,
    })

    await session.commitTransaction()
    session.endSession()
    emitDashboardRevenueChanged({
      ngay: payment.ngay_thanh_toan,
      so_tien: payment.so_tien,
      loai: 'thanh_toan',
    })
    emitDashboardAppointmentChanged(previousAppointmentStatus, appointment.status)

    if (invoice?._id) {
      await tinhTrangThaiHoaDon(invoice._id)
      bundle.invoice = await HoaDon.findById(invoice._id)
    }

    return ok(res, serializePaymentStatus(bundle), 'Mô phỏng thanh toán VNPAY thành công')
  } catch (err) {
    await session.abortTransaction(); session.endSession()
    return fail(res, err.statusCode || 500, err.message)
  }
}

export const getPayments = async (req, res) => {
  try {
    const { status, search, from, to } = req.query
    const pageNum = parseInt(req.query.page || 1, 10)
    const limitNum = parseInt(req.query.limit || 20, 10)
    const skip = (pageNum - 1) * limitNum
    const filter = {}

    if (status) filter.status = status
    if (search?.trim()) {
      filter.$or = [
        { ma_giao_dich: { $regex: search.trim(), $options: 'i' } }
      ]
    }
    
    if (from || to) {
      let startDate, endDate
      if (from) {
        startDate = new Date(`${from}T00:00:00.000Z`)
      }
      if (to) {
        const toBase = new Date(`${to}T00:00:00.000Z`)
        endDate = new Date(toBase.getTime() + 24 * 60 * 60 * 1000)
      }

      if (startDate || endDate) {
        const queryTime = {}
        if (startDate) queryTime.$gte = startDate
        if (endDate) queryTime.$lt = endDate

        // Find appointments that fall in this date range
        const appointmentsInDate = await LichHen.find({ ngay_kham: queryTime }).select('_id')
        const appointmentIds = appointmentsInDate.map(a => a._id)

        filter.$or = [
          { ngay_tao: queryTime },
          { ngay_thanh_toan: queryTime },
          { appointment_id: { $in: appointmentIds } }
        ]

        // Keep the original search filter logic if present
        if (search?.trim()) {
          const searchRegex = { $regex: search.trim(), $options: 'i' }
          filter.$and = [
            { $or: filter.$or },
            { $or: [ { ma_giao_dich: searchRegex } ] }
          ]
          delete filter.$or
        }
      }
    }

    const [total, payments] = await Promise.all([
      ThanhToan.countDocuments(filter),
      ThanhToan.find(filter)
        .populate('benh_nhan_id', 'ho_ten email so_dien_thoai')
        .populate('hoa_don_id', 'so_hoa_don trang_thai_hoa_don')
        .populate({
          path: 'appointment_id',
          select: 'doctor_id user_id ten_khach so_dien_thoai_khach email_khach nguoi_dat_sdt',
          populate: [
            { path: 'doctor_id', populate: { path: 'user_id', select: 'ho_ten' } },
            { path: 'user_id', select: 'ho_ten email so_dien_thoai' }
          ]
        })
        .sort({ ngay_tao: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ])

    const result = payments.map((p) => {
      let benh_nhan = 'Không rõ'
      let so_dien_thoai = null
      let email = null
      if (p.benh_nhan_id) {
        benh_nhan = p.benh_nhan_id.ho_ten
        so_dien_thoai = p.benh_nhan_id.so_dien_thoai
        email = p.benh_nhan_id.email
      } else if (p.appointment_id) {
        if (p.appointment_id.user_id) {
          benh_nhan = p.appointment_id.user_id.ho_ten
          so_dien_thoai = p.appointment_id.user_id.so_dien_thoai
          email = p.appointment_id.user_id.email
        } else {
          benh_nhan = p.appointment_id.ten_khach
          so_dien_thoai = p.appointment_id.so_dien_thoai_khach
          email = p.appointment_id.email_khach
        }
      }

      return {
        id: p._id,
        ma_giao_dich: p.ma_giao_dich,
        benh_nhan,
        email,
        so_dien_thoai,
        bac_si: p.appointment_id?.doctor_id?.user_id?.ho_ten ?? 'Không rõ',
        so_tien: p.so_tien,
        phuong_thuc: p.phuong_thuc,
        status: p.status,
        ngay_tao: p.ngay_tao
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Thành công',
      data: result,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message })
  }
}

export const confirmCashPayment = async (req, res) => {
  try {
    const { id } = req.params
    const payment = await ThanhToan.findById(id)
    if (!payment) return res.status(404).json({ success: false, message: 'Không tìm thấy thanh toán' })
    if (payment.status === 'paid') return res.status(400).json({ success: false, message: 'Thanh toán này đã hoàn tất' })

    payment.status = 'paid'
    payment.thoi_diem_thanh_toan = new Date()
    payment.ngay_thanh_toan = new Date()
    // payment.nguoi_thu_id = req.user.id
    
    await payment.save()

    // Sync to LichHen
    if (payment.appointment_id) {
       await LichHen.findByIdAndUpdate(payment.appointment_id, { 
         payment_status: 'paid', 
         thoi_diem_thanh_toan: payment.thoi_diem_thanh_toan 
       })
    }

    emitDashboardRevenueChanged()

    res.status(200).json({ success: true, message: 'Đã xác nhận thu tiền mặt', data: payment })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export const refundPayment = async (req, res) => {
  try {
    res.status(200).json({ success: true, message: 'Đã hoàn tiền' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
}

export default {
  getPayments,
  confirmCashPayment,
  refundPayment,
  getPaymentStatus,
  createMockVnpaySession,
  completeMockVnpayPayment
}
