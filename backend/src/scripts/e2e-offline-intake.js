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
  if (created.payments.length) await ThanhToan.deleteMany({ _id: { $in: created.payments } })
  if (created.invoices.length) await HoaDon.deleteMany({ _id: { $in: created.invoices } })
  if (created.queues.length) {
    await DonThuoc.deleteMany({ medical_record_id: { $in: await KetQuaKham.find({ hang_doi_id: { $in: created.queues } }).distinct('_id') } })
    await KetQuaKham.deleteMany({ hang_doi_id: { $in: created.queues } })
    await SinhHieuKham.deleteMany({ hang_doi_id: { $in: created.queues } })
    await NhatKyThaoTac.deleteMany({ doi_tuong_id: { $in: created.queues } })
    await HangDoi.deleteMany({ _id: { $in: created.queues } })
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

  const resultResponse = await request(base, 'POST', `/doctor/appointments/records/${queueId}/result`, {
    token: doctorToken,
    body: {
      chan_doan: 'Viem mui hong cap',
      huong_dan_dieu_tri: 'Uong thuoc theo don',
      sinh_hieu: { nhiet_do: 37.2, nhip_tim: 78 },
    },
  })
  check('doctor can create an offline examination result', resultResponse.status === 201, resultResponse.payload?.message)
  check('offline result is linked to the queue', String(resultResponse.payload?.data?.hang_doi_id) === String(queueId))

  const historyAfterResult = await request(base, 'GET', `/doctor/appointments/patient-profiles/${profileA.id}/history`, { token: doctorToken })
  const offlineVisit = historyAfterResult.payload?.data?.visits?.find((visit) => String(visit.hang_doi_id) === String(queueId))
  check('patient history includes the offline examination result', offlineVisit?.ket_qua?.chan_doan === 'Viem mui hong cap')

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

  const invoiceResponse = await request(base, 'POST', `/receptionist/payments/offline/${queueId}/invoice`, {
    token: receptionistToken,
    body: {
      dich_vu_phat_sinh: [{ service_id: String(service._id), so_luong: 1 }],
      phuong_thuc: 'tien_mat',
    },
  })
  check('cashier creates offline invoice with extra service', invoiceResponse.status === 201, invoiceResponse.payload?.message)
  const invoice = invoiceResponse.payload?.data?.invoice
  const payment = invoiceResponse.payload?.data?.payment
  check('invoice links the queue and profile', String(invoice?.hang_doi_id) === String(queueId) && String(invoice?.ho_so_benh_nhan_id) === String(profileA.id))
  check('extra service is included in invoice total', invoice?.tong_tien_phat_sinh === service.gia)
  check('cash payment is marked paid', payment?.status === 'paid' && invoice?.con_phai_thu === 0)
  created.invoices.push(invoice.id)
  if (payment?._id) created.payments.push(payment._id)

  const invoiceRead = await request(base, 'GET', `/receptionist/payments/offline/${queueId}/invoice`, { token: receptionistToken })
  check('cashier can reload the completed invoice', invoiceRead.status === 200 && invoiceRead.payload?.data?.invoice?.so_hoa_don === invoice.so_hoa_don)

  console.log(`[${TAG}] ALL OFFLINE E2E CHECKS PASSED`)
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
