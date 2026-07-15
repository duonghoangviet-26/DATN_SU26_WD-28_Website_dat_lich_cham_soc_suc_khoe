import mongoose from 'mongoose'

import {
  HoaDon,
  LichHen,
  LichLamViec,
  LichSuLichHen,
  ThanhToan,
} from '../models/index.js'

function getGatewayResponseObject(payment) {
  return payment?.gateway_response && typeof payment.gateway_response === 'object'
    ? payment.gateway_response
    : {}
}

async function loadPayment(paymentOrId, session = null) {
  if (!paymentOrId) return null
  if (paymentOrId instanceof ThanhToan) return paymentOrId

  const query = ThanhToan.findById(paymentOrId)
  if (session) query.session(session)
  return query
}

async function loadAppointment(appointmentOrId, session = null) {
  if (!appointmentOrId) return null
  if (appointmentOrId instanceof LichHen) return appointmentOrId

  const query = LichHen.findById(appointmentOrId)
  if (session) query.session(session)
  return query
}

async function findInvoiceAndPaymentsForAppointment(appointmentId, session = null) {
  const invoiceQuery = HoaDon.findOne({ appointment_id: appointmentId })
  if (session) invoiceQuery.session(session)
  const invoice = await invoiceQuery

  const paymentFilter = [{ appointment_id: appointmentId }]
  if (invoice?._id) {
    paymentFilter.push({ hoa_don_id: invoice._id })
  }

  const paymentsQuery = ThanhToan.find({ $or: paymentFilter })
  if (session) paymentsQuery.session(session)
  const payments = await paymentsQuery

  return { invoice, payments }
}

async function syncInvoiceStatus(invoiceId, session = null) {
  if (!invoiceId) return null

  const invoiceQuery = HoaDon.findById(invoiceId)
  if (session) invoiceQuery.session(session)
  const invoice = await invoiceQuery
  if (!invoice) return null

  const paymentsQuery = ThanhToan.find({ hoa_don_id: invoice._id, status: 'paid' })
    .select('so_tien')
  if (session) paymentsQuery.session(session)
  const paidPayments = await paymentsQuery.lean()

  const totalPaid = paidPayments.reduce((sum, payment) => sum + Number(payment.so_tien || 0), 0)
  const totalDue = Number(invoice.tong_thanh_toan || 0)
  let nextStatus = 'chua_thanh_toan'

  if (totalPaid > 0 && totalPaid < totalDue) {
    nextStatus = 'da_dat_coc'
  } else if (totalPaid > 0 && totalPaid >= totalDue) {
    nextStatus = 'da_thanh_toan_du'
  }

  if (invoice.trang_thai_hoa_don !== nextStatus) {
    invoice.trang_thai_hoa_don = nextStatus
    await invoice.save({ session })
  }

  return {
    invoice,
    tongDaThu: totalPaid,
    tongCanThu: totalDue,
    trang_thai_hoa_don: invoice.trang_thai_hoa_don,
  }
}

export async function releaseAppointmentSlot({ appointment, session = null }) {
  if (!appointment?.schedule_id || !appointment?.slot_id) return null

  const scheduleQuery = LichLamViec.findById(appointment.schedule_id)
  if (session) scheduleQuery.session(session)
  const schedule = await scheduleQuery
  const slot = schedule?.slots.id(appointment.slot_id)
  if (!slot) return null

  slot.status = 'active'
  slot.benh_nhan_id = null
  slot.benh_nhan_tam_giu_id = null
  slot.pending_expired_at = null
  await schedule.save({ session })

  return slot
}

export async function markAppointmentSlotBooked({ appointment, session = null }) {
  if (!appointment?.schedule_id || !appointment?.slot_id) return null

  const scheduleQuery = LichLamViec.findById(appointment.schedule_id)
  if (session) scheduleQuery.session(session)
  const schedule = await scheduleQuery
  const slot = schedule?.slots.id(appointment.slot_id)
  if (!slot) return null

  slot.status = 'booked'
  slot.benh_nhan_id = appointment.user_id ?? null
  slot.benh_nhan_tam_giu_id = null
  slot.pending_expired_at = null
  await schedule.save({ session })

  return slot
}

async function createAppointmentHistory({
  appointment,
  oldStatus,
  oldPaymentStatus,
  actorUserId,
  actorRole,
  channel,
  reason,
  changeType,
  session = null,
}) {
  if (!actorUserId) return null

  const [history] = await LichSuLichHen.create([{
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
    loai_thay_doi: changeType,
    ly_do_thay_doi: reason,
  }], { session })

  return history
}

