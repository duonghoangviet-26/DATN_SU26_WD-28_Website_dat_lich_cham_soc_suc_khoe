/**
 * End-to-end test for the receptionist offline intake flow.
 *
 * Safety: this script writes and deletes data. It only runs when the connected
 * database name contains TEST or E2E.
 *
 * Usage:
 *   MONGODB_URI=<test-uri> node src/scripts/e2e-offline-intake.js
 */
import '../config/timezone.js'
import 'dotenv/config'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'
import { strict as assert } from 'node:assert'
import { once } from 'node:events'
import app from '../app.js'
import {
  BacSi,
  ChuyenKhoa,
  DichVu,
  HangDoi,
  HoaDon,
  HoSoBenhNhan,
  KetQuaKham,
  LichHen,
  DonThuoc,
  SinhHieuKham,
  LichLamViec,
  NguoiDung,
  NhatKyThaoTac,
  ThanhToan,
  TrangThaiPhongKham,
} from '../models/index.js'
import { startOfDayUtc } from '../utils/clinicTime.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const TAG = `E2E-OFFLINE-${Date.now()}`
const created = {
  appointments: [],
  profiles: [],
  queues: [],
  invoices: [],
  payments: [],
  services: [],
  auditIds: [],
}
let server
let roomSnapshot = null
let roomDoctorId = null
let roomWasCreated = false
let claimedScheduleId = null
let claimedSlotId = null

