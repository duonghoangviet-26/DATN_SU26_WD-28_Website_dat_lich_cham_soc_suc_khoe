import crypto from 'crypto'
import mongoose from 'mongoose'

import { ThanhToan, HoaDon, LichHen, LichLamViec, LichSuLichHen, NguoiDung, BacSi } from '../../models/index.js'
import { tinhTrangThaiHoaDon } from '../../services/hoaDon.service.js'
import { sendBookingSuccessEmail } from '../../services/mail.service.js'
import { ok, fail } from '../../utils/response.js'
import {
  emitAdminRealtime,
  emitDashboardAppointmentChanged,
  emitDashboardRevenueChanged,
} from '../../realtime/socket.js'

const VNPAY_SESSION_MINUTES = Number(process.env.VNPAY_SESSION_MINUTES || process.env.PAYMENT_HOLD_MINUTES || 15)
const DEFAULT_CLIENT_BASE_URL =
  process.env.VNPAY_RETURN_CLIENT_URL ||
  process.env.FRONTEND_URL ||
  process.env.CLIENT_URL ||
  'http://localhost:5173'

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function buildClientUrl(path, params = {}) {
  const url = new URL(path, DEFAULT_CLIENT_BASE_URL)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })
  return url.toString()
}

function buildPaymentResultUrl({ status, payment = null, appointment = null, reason = null }) {
  return buildClientUrl('/payment/vnpay-result', {
    payment_status: status,
    booked: status === 'success' ? 'true' : undefined,
    id: appointment?._id || payment?.appointment_id,
    appointment_id: appointment?._id || payment?.appointment_id,
    payment_id: payment?._id,
    reason,
  })
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
  return expiresAt.getTime() <= Date.now()
}

