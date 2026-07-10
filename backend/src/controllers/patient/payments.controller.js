import mongoose from 'mongoose'

import { ThanhToan, HoaDon, LichHen, LichLamViec, LichSuLichHen } from '../../models/index.js'
import { tinhTrangThaiHoaDon } from '../../services/hoaDon.service.js'
import { ok, fail } from '../../utils/response.js'

const VNPAY_SESSION_MINUTES = 15
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
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}${hours}${minutes}${seconds}`
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
  const params = new URLSearchParams({
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: 'VITAFAMILY',
    vnp_Amount: String(Math.round((payment.so_tien || 0) * 100)),
    vnp_CurrCode: 'VND',
    vnp_TxnRef: vnpTxnRef,
    vnp_OrderInfo: `Thanh toan lich hen ${appointment.ma_lich_hen || payment.ma_giao_dich}`,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_BankCode: 'VNBANK',
    vnp_IpAddr: '127.0.0.1',
    vnp_CreateDate: formatVnpDate(new Date()),
    vnp_ExpireDate: formatVnpDate(expiresAt),
    vnp_ReturnUrl: `${DEFAULT_CLIENT_BASE_URL}/booking?payment_id=${payment._id}&gateway=vnpay`,
  })

  if (invoice?.so_hoa_don) {
    params.set('vnp_OrderInfo', `Thanh toan ${invoice.so_hoa_don}`)
  }

  return `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?${params.toString()}`
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
