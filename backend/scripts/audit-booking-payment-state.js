import dotenv from 'dotenv'
import mongoose from 'mongoose'

import {
  HoaDon,
  LichHen,
  LichLamViec,
  ThanhToan,
} from '../src/models/index.js'

dotenv.config()

function toIso(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

async function collectAudit() {
  const now = new Date()

  const expiredPendingAppointments = await LichHen.find({
    status: 'pending',
    payment_status: 'unpaid',
    payment_deadline: { $lt: now },
  })
    .select('ma_lich_hen ngay_kham gio_kham payment_deadline schedule_id slot_id')
    .lean()

  const pendingWithoutDeadline = await LichHen.find({
    status: 'pending',
    payment_status: 'unpaid',
    $or: [{ payment_deadline: null }, { payment_deadline: { $exists: false } }],
  })
    .select('ma_lich_hen ngay_kham gio_kham payment_deadline schedule_id slot_id')
    .lean()

  const pendingPayments = await ThanhToan.find({ status: 'pending' })
    .select('ma_giao_dich appointment_id hoa_don_id so_tien ngay_tao ngay_thanh_toan thoi_diem_thanh_toan gateway_response')
    .lean()

  const pendingPaymentSlots = await LichLamViec.aggregate([
    { $unwind: '$slots' },
    { $match: { 'slots.status': 'pending_payment' } },
    {
      $project: {
        schedule_id: '$_id',
        doctor_id: 1,
        ngay: 1,
        slot_id: '$slots._id',
        gio_bat_dau: '$slots.gio_bat_dau',
        benh_nhan_id: '$slots.benh_nhan_id',
        pending_expired_at: '$slots.pending_expired_at',
        expired: {
          $cond: [
            { $and: ['$slots.pending_expired_at', { $lt: ['$slots.pending_expired_at', now] }] },
            true,
            false,
          ],
        },
        missing_deadline: {
          $cond: [{ $not: ['$slots.pending_expired_at'] }, true, false],
        },
      },
    },
  ])

  const paidInvoiceButUnpaidAppointment = await LichHen.aggregate([
    {
      $lookup: {
        from: 'hoa_don',
        localField: '_id',
        foreignField: 'appointment_id',
        as: 'invoice',
      },
    },
    { $unwind: '$invoice' },
    {
      $match: {
        payment_status: { $ne: 'paid' },
        'invoice.trang_thai_hoa_don': 'da_thanh_toan_du',
      },
    },
    {
      $project: {
        ma_lich_hen: 1,
        status: 1,
        payment_status: 1,
        ngay_kham: 1,
        gio_kham: 1,
        so_hoa_don: '$invoice.so_hoa_don',
        invoice_status: '$invoice.trang_thai_hoa_don',
      },
    },
  ])

  const invoicesWithoutPayment = await HoaDon.aggregate([
    {
      $lookup: {
        from: 'thanh_toan',
        localField: '_id',
        foreignField: 'hoa_don_id',
        as: 'payments',
      },
    },
    {
      $match: {
        trang_thai_hoa_don: { $in: ['da_dat_coc', 'da_thanh_toan_du'] },
        payments: { $size: 0 },
      },
    },
    {
      $project: {
        so_hoa_don: 1,
        appointment_id: 1,
        tong_thanh_toan: 1,
        trang_thai_hoa_don: 1,
      },
    },
  ])

  return {
    generated_at: now.toISOString(),
    dry_run: true,
    summary: {
      expired_pending_appointments: expiredPendingAppointments.length,
      pending_without_deadline: pendingWithoutDeadline.length,
      pending_payments: pendingPayments.length,
      pending_payment_slots: pendingPaymentSlots.length,
      pending_payment_slots_expired: pendingPaymentSlots.filter((slot) => slot.expired).length,
      pending_payment_slots_missing_deadline: pendingPaymentSlots.filter((slot) => slot.missing_deadline).length,
      paid_invoice_but_unpaid_appointment: paidInvoiceButUnpaidAppointment.length,
      paid_invoices_without_payment: invoicesWithoutPayment.length,
    },
    expired_pending_appointments: expiredPendingAppointments.map((item) => ({
      ...item,
      ngay_kham: toIso(item.ngay_kham),
      payment_deadline: toIso(item.payment_deadline),
    })),
    pending_without_deadline: pendingWithoutDeadline.map((item) => ({
      ...item,
      ngay_kham: toIso(item.ngay_kham),
      payment_deadline: toIso(item.payment_deadline),
    })),
    pending_payments: pendingPayments.map((item) => ({
      ...item,
      ngay_tao: toIso(item.ngay_tao),
      ngay_thanh_toan: toIso(item.ngay_thanh_toan),
      thoi_diem_thanh_toan: toIso(item.thoi_diem_thanh_toan),
      gateway_expires_at: toIso(item.gateway_response?.expires_at),
    })),
    pending_payment_slots: pendingPaymentSlots.map((item) => ({
      ...item,
      ngay: toIso(item.ngay),
      pending_expired_at: toIso(item.pending_expired_at),
    })),
    paid_invoice_but_unpaid_appointment: paidInvoiceButUnpaidAppointment.map((item) => ({
      ...item,
      ngay_kham: toIso(item.ngay_kham),
    })),
    paid_invoices_without_payment: invoicesWithoutPayment,
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI')
  }

  await mongoose.connect(process.env.MONGODB_URI)
  try {
    const audit = await collectAudit()
    console.log(JSON.stringify(audit, null, 2))
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