function buildMockVnpayUrl({
  payment,
  appointment,
  invoice,
  vnpTxnRef,
  expiresAt,
}) {
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
    vnp_CreateDate: formatVnpDate(new Date()),
    vnp_ExpireDate: formatVnpDate(expiresAt),
    vnp_ReturnUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/patient/payments/vnpay-return`,
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

async function loadOwnedPaymentBundle(paymentId, userId, session = null) {
  const paymentQuery = ThanhToan.findById(paymentId)
  if (session) paymentQuery.session(session)
  const payment = await paymentQuery

  if (!payment) {
    return { error: { status: 404, message: 'Khong tim thay giao dich' } }
  }

  if (String(payment.benh_nhan_id ?? '') !== String(userId)) {
    return { error: { status: 403, message: 'Ban khong co quyen truy cap giao dich nay' } }
  }

  const appointmentQuery = LichHen.findById(payment.appointment_id)
  if (session) appointmentQuery.session(session)
  const appointment = await appointmentQuery

  if (!appointment) {
    return { error: { status: 404, message: 'Khong tim thay lich hen lien quan' } }
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
  }
}

async function triggerBookingSuccessEmail(appointment, payment) {
  try {
    if (!appointment || !payment) return
    const user = await NguoiDung.findById(appointment.user_id).lean()
    if (!user || !user.email) return

    let docName = 'Bác sĩ chuyên khoa'
    let specialtyName = 'Đa khoa'

    let doctorId = appointment.doctor_id
    if (!doctorId && appointment.schedule_id) {
      const schedule = await LichLamViec.findById(appointment.schedule_id).lean()
      if (schedule && schedule.doctor_id) {
        doctorId = schedule.doctor_id
      }
    }

    if (doctorId) {
      const doc = await BacSi.findById(doctorId)
        .populate('user_id', 'ho_ten')
        .populate('specialties', 'ten')
        .lean()

      if (doc) {
        const rawName = doc.user_id?.ho_ten || doc.ho_ten
        if (rawName) {
          docName = /^BS\.?\s*/i.test(rawName) ? rawName : `BS. ${rawName}`
        }
        if (doc.specialties && doc.specialties.length > 0) {
          specialtyName = doc.specialties[0].ten || specialtyName
        }
      }
    }

    if (specialtyName === 'Đa khoa' && appointment.specialty_id) {
      try {
        const ChuyenKhoa = mongoose.model('ChuyenKhoa')
        const sk = await ChuyenKhoa.findById(appointment.specialty_id).lean()
        if (sk && sk.ten) specialtyName = sk.ten
      } catch (_) {}
    }

    const ngayKhamStr = appointment.ngay_kham
      ? new Date(appointment.ngay_kham).toLocaleDateString('vi-VN')
      : ''

    const bookingData = {
      ma_lich_hen: appointment.ma_lich_hen,
      ten_benh_nhan: appointment.ten_khach || user.ho_ten,
      so_dien_thoai: appointment.so_dien_thoai_khach || user.so_dien_thoai,
      ten_bac_si: docName,
      chuyen_khoa: specialtyName,
      ngay_kham: ngayKhamStr,
      gio_kham: appointment.gio_kham || '',
      phong_kham: appointment.phong_kham || 'Phòng khám ViteFamily',
      dia_chi: appointment.dia_chi_kham || 'Phòng 101, Tầng 1, Tòa nhà ViteFamily',
      tong_tien: payment.so_tien || appointment.gia_kham || 0,
      loai_kham: appointment.loai_kham,
    }

    await sendBookingSuccessEmail({ to: user.email, bookingData })
    console.log(`[EMAIL SENT SUCCESS] Sent booking confirmation email to ${user.email} (Appointment: ${appointment.ma_lich_hen})`)
  } catch (err) {
    console.error('[EMAIL ERROR] Failed to send booking confirmation email:', err.message)
  }
}

async function finalizePendingPayment({
  payment,
  appointment,
  actorUserId,
  actorRole,
  channel,
  reason,
  providerData,
  session,
}) {
  if (payment.status !== 'pending') {
    throw Object.assign(new Error('Chi co the xac nhan giao dich dang cho thanh toan'), { statusCode: 409 })
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

export async function getPaymentStatus(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID thanh toan khong hop le')
    }

    const bundle = await loadOwnedPaymentBundle(id, req.user.id)
    if (bundle.error) {
      return fail(res, bundle.error.status, bundle.error.message)
    }

    return ok(res, serializePaymentStatus(bundle), 'Lay trang thai thanh toan thanh cong')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function createMockVnpaySession(req, res) {
  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      return fail(res, 400, 'ID thanh toan khong hop le')
    }

    const bundle = await loadOwnedPaymentBundle(id, req.user.id)
    if (bundle.error) {
      return fail(res, bundle.error.status, bundle.error.message)
    }

    const { payment, appointment, invoice } = bundle
    if (payment.status !== 'pending') {
      return fail(res, 409, 'Giao dich nay khong con o trang thai cho thanh toan')
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
      const now = new Date()
      const expiresAt = new Date(now.getTime() + VNPAY_SESSION_MINUTES * 60 * 1000)
      const vnpTxnRef = `VNPAY-${payment.ma_giao_dich}-${Date.now().toString().slice(-6)}`
      const paymentUrl = buildMockVnpayUrl({
        payment,
        appointment,
        invoice,
        vnpTxnRef,
        expiresAt,
      })

      payment.gateway_response = {
        ...gateway,
        provider: 'vnpay',
        mode: 'mock',
        merchant_name: 'VitaFamily',
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
          {
            _id: appointment.schedule_id,
            'slots._id': appointment.slot_id,
            'slots.status': 'pending_payment',
          },
          {
            $set: {
              'slots.$.pending_expired_at': expiresAt,
            },
          }
        )
      }
    }

    return ok(res, serializePaymentStatus({ payment, appointment, invoice }), 'Tao session VNPAY mock thanh cong')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function completeMockVnpayPayment(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 400, 'ID thanh toan khong hop le')
    }

    const bundle = await loadOwnedPaymentBundle(id, req.user.id, session)
    if (bundle.error) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, bundle.error.status, bundle.error.message)
    }

    const { payment, appointment, invoice } = bundle
    const gateway = getGatewayResponseObject(payment)

    if (gateway.provider !== 'vnpay') {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 409, 'Giao dich nay chua co session VNPAY mock')
    }

    if (isGatewaySessionExpired(gateway)) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 409, 'Ma QR VNPAY da het han, vui long tao lai ma moi')
    }

    const previousAppointmentStatus = appointment.status
    await finalizePendingPayment({
      payment,
      appointment,
      actorUserId: req.user.id,
      actorRole: 'user',
      channel: 'patient_vnpay_mock_complete',
      reason: 'Benh nhan mo phong thanh toan thanh cong qua VNPAY QR',
      providerData: {
        provider: 'vnpay',
        mode: 'mock',
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
    triggerBookingSuccessEmail(appointment, payment)
    emitAdminRealtime('admin:payment_updated', {
      payment_id: payment._id,
      appointment_id: appointment._id,
      status: 'paid',
      source: 'patient_vnpay_mock_complete',
    })
    emitAdminRealtime('admin:appointment_updated', {
      appointment_id: appointment._id,
      status: 'confirmed',
      payment_status: 'paid',
      source: 'patient_vnpay_mock_complete',
    })
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

    return ok(res, serializePaymentStatus(bundle), 'Mo phong thanh toan VNPAY thanh cong')
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, err.statusCode || 500, err.message)
  }
}

export async function confirmPayment(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { id } = req.params
    if (!isValidObjectId(id)) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, 400, 'ID thanh toan khong hop le')
    }

    const bundle = await loadOwnedPaymentBundle(id, req.user.id, session)
    if (bundle.error) {
      await session.abortTransaction()
      session.endSession()
      return fail(res, bundle.error.status, bundle.error.message)
    }

    const { payment, appointment, invoice } = bundle

    const previousAppointmentStatus = appointment.status
    await finalizePendingPayment({
      payment,
      appointment,
      actorUserId: req.user.id,
      actorRole: 'user',
      channel: 'patient_payment_confirm',
      reason: 'Benh nhan xac nhan thanh toan fake gateway',
      providerData: {
        provider: 'fake_gateway',
        mode: 'legacy_manual_confirm',
        gateway_transaction_id: payment.gateway_transaction_id || `FAKE-${payment.ma_giao_dich}`,
        confirmed_by: 'patient',
      },
      session,
    })

    await session.commitTransaction()
    session.endSession()
    triggerBookingSuccessEmail(appointment, payment)
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

    return ok(res, serializePaymentStatus(bundle), 'Xac nhan thanh toan thanh cong')
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return fail(res, err.statusCode || 500, err.message)
  }
}

function sortObject(obj) {
  const sorted = {}
  const keys = Object.keys(obj).sort()
  keys.forEach((key) => {
    sorted[key] = obj[key]
  })
  return sorted
}

export async function vnpayIpn(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const vnp_Params = { ...req.query }
    const secureHash = vnp_Params['vnp_SecureHash']

    delete vnp_Params['vnp_SecureHash']
    delete vnp_Params['vnp_SecureHashType']

    const sortedParams = sortObject(vnp_Params)
    const signData = new URLSearchParams()
    Object.keys(sortedParams).forEach((key) => {
      signData.append(key, sortedParams[key])
    })

    const secretKey = process.env.VNP_HASHSECRET || 'MPCYVPEZAQLIXFLZLGWBKOIXOPTHNWVA'
    const hmac = crypto.createHmac('sha512', secretKey)
    const signed = hmac.update(Buffer.from(signData.toString(), 'utf-8')).digest('hex')

    if (secureHash !== signed) {
      await session.abortTransaction()
      session.endSession()
      return res.status(200).json({ RspCode: '97', Message: 'Checksum failed' })
    }

    const vnp_TxnRef = vnp_Params['vnp_TxnRef']
    const payment = await ThanhToan.findOne({ 'gateway_response.vnp_txn_ref': vnp_TxnRef }).session(session)

    if (!payment) {
      await session.abortTransaction()
      session.endSession()
      return res.status(200).json({ RspCode: '01', Message: 'Order not found' })
    }

    if (payment.status !== 'pending') {
      await session.abortTransaction()
      session.endSession()
      return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' })
    }

    const rspCode = vnp_Params['vnp_ResponseCode']
    if (rspCode === '00') {
      const appointment = await LichHen.findById(payment.appointment_id).session(session)
      let invoice = null
      if (payment.hoa_don_id) {
        invoice = await HoaDon.findById(payment.hoa_don_id).session(session)
      }

      await finalizePendingPayment({
        payment,
        appointment,
        actorUserId: payment.benh_nhan_id,
        actorRole: 'system',
        channel: 'vnpay_ipn',
        reason: 'VNPay xac nhan thanh toan thanh cong (IPN)',
        providerData: {
          provider: 'vnpay',
          bank_code: vnp_Params['vnp_BankCode'] || 'VNBANK',
          vnp_txn_ref: vnp_TxnRef,
          gateway_transaction_id: vnp_Params['vnp_TransactionNo'],
          confirmed_by: 'vnpay_ipn',
        },
        session,
      })

      await session.commitTransaction()
      session.endSession()
      triggerBookingSuccessEmail(appointment, payment)

      emitAdminRealtime('admin:payment_updated', {
        payment_id: payment._id,
        appointment_id: appointment._id,
        status: 'paid',
        source: 'vnpay_ipn',
      })
      emitAdminRealtime('admin:appointment_updated', {
        appointment_id: appointment._id,
        status: 'confirmed',
        payment_status: 'paid',
        source: 'vnpay_ipn',
      })
      emitDashboardRevenueChanged({
        ngay: payment.ngay_thanh_toan,
        so_tien: payment.so_tien,
        loai: 'thanh_toan',
      })
      emitDashboardAppointmentChanged('pending', 'confirmed')

      if (invoice?._id) {
        await tinhTrangThaiHoaDon(invoice._id)
      }

      return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' })
    } else {
      await session.abortTransaction()
      session.endSession()
      return res.status(200).json({ RspCode: '00', Message: 'Payment failed' })
    }
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return res.status(200).json({ RspCode: '99', Message: 'Unknown error' })
  }
}

export async function vnpayReturn(req, res) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const vnp_Params = { ...req.query }
    const secureHash = vnp_Params['vnp_SecureHash']

    delete vnp_Params['vnp_SecureHash']
    delete vnp_Params['vnp_SecureHashType']

    const sortedParams = sortObject(vnp_Params)
    const signData = new URLSearchParams()
    Object.keys(sortedParams).forEach((key) => {
      signData.append(key, sortedParams[key])
    })

    const secretKey = process.env.VNP_HASHSECRET || 'MPCYVPEZAQLIXFLZLGWBKOIXOPTHNWVA'
    const hmac = crypto.createHmac('sha512', secretKey)
    const signed = hmac.update(Buffer.from(signData.toString(), 'utf-8')).digest('hex')

    if (secureHash !== signed) {
      await session.abortTransaction()
      session.endSession()
      return res.redirect(buildPaymentResultUrl({ status: 'failed', reason: 'checksum' }))
    }

    const vnp_TxnRef = vnp_Params['vnp_TxnRef']
    const rspCode = vnp_Params['vnp_ResponseCode']
    const payment = await ThanhToan.findOne({ 'gateway_response.vnp_txn_ref': vnp_TxnRef }).session(session)

    if (!payment) {
      await session.abortTransaction()
      session.endSession()
      return res.redirect(buildPaymentResultUrl({ status: 'failed', reason: 'not_found' }))
    }

    if (rspCode !== '00') {
      await session.abortTransaction()
      session.endSession()
      return res.redirect(buildPaymentResultUrl({ status: 'failed', payment, reason: 'payment_failed' }))
    }

    if (payment.status === 'paid') {
      await session.abortTransaction()
      session.endSession()
      return res.redirect(buildPaymentResultUrl({ status: 'success', payment }))
    }

    if (payment.status === 'pending') {
      const appointment = await LichHen.findById(payment.appointment_id).session(session)
      let invoice = null
      if (payment.hoa_don_id) {
        invoice = await HoaDon.findById(payment.hoa_don_id).session(session)
      }

      await finalizePendingPayment({
        payment,
        appointment,
        actorUserId: payment.benh_nhan_id,
        actorRole: 'system',
        channel: 'vnpay_return',
        reason: 'VNPay xac nhan thanh toan thanh cong (Return URL)',
        providerData: {
          provider: 'vnpay',
          bank_code: vnp_Params['vnp_BankCode'] || 'VNBANK',
          vnp_txn_ref: vnp_TxnRef,
          gateway_transaction_id: vnp_Params['vnp_TransactionNo'],
          confirmed_by: 'vnpay_return',
        },
        session,
      })

      await session.commitTransaction()
      session.endSession()
      triggerBookingSuccessEmail(appointment, payment)

      emitAdminRealtime('admin:payment_updated', {
        payment_id: payment._id,
        appointment_id: appointment._id,
        status: 'paid',
        source: 'vnpay_return',
      })
      emitAdminRealtime('admin:appointment_updated', {
        appointment_id: appointment._id,
        status: 'confirmed',
        payment_status: 'paid',
        source: 'vnpay_return',
      })
      emitDashboardRevenueChanged({
        ngay: payment.ngay_thanh_toan,
        so_tien: payment.so_tien,
        loai: 'thanh_toan',
      })
      emitDashboardAppointmentChanged('pending', 'confirmed')

      if (invoice?._id) {
        await tinhTrangThaiHoaDon(invoice._id)
      }

      return res.redirect(buildPaymentResultUrl({ status: 'success', payment, appointment }))
    }

    await session.abortTransaction()
    session.endSession()
    return res.redirect(buildPaymentResultUrl({ status: 'failed', payment }))
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return res.redirect(buildPaymentResultUrl({ status: 'error', reason: 'server_error' }))
  }
}
