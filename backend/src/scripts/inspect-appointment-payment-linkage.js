import 'dotenv/config'
import mongoose from 'mongoose'

import { HoaDon, LichHen, ThanhToan, HangDoi } from '../models/index.js'
import {
  enrichAppointmentsWithPaymentState,
  resolveAppointmentPaymentStatus,
} from '../services/appointmentPaymentStatus.service.js'

const appointmentCode = process.argv.find((arg) => arg.startsWith('--code='))?.slice('--code='.length)
const phone = process.argv.find((arg) => arg.startsWith('--phone='))?.slice('--phone='.length)
const name = process.argv.find((arg) => arg.startsWith('--name='))?.slice('--name='.length)

function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits.startsWith('84') ? `0${digits.slice(2)}` : digits
}

function formatDate(value) {
  return value ? new Date(value).toISOString() : 'null'
}

function line(title) {
  console.log(`\n=== ${title} ===`)
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI in backend/.env')
  }
  if (!appointmentCode && !phone && !name) {
    throw new Error('Provide --code=LH-... or --phone=... or --name=...')
  }

  await mongoose.connect(process.env.MONGODB_URI)
  console.log(`DATABASE ${mongoose.connection.db.databaseName}`)

  const query = {}
  const or = []
  if (appointmentCode) or.push({ ma_lich_hen: appointmentCode })
  if (phone) {
    const normalized = normalizePhone(phone)
    or.push({ so_dien_thoai_khach: normalized })
    or.push({ nguoi_dat_sdt: normalized })
  }
  if (name) {
    or.push({ ten_khach: { $regex: name, $options: 'i' } })
    or.push({ nguoi_dat_ho_ten: { $regex: name, $options: 'i' } })
  }
  query.$or = or

  const appointments = await LichHen.find(query)
    .select('_id ma_lich_hen ngay_kham gio_kham status payment_status gia_kham ten_khach so_dien_thoai_khach user_id member_id ho_so_benh_nhan_id doctor_id schedule_id slot_id phong_kham thoi_diem_thanh_toan ngay_tao ngay_cap_nhat')
    .sort({ ngay_kham: 1, gio_kham: 1, ngay_tao: 1 })
    .lean()

  if (appointments.length === 0) {
    console.log('No appointments matched.')
    return
  }

  const enriched = await enrichAppointmentsWithPaymentState(appointments, { persist: false })
  const appointmentIds = appointments.map((appointment) => appointment._id)
  const invoices = await HoaDon.find({ appointment_id: { $in: appointmentIds } }).lean()
  const invoiceIds = invoices.map((invoice) => invoice._id)
  const payments = await ThanhToan.find({
    $or: [
      { appointment_id: { $in: appointmentIds } },
      ...(invoiceIds.length ? [{ hoa_don_id: { $in: invoiceIds } }] : []),
    ],
  }).lean()
  const queues = await HangDoi.find({ appointment_id: { $in: appointmentIds } }).lean()

  const invoicesByAppointment = new Map()
  for (const invoice of invoices) {
    invoicesByAppointment.set(String(invoice.appointment_id), invoice)
  }
  const invoiceById = new Map(invoices.map((invoice) => [String(invoice._id), invoice]))
  const paymentsByAppointment = new Map()
  for (const payment of payments) {
    const appointmentId = payment.appointment_id ?? invoiceById.get(String(payment.hoa_don_id ?? ''))?.appointment_id
    if (!appointmentId) continue
    const mapKey = String(appointmentId)
    paymentsByAppointment.set(mapKey, [...(paymentsByAppointment.get(mapKey) ?? []), payment])
  }
  const queuesByAppointment = new Map(queues.map((queue) => [String(queue.appointment_id), queue]))

  line('APPOINTMENTS')
  for (const appointment of enriched) {
    const mapKey = String(appointment._id)
    const invoice = invoicesByAppointment.get(mapKey)
    const linkedPayments = paymentsByAppointment.get(mapKey) ?? []
    const resolvedPayment = resolveAppointmentPaymentStatus({ appointment, invoice, payments: linkedPayments })
    const queue = queuesByAppointment.get(mapKey)

    console.log([
      `id=${appointment._id}`,
      `code=${appointment.ma_lich_hen ?? 'null'}`,
      `patient=${appointment.ten_khach ?? 'null'}`,
      `phone=${appointment.so_dien_thoai_khach ?? 'null'}`,
      `date=${formatDate(appointment.ngay_kham).slice(0, 10)}`,
      `time=${appointment.gio_kham ?? 'null'}`,
      `status=${appointment.status}`,
      `payment=${appointment.payment_status}`,
      `resolved=${resolvedPayment}`,
      `price=${appointment.gia_kham ?? 0}`,
      `room=${appointment.phong_kham ?? 'null'}`,
      `queue=${queue ? `${queue._id}/${queue.trang_thai}` : 'none'}`,
    ].join(' | '))

    if (invoice) {
      console.log(`  invoice=${invoice._id} code=${invoice.so_hoa_don} status=${invoice.trang_thai_hoa_don} total=${invoice.tong_thanh_toan}`)
    } else {
      console.log('  invoice=none')
    }

    if (linkedPayments.length === 0) {
      console.log('  payments=none')
    } else {
      for (const payment of linkedPayments) {
        console.log(`  payment=${payment._id} code=${payment.ma_giao_dich} type=${payment.loai_thanh_toan} status=${payment.status} amount=${payment.so_tien} paid_at=${formatDate(payment.ngay_thanh_toan || payment.thoi_diem_thanh_toan)}`)
      }
    }
  }
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }
  })