export async function finalizePendingPayment({
  payment: paymentInput,
  paymentId,
  appointment: appointmentInput,
  actorUserId,
  actorRole = 'user',
  channel = 'payment_confirm',
  reason = 'Xac nhan thanh toan',
  providerData = {},
  session = null,
}) {
  const payment = await loadPayment(paymentInput ?? paymentId, session)
  if (!payment) {
    throw new Error('Khong tim thay giao dich')
  }
  if (payment.status !== 'pending') {
    throw Object.assign(new Error('Chi co the xac nhan giao dich dang cho thanh toan'), { statusCode: 409 })
  }

  const appointment = await loadAppointment(appointmentInput ?? payment.appointment_id, session)
  if (!appointment) {
    throw new Error('Khong tim thay lich hen lien quan')
  }

  const oldStatus = appointment.status
  const oldPaymentStatus = appointment.payment_status
  const paidAt = new Date()
  const gateway = getGatewayResponseObject(payment)

  payment.status = 'paid'
  payment.ngay_thanh_toan = paidAt
  payment.thoi_diem_thanh_toan = paidAt
  payment.gateway_transaction_id =
    providerData.gateway_transaction_id ||
    payment.gateway_transaction_id ||
    `MOCK-${payment.ma_giao_dich}`
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

  await markAppointmentSlotBooked({ appointment, session })

  const invoiceState = await syncInvoiceStatus(payment.hoa_don_id, session)

  await createAppointmentHistory({
    appointment,
    oldStatus,
    oldPaymentStatus,
    actorUserId,
    actorRole,
    channel,
    reason,
    changeType: 'payment_confirm',
    session,
  })

  return { payment, appointment, invoiceState }
}

export async function expirePendingBookingPayment({
  appointment: appointmentInput,
  appointmentId,
  actorUserId = null,
  actorRole = 'system',
  channel = 'system_auto_expire',
  reason = 'Qua han thanh toan',
  session = null,
}) {
  const appointment = await loadAppointment(appointmentInput ?? appointmentId, session)
  if (!appointment) {
    throw new Error('Khong tim thay lich hen')
  }
  if (appointment.payment_status === 'paid') {
    throw Object.assign(new Error('Khong the het han lich da thanh toan'), { statusCode: 409 })
  }

  const oldStatus = appointment.status
  const oldPaymentStatus = appointment.payment_status
  const { invoice, payments } = await findInvoiceAndPaymentsForAppointment(appointment._id, session)

  for (const payment of payments) {
    if (payment.status === 'pending') {
      payment.status = 'failed'
      await payment.save({ session })
    }
  }

  appointment.status = 'cancelled'
  appointment.payment_status = 'unpaid'
  appointment.ly_do_huy = reason
  appointment.huy_boi = actorRole === 'system' ? 'system' : actorRole
  appointment.nguoi_huy_id = actorUserId
  appointment.thoi_diem_huy = new Date()
  appointment.expired_at = appointment.thoi_diem_huy
  appointment.payment_deadline = null
  await appointment.save({ session })

  await releaseAppointmentSlot({ appointment, session })

  const invoiceState = await syncInvoiceStatus(invoice?._id, session)

  await createAppointmentHistory({
    appointment,
    oldStatus,
    oldPaymentStatus,
    actorUserId,
    actorRole,
    channel,
    reason,
    changeType: 'payment_expired',
    session,
  })

  return { appointment, payments, invoiceState }
}

export async function cancelAppointmentWithPaymentSync({
  appointment: appointmentInput,
  appointmentId,
  actorUserId = null,
  actorRole = 'user',
  channel = 'patient_cancel',
  reason = 'Huy lich hen',
  session = null,
}) {
  const appointment = await loadAppointment(appointmentInput ?? appointmentId, session)
  if (!appointment) {
    throw new Error('Khong tim thay lich hen')
  }
  if (['completed', 'cancelled'].includes(appointment.status)) {
    throw Object.assign(new Error('Lich hen khong the huy o trang thai hien tai'), { statusCode: 409 })
  }

  const oldStatus = appointment.status
  const oldPaymentStatus = appointment.payment_status
  const { invoice, payments } = await findInvoiceAndPaymentsForAppointment(appointment._id, session)
  const paidPayments = payments.filter((payment) => payment.status === 'paid')

  for (const payment of payments) {
    if (payment.status === 'pending') {
      payment.status = 'failed'
      await payment.save({ session })
    } else if (payment.status === 'paid') {
      payment.status = 'refunded'
      payment.ngay_hoan_tien = new Date()
      await payment.save({ session })
    }
  }

  appointment.status = 'cancelled'
  appointment.payment_status = paidPayments.length > 0 ? 'refunded' : 'unpaid'
  appointment.ly_do_huy = reason
  appointment.huy_boi = actorRole
  appointment.nguoi_huy_id = actorUserId
  appointment.thoi_diem_huy = new Date()
  appointment.payment_deadline = null
  await appointment.save({ session })

  await releaseAppointmentSlot({ appointment, session })

  const invoiceState = await syncInvoiceStatus(invoice?._id, session)

  await createAppointmentHistory({
    appointment,
    oldStatus,
    oldPaymentStatus,
    actorUserId,
    actorRole,
    channel,
    reason,
    changeType: 'appointment_cancel',
    session,
  })

  return { appointment, payments, invoiceState }
}

export async function withOptionalTransaction(callback, existingSession = null) {
  if (existingSession) {
    return callback(existingSession)
  }

  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const result = await callback(session)
    await session.commitTransaction()
    return result
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }
}

export default {
  cancelAppointmentWithPaymentSync,
  expirePendingBookingPayment,
  finalizePendingPayment,
  markAppointmentSlotBooked,
  releaseAppointmentSlot,
  withOptionalTransaction,
}