function tokenFor(user) {
  return jwt.sign(
    { id: String(user._id), role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  )
}

async function request(base, method, route, { token, body } = {}) {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  let payload = null
  try {
    payload = await response.json()
  } catch {
    // Keep the raw status useful when the server returns an empty body.
  }
  return { status: response.status, payload }
}

function check(label, condition, detail = '') {
  assert.ok(condition, `${label}${detail ? ` (${detail})` : ''}`)
  console.log(`  PASS ${label}${detail ? ` - ${detail}` : ''}`)
}

async function cleanup() {
  const resultIds = [
    ...await KetQuaKham.find({ hang_doi_id: { $in: created.queues } }).distinct('_id'),
    ...await KetQuaKham.find({ appointment_id: { $in: created.appointments } }).distinct('_id'),
  ]
  if (created.invoices.length) {
    await NhatKyThaoTac.deleteMany({ doi_tuong_id: { $in: created.invoices } })
    await ThanhToan.deleteMany({ hoa_don_id: { $in: created.invoices } })
    await HoaDon.deleteMany({ _id: { $in: created.invoices } })
  }
  if (created.payments.length) await ThanhToan.deleteMany({ _id: { $in: created.payments } })
  if (created.appointments.length) await ThanhToan.deleteMany({ appointment_id: { $in: created.appointments } })
  if (created.queues.length) {
    await DonThuoc.deleteMany({ medical_record_id: { $in: resultIds } })
    await KetQuaKham.deleteMany({ hang_doi_id: { $in: created.queues } })
    await SinhHieuKham.deleteMany({ hang_doi_id: { $in: created.queues } })
    await NhatKyThaoTac.deleteMany({ doi_tuong_id: { $in: created.queues } })
    await HangDoi.deleteMany({ _id: { $in: created.queues } })
  }
  if (created.appointments.length) {
    await KetQuaKham.deleteMany({ appointment_id: { $in: created.appointments } })
    await LichHen.deleteMany({ _id: { $in: created.appointments } })
  }
  if (created.services.length) await DichVu.deleteMany({ _id: { $in: created.services } })
  if (created.profiles.length) await HoSoBenhNhan.deleteMany({ _id: { $in: created.profiles } })
  if (claimedScheduleId && claimedSlotId) {
    await LichLamViec.updateOne(
      { _id: claimedScheduleId, 'slots._id': claimedSlotId },
      { $set: { 'slots.$.status': 'active' } },
    )
  }
  if (roomDoctorId) {
    if (roomWasCreated) {
      await TrangThaiPhongKham.deleteOne({ doctor_id: roomDoctorId, ngay: startOfDayUtc(new Date()) })
    } else if (roomSnapshot) {
      await TrangThaiPhongKham.replaceOne({ _id: roomSnapshot._id }, roomSnapshot)
    }
  }
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Missing MONGODB_URI')
  if (!process.env.JWT_SECRET) throw new Error('Missing JWT_SECRET')

  await mongoose.connect(process.env.MONGODB_URI)
  const databaseName = mongoose.connection.db.databaseName
  if (!/(test|e2e)/i.test(databaseName)) {
    throw new Error(`Refusing writes: ${databaseName} is not a TEST/E2E database`)
  }

  const receptionist = await NguoiDung.findOne({ role: 'receptionist', status: 'active' }).lean()
    ?? await NguoiDung.findOne({ role: 'admin', status: 'active' }).lean()
  check('test database has receptionist/admin', !!receptionist)

  server = app.listen(0)
  await once(server, 'listening')
  const port = server.address().port
  const base = `http://127.0.0.1:${port}/api`
  const receptionistToken = tokenFor(receptionist)

  console.log(`[${TAG}] DB=${databaseName} API=${base}`)

  const unauthenticated = await request(base, 'GET', '/receptionist/patient-intake/search?phone=0907770000')
  check('patient search rejects missing token', unauthenticated.status === 401, String(unauthenticated.status))

  const phone = `090${String(Date.now()).slice(-7)}`
  const profileAResponse = await request(base, 'POST', '/receptionist/patient-intake/profiles', {
    token: receptionistToken,
    body: { ho_ten: `${TAG} A`, so_dien_thoai: phone, gioi_tinh: 'nam' },
  })
  check('creates first patient profile', profileAResponse.status === 201, profileAResponse.payload?.message)
  const profileA = profileAResponse.payload?.data?.profile
  check('first profile has an id', !!profileA?.id)
  created.profiles.push(profileA.id)

  const profileBResponse = await request(base, 'POST', '/receptionist/patient-intake/profiles', {
    token: receptionistToken,
    body: { ho_ten: `${TAG} B`, so_dien_thoai: phone, gioi_tinh: 'nu' },
  })
  check('same phone can create a second profile', profileBResponse.status === 201, profileBResponse.payload?.message)
  const profileB = profileBResponse.payload?.data?.profile
  created.profiles.push(profileB.id)

  const duplicate = await request(base, 'POST', '/receptionist/patient-intake/profiles', {
    token: receptionistToken,
    body: { ho_ten: `${TAG} A`, so_dien_thoai: phone, gioi_tinh: 'nam' },
  })
  check('exact duplicate profile is rejected', duplicate.status === 409, String(duplicate.status))

  const search = await request(base, 'GET', `/receptionist/patient-intake/search?phone=${phone}`, { token: receptionistToken })
  check('search returns both profiles sharing one phone', search.status === 200 && search.payload?.data?.total === 2)

  const availability = await request(base, 'GET', '/receptionist/patient-intake/availability', { token: receptionistToken })
  check('availability endpoint responds', availability.status === 200, availability.payload?.message)
  const availableSlot = availability.payload?.data?.slots?.find((slot) => slot.specialty_id)
  check('test schedule has an available specialty slot', !!availableSlot, availability.payload?.data?.thong_bao || 'no slot')
  claimedScheduleId = availableSlot.schedule_id
  claimedSlotId = availableSlot.slot_id

  const checkedIn = await request(base, 'POST', '/receptionist/patient-intake/check-in', {
    token: receptionistToken,
    body: {
      ho_so_benh_nhan_id: profileA.id,
      schedule_id: availableSlot.schedule_id,
      slot_id: availableSlot.slot_id,
    },
  })
  check('check-in creates an offline queue entry', checkedIn.status === 201, checkedIn.payload?.message)
  const queueId = checkedIn.payload?.data?.entry?._id
  check('queue entry is returned', !!queueId)
  created.queues.push(queueId)

  const slotInDb = await LichLamViec.findOne({ _id: availableSlot.schedule_id, 'slots._id': availableSlot.slot_id }).lean()
  const slot = slotInDb?.slots?.find((item) => String(item._id) === String(availableSlot.slot_id))
  check('check-in atomically marks slot booked', slot?.status === 'booked', slot?.status)

  const reusedSlot = await request(base, 'POST', '/receptionist/patient-intake/check-in', {
    token: receptionistToken,
    body: {
      ho_so_benh_nhan_id: profileB.id,
      schedule_id: availableSlot.schedule_id,
      slot_id: availableSlot.slot_id,
    },
  })
  check('a booked slot cannot be claimed twice', reusedSlot.status === 409, String(reusedSlot.status))

  const schedule = await LichLamViec.findById(availableSlot.schedule_id).lean()
  const doctor = await BacSi.findById(schedule.doctor_id).lean()
  const doctorUser = await NguoiDung.findById(doctor.user_id).lean()
  check('slot has a doctor account for the next stage', !!doctorUser)
  const doctorToken = tokenFor(doctorUser)

  const doctorCheckin = await request(base, 'POST', '/doctor/queue/checkin', {
    token: doctorToken,
    body: { ho_so_benh_nhan_id: profileB.id, schedule_id: availableSlot.schedule_id, slot_id: availableSlot.slot_id },
  })
  check('doctor cannot bypass receptionist check-in', doctorCheckin.status === 403, String(doctorCheckin.status))

  const doctorSchedule = await request(base, 'GET', '/doctor/schedule', { token: doctorToken })
  const offlineSlotOnBoard = (doctorSchedule.payload?.data ?? []).find((slot) => String(slot.id) === String(availableSlot.slot_id))
  check('doctor schedule resolves the offline patient from the queue entry',
    doctorSchedule.status === 200
      && offlineSlotOnBoard?.benh_nhan === `${TAG} A`
      && offlineSlotOnBoard?.nguon_chiem_cho === 'tai_quay')

  await HangDoi.updateOne({ _id: queueId }, { $set: { gio_hen_goc: new Date(Date.now() - 60000), so_lan_goi: 1 } })
  const queueList = await request(base, 'GET', '/doctor/queue', { token: doctorToken })
  const queueRow = (queueList.payload?.data ?? []).find((row) => String(row.id ?? row._id) === String(queueId))
  check('doctor queue exposes the offline patient', queueList.status === 200 && !!queueRow)
  check('doctor queue carries the patient profile id', String(queueRow?.ho_so_benh_nhan_id) === String(profileA.id))

  const history = await request(base, 'GET', `/doctor/appointments/patient-profiles/${profileA.id}/history`, { token: doctorToken })
  check('doctor can open the patient profile history', history.status === 200 && history.payload?.data?.profile?.id)

  roomDoctorId = doctor._id
  roomSnapshot = await TrangThaiPhongKham.findOne({ doctor_id: doctor._id, ngay: startOfDayUtc(new Date()) }).lean()
  roomWasCreated = !roomSnapshot
  await TrangThaiPhongKham.updateOne(
    { doctor_id: doctor._id, ngay: startOfDayUtc(new Date()) },
    { $set: { trang_thai: 'san_sang', benh_nhan_hien_tai_id: null } },
    { upsert: true },
  )

  const called = await request(base, 'PATCH', `/doctor/queue/${queueId}/call`, { token: doctorToken })
  check('doctor can call the offline patient', called.status === 200, called.payload?.message)
  const intoRoom = await request(base, 'PATCH', `/doctor/queue/${queueId}/into-room`, { token: doctorToken })
  check('doctor can move the offline patient into the room', intoRoom.status === 200, intoRoom.payload?.message)
  const finished = await request(base, 'PATCH', `/doctor/queue/${queueId}/finish`, { token: doctorToken })
  check('doctor can finish the offline visit', finished.status === 200, finished.payload?.message)

  const relatedService = await DichVu.findOne({
    status: 'active',
    loai: 'related',
    $or: [{ specialty_id: availableSlot.specialty_id }, { specialty_id: null }],
  }).lean()
  let service = relatedService
  if (!service) {
    service = await DichVu.create({
      ten: `${TAG} related service`,
      loai: 'related',
      specialty_id: availableSlot.specialty_id,
      gia: 50000,
      status: 'active',
    })
    created.services.push(service._id)
  }

  const doctorServices = await request(base, 'GET', `/doctor/appointments/services/related?queue_id=${queueId}`, { token: doctorToken })
  check('doctor can only load related services for the owned queue', doctorServices.status === 200 && doctorServices.payload?.data?.some((item) => String(item._id) === String(service._id)))

  const resultResponse = await request(base, 'POST', `/doctor/appointments/records/${queueId}/result`, {
    token: doctorToken,
    body: {
      chan_doan: 'Viem mui hong cap',
      huong_dan_dieu_tri: 'Uong thuoc theo don',
      sinh_hieu: { nhiet_do: 37.2, nhip_tim: 78 },
      dich_vu_phat_sinh: [{ service_id: String(service._id), so_luong: 1 }],
    },
  })
  check('doctor can create an offline examination result', resultResponse.status === 201, resultResponse.payload?.message)
  check('offline result is linked to the queue', String(resultResponse.payload?.data?.hang_doi_id) === String(queueId))
  check('doctor service order is saved as an immutable billing snapshot', resultResponse.payload?.data?.dich_vu_phat_sinh?.[0]?.thanh_tien === service.gia)

  const historyAfterResult = await request(base, 'GET', `/doctor/appointments/patient-profiles/${profileA.id}/history`, { token: doctorToken })
  const offlineVisit = historyAfterResult.payload?.data?.visits?.find((visit) => String(visit.hang_doi_id) === String(queueId))
  check('patient history includes the offline examination result', offlineVisit?.ket_qua?.chan_doan === 'Viem mui hong cap')

  const billingCases = await request(base, 'GET', '/receptionist/payments/cases', { token: receptionistToken })
  check('cashier only sees the confirmed offline record as billable', billingCases.status === 200 && billingCases.payload?.data?.some((item) => item.source === 'offline' && String(item.id) === String(queueId)))

  const invoiceResponse = await request(base, 'POST', `/receptionist/payments/cases/${queueId}/invoice`, {
    token: receptionistToken,
    body: {
      source: 'offline',
      phuong_thuc: 'chuyen_khoan',
    },
  })
  check('cashier creates invoice only from doctor-ordered service', invoiceResponse.status === 201, invoiceResponse.payload?.message)
  const invoice = invoiceResponse.payload?.data?.invoice
  const pendingPayment = invoiceResponse.payload?.data?.pending_payment
  check('invoice contains the doctor service snapshot', invoice?.tong_tien_phat_sinh === service.gia)
  check('transfer invoice stays pending until cashier confirms receipt', pendingPayment?.status === 'pending' && invoice?.con_phai_thu > 0)
  created.invoices.push(invoice.id)
  if (pendingPayment?.id) created.payments.push(pendingPayment.id)

  const beforePaidPrint = await request(base, 'POST', `/receptionist/payments/cases/${queueId}/receipt-print`, {
    token: receptionistToken,
    body: { source: 'offline' },
  })
  check('receipt cannot be printed before full payment', beforePaidPrint.status === 409, String(beforePaidPrint.status))

  const confirmedTransfer = await request(base, 'PATCH', `/receptionist/payments/cases/${queueId}/payments/${pendingPayment.id}/confirm`, {
    token: receptionistToken,
    body: { source: 'offline' },
  })
  check('cashier can confirm the pending transfer exactly once', confirmedTransfer.status === 200 && confirmedTransfer.payload?.data?.invoice?.con_phai_thu === 0)

  const receipt = await request(base, 'POST', `/receptionist/payments/cases/${queueId}/receipt-print`, {
    token: receptionistToken,
    body: { source: 'offline' },
  })
  check('paid invoice can be marked printed and handed to patient', receipt.status === 200, receipt.payload?.message)

  const invoiceRead = await request(base, 'GET', `/receptionist/payments/cases/${queueId}?source=offline`, { token: receptionistToken })
  check('cashier can reload the completed invoice', invoiceRead.status === 200 && invoiceRead.payload?.data?.invoice?.so_hoa_don === invoice.so_hoa_don)

  const onlineFee = 180000
  const onlineAppointment = await LichHen.create({
    user_id: receptionist._id,
    doctor_id: doctor._id,
    specialty_id: availableSlot.specialty_id,
    ho_so_benh_nhan_id: profileA.id,
    loai_kham: 'clinic',
    ngay_kham: new Date(),
    gio_kham: '20:00',
    gio_ket_thuc: '20:30',
    status: 'checked_in',
    payment_status: 'unpaid',
    gia_kham: onlineFee,
    ten_khach: `${TAG} online`,
    so_dien_thoai_khach: phone,
    nguon: 'online',
  })
  created.appointments.push(onlineAppointment._id)

  const onlineQueue = await HangDoi.create({
    nguon: 'online',
    appointment_id: onlineAppointment._id,
    ho_so_benh_nhan_id: profileA.id,
    ten_benh_nhan: `${TAG} online`,
    so_dien_thoai: phone,
    specialty_id: availableSlot.specialty_id,
    doctor_id: doctor._id,
    muc_uu_tien: 'online_uu_tien',
    gio_hen_goc: new Date(Date.now() - 60000),
    checkin_time: new Date(),
    trang_thai: 'da_goi',
    so_lan_goi: 1,
  })
  created.queues.push(onlineQueue._id)

  await TrangThaiPhongKham.updateOne(
    { doctor_id: doctor._id, ngay: startOfDayUtc(new Date()) },
    { $set: { trang_thai: 'san_sang', benh_nhan_hien_tai_id: null } },
    { upsert: true },
  )
  const onlineBlocked = await request(base, 'PATCH', `/doctor/queue/${onlineQueue._id}/into-room`, { token: doctorToken })
  check('online patient cannot enter room before appointment fee is paid', onlineBlocked.status === 409, String(onlineBlocked.status))

  const onlinePrepayment = await ThanhToan.create({
    appointment_id: onlineAppointment._id,
    ho_so_benh_nhan_id: profileA.id,
    so_tien: onlineFee,
    loai_thanh_toan: 'phi_dat_lich',
    phuong_thuc: 'chuyen_khoan',
    status: 'paid',
    ngay_thanh_toan: new Date(),
    thoi_diem_thanh_toan: new Date(),
    nguoi_thu_id: receptionist._id,
  })
  created.payments.push(onlinePrepayment._id)
  await LichHen.updateOne({ _id: onlineAppointment._id }, { $set: { payment_status: 'paid' } })

  const onlineIntoRoom = await request(base, 'PATCH', `/doctor/queue/${onlineQueue._id}/into-room`, { token: doctorToken })
  check('paid online patient can enter room', onlineIntoRoom.status === 200, onlineIntoRoom.payload?.message)
  const onlineFinish = await request(base, 'PATCH', `/doctor/queue/${onlineQueue._id}/finish`, { token: doctorToken })
  check('doctor can finish the paid online visit', onlineFinish.status === 200, onlineFinish.payload?.message)

  const onlineResult = await request(base, 'POST', `/doctor/appointments/${onlineAppointment._id}/result`, {
    token: doctorToken,
    body: {
      chan_doan: 'Ket qua online co chi dinh dich vu',
      dich_vu_phat_sinh: [{ service_id: String(service._id), so_luong: 1 }],
    },
  })
  check('doctor result keeps online visit open when an extra service is ordered', onlineResult.status === 201, onlineResult.payload?.message)

  const onlineInvoiceResponse = await request(base, 'POST', `/receptionist/payments/cases/${onlineAppointment._id}/invoice`, {
    token: receptionistToken,
    body: { source: 'online', phuong_thuc: 'chuyen_khoan' },
  })
  check('cashier links the online prepayment to its clinical invoice', onlineInvoiceResponse.status === 201, onlineInvoiceResponse.payload?.message)
  const onlineInvoice = onlineInvoiceResponse.payload?.data?.invoice
  const onlinePending = onlineInvoiceResponse.payload?.data?.pending_payment
  check('online invoice charges only the additional doctor service', onlineInvoice?.tong_da_thu === onlineFee && onlineInvoice?.con_phai_thu === service.gia)
  created.invoices.push(onlineInvoice.id)
  if (onlinePending?.id) created.payments.push(onlinePending.id)

  const onlinePaid = await request(base, 'PATCH', `/receptionist/payments/cases/${onlineAppointment._id}/payments/${onlinePending.id}/confirm`, {
    token: receptionistToken,
    body: { source: 'online' },
  })
  check('cashier can settle the online additional charge', onlinePaid.status === 200 && onlinePaid.payload?.data?.invoice?.con_phai_thu === 0)
  const completedOnlineAppointment = await LichHen.findById(onlineAppointment._id).select('status payment_status').lean()
  check('online visit closes only after the additional charge is fully paid', completedOnlineAppointment?.status === 'completed' && completedOnlineAppointment.payment_status === 'paid')

  console.log(`[${TAG}] ALL CHECK-IN TO INVOICE E2E CHECKS PASSED`)
}

try {
  await main()
} catch (error) {
  console.error(`[${TAG}] FAILED: ${error.stack || error.message}`)
  process.exitCode = 1
} finally {
  try { await cleanup() } catch (error) { console.error(`[${TAG}] CLEANUP FAILED: ${error.message}`); process.exitCode = 1 }
  if (server) await new Promise((resolve) => server.close(resolve))
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
}
