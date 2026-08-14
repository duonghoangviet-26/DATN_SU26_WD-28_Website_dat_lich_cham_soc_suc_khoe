import { HoaDon, LichHen, ThanhToan } from '../models/index.js'

const PREPAYMENT_TYPES = ['phi_dat_lich', 'dat_coc']
const TERMINAL_APPOINTMENT_STATUSES = ['cancelled', 'no_show', 'completed', 'skipped']

function asId(value) {
  return value?._id ?? value ?? null
}

function key(value) {
  const id = asId(value)
  return id == null ? null : String(id)
}

function isAppointmentLike(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && Object.prototype.hasOwnProperty.call(value, '_id')
  )
}

export function resolveAppointmentPaymentStatus({ appointment, invoice, payments }) {
  const currentStatus = appointment?.payment_status ?? 'unpaid'
  const linkedPayments = Array.isArray(payments) ? payments : []
  const prepaymentPayments = linkedPayments.filter((payment) => PREPAYMENT_TYPES.includes(payment.loai_thanh_toan))
  const hasLinkedFinancialRecord = Boolean(invoice) || linkedPayments.length > 0

  if (!hasLinkedFinancialRecord || prepaymentPayments.length === 0) {
    return currentStatus
  }

  const paidPayments = prepaymentPayments.filter((payment) => payment.status === 'paid')
  const refundedPayments = prepaymentPayments.filter((payment) => payment.status === 'refunded')
  const totalPaid = paidPayments.reduce((sum, payment) => sum + Number(payment.so_tien || 0), 0)
  const totalDue = Number(appointment?.gia_kham || 0)

  if (refundedPayments.length > 0 && paidPayments.length === 0) {
    return 'refunded'
  }

  if (invoice?.trang_thai_hoa_don === 'da_thanh_toan_du') {
    return 'paid'
  }

  if (invoice?.trang_thai_hoa_don === 'da_dat_coc') {
    return 'partial'
  }

  if (paidPayments.length > 0) {
    if (totalDue > 0 && totalPaid < totalDue) {
      return 'partial'
    }

    return 'paid'
  }

  if (refundedPayments.length > 0 || currentStatus === 'refunded') {
    return 'refunded'
  }

  if (invoice?.trang_thai_hoa_don === 'chua_thanh_toan') {
    return 'unpaid'
  }

  return currentStatus
}

async function loadPaymentStateMaps(appointmentIds, session = null) {
  const ids = appointmentIds.filter(Boolean)
  if (ids.length === 0) {
    return { invoiceByAppointmentId: new Map(), paymentsByAppointmentId: new Map() }
  }

  const invoiceQuery = HoaDon.find({ appointment_id: { $in: ids } })
    .select('_id appointment_id so_hoa_don trang_thai_hoa_don tong_thanh_toan')
  if (session) invoiceQuery.session(session)
  const invoices = await invoiceQuery.lean()

  const invoiceByAppointmentId = new Map(
    invoices.map((invoice) => [String(invoice.appointment_id), invoice]),
  )
  const invoiceById = new Map(invoices.map((invoice) => [String(invoice._id), invoice]))
  const invoiceIds = invoices.map((invoice) => invoice._id)

  const paymentOrConditions = [{ appointment_id: { $in: ids } }]
  if (invoiceIds.length > 0) {
    paymentOrConditions.push({ hoa_don_id: { $in: invoiceIds } })
  }

  const paymentQuery = ThanhToan.find({ $or: paymentOrConditions })
    .select('appointment_id hoa_don_id so_tien status loai_thanh_toan')
  if (session) paymentQuery.session(session)
  const payments = await paymentQuery.lean()

  const paymentsByAppointmentId = new Map()
  for (const payment of payments) {
    const appointmentId = payment.appointment_id ?? invoiceById.get(String(payment.hoa_don_id ?? ''))?.appointment_id ?? null
    if (!appointmentId) continue

    const mapKey = String(appointmentId)
    const existing = paymentsByAppointmentId.get(mapKey) ?? []
    existing.push(payment)
    paymentsByAppointmentId.set(mapKey, existing)
  }

  return { invoiceByAppointmentId, paymentsByAppointmentId }
}

function buildAppointmentPaymentUpdate(appointment, resolvedPaymentStatus, { confirmPaidClinic = true } = {}) {
  const update = {}

  if (resolvedPaymentStatus !== appointment.payment_status) {
    update.payment_status = resolvedPaymentStatus
    if (resolvedPaymentStatus === 'paid') {
      update.thoi_diem_thanh_toan = appointment.thoi_diem_thanh_toan ?? new Date()
    }
  }

  if (
    confirmPaidClinic
    && resolvedPaymentStatus === 'paid'
    && appointment.loai_kham === 'clinic'
    && appointment.status === 'pending'
  ) {
    update.status = 'confirmed'
    update.payment_deadline = null
  }

  return update
}

export async function enrichAppointmentsWithPaymentState(appointments, {
  persist = false,
  confirmPaidClinic = true,
  session = null,
} = {}) {
  if (!Array.isArray(appointments) || appointments.length === 0) {
    return []
  }

  const appointmentIds = appointments.map((appointment) => asId(appointment._id))
  const { invoiceByAppointmentId, paymentsByAppointmentId } = await loadPaymentStateMaps(appointmentIds, session)
  const updates = []

  const enriched = appointments.map((appointment) => {
    const appointmentId = key(appointment._id)
    const invoice = invoiceByAppointmentId.get(appointmentId) ?? appointment.invoice ?? null
    const payments = paymentsByAppointmentId.get(appointmentId) ?? []
    const paymentStatus = resolveAppointmentPaymentStatus({ appointment, invoice, payments })
    const update = buildAppointmentPaymentUpdate(appointment, paymentStatus, { confirmPaidClinic })

    if (Object.keys(update).length > 0) {
      updates.push({
        updateOne: {
          filter: { _id: appointment._id },
          update: { $set: update },
        },
      })
    }

    return {
      ...appointment,
      ...update,
      payment_status: paymentStatus,
      invoice,
    }
  })

  if (persist && updates.length > 0) {
    if (session) {
      await LichHen.bulkWrite(updates, { session })
    } else {
      await LichHen.bulkWrite(updates)
    }
  }

  return enriched
}

export async function resolveAndSyncAppointmentPaymentState(appointmentOrId, {
  persist = true,
  confirmPaidClinic = true,
  session = null,
} = {}) {
  const appointment = isAppointmentLike(appointmentOrId)
    ? appointmentOrId
    : await (() => {
        const query = LichHen.findById(appointmentOrId)
        if (session) query.session(session)
        return query
      })()

  if (!appointment) return null

  const [enriched] = await enrichAppointmentsWithPaymentState([appointment.toObject ? appointment.toObject() : appointment], {
    persist: false,
    confirmPaidClinic,
    session,
  })
  if (!enriched) return null

  const update = buildAppointmentPaymentUpdate(appointment, enriched.payment_status, { confirmPaidClinic })
  const canApplyStatusUpdate = !TERMINAL_APPOINTMENT_STATUSES.includes(appointment.status)
  if (!canApplyStatusUpdate) {
    delete update.status
    delete update.payment_deadline
  }

  if (persist && Object.keys(update).length > 0) {
    if (session) {
      await LichHen.updateOne({ _id: appointment._id }, { $set: update }, { session })
    } else {
      await LichHen.updateOne({ _id: appointment._id }, { $set: update })
    }
  }

  Object.assign(appointment, update)

  return {
    appointment,
    payment_status: enriched.payment_status,
    invoice: enriched.invoice,
    changed: Object.keys(update).length > 0,
  }
}

export default {
  enrichAppointmentsWithPaymentState,
  resolveAndSyncAppointmentPaymentState,
  resolveAppointmentPaymentStatus,
}
