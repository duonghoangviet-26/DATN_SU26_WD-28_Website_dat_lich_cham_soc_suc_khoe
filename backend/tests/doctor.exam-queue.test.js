import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()
import { HangDoi, KetQuaKham, NguoiDung, BacSi } from '../src/models/index.js'
import { layLuotDaToiCungNgay } from '../src/controllers/doctor/queue.controller.js'

const BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:5000/api'
const DOCTOR_ID = '6a4fba7e001249319b047cae'   // bác sĩ demo dùng để test hàng đợi khám
const SPECIALTY_ID = '6a4f6a2d47db9c9377410bbd'

let docToken
const created = { entries: [], results: [] }

async function api(path, { method = 'GET', body, auth } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

// Đăng nhập đúng tài khoản bác sĩ ứng với DOCTOR_ID (lấy email qua BacSi->NguoiDung).
async function loginDoctorOfId(bacSiId) {
  const bs = await BacSi.findById(bacSiId).select('user_id').lean()
  const u = await NguoiDung.findById(bs.user_id).select('email').lean()
  for (const pw of ['123456', 'Test123456']) {
    const r = await api('/auth/login', { method: 'POST', body: { email: u.email, mat_khau: pw } })
    if (r.status === 200) return r.body.data.token
  }
  throw new Error('Khong dang nhap duoc bac si cua DOCTOR_ID: ' + u.email)
}

before(async () => {
  await mongoose.connect(process.env.MONGODB_URI)
  docToken = await loginDoctorOfId(DOCTOR_ID)
})

after(async () => {
  await KetQuaKham.deleteMany({ _id: { $in: created.results } })
  await HangDoi.deleteMany({ _id: { $in: created.entries } })
  await mongoose.disconnect()
})

test('GET /doctor/queue trả cả lượt online lẫn offline với trạng thái tổng hợp', async () => {
  const offline = await HangDoi.create({
    nguon: 'offline', ten_benh_nhan: 'TEST_EQ_OFFLINE', so_dien_thoai: '0900000010',
    specialty_id: SPECIALTY_ID, doctor_id: DOCTOR_ID, muc_uu_tien: 'offline',
    checkin_time: new Date(), trang_thai: 'dang_cho',
  })
  created.entries.push(offline._id)

  const waiting = await HangDoi.create({
    nguon: 'offline', ten_benh_nhan: 'TEST_EQ_CONFIRM', so_dien_thoai: '0900000011',
    specialty_id: SPECIALTY_ID, doctor_id: DOCTOR_ID, muc_uu_tien: 'offline',
    checkin_time: new Date(), trang_thai: 'hoan_thanh',
  })
  created.entries.push(waiting._id)
  const kq = await KetQuaKham.create({ hang_doi_id: waiting._id, bac_si_phu_trach_id: DOCTOR_ID, status: 'cho_xac_nhan', chan_doan: '(TEST) X' })
  created.results.push(kq._id)

  const res = await api('/doctor/queue', { auth: docToken })
  assert.equal(res.status, 200, JSON.stringify(res.body))
  const rows = res.body.data
  const rOffline = rows.find((x) => x.ten_benh_nhan === 'TEST_EQ_OFFLINE')
  const rConfirm = rows.find((x) => x.ten_benh_nhan === 'TEST_EQ_CONFIRM')
  assert.ok(rOffline, 'phải có lượt offline đang chờ')
  assert.equal(rOffline.trang_thai_tong_hop, 'dang_cho')
  assert.equal(rOffline.nguon, 'offline')
  assert.equal(rConfirm.trang_thai_tong_hop, 'cho_xac_nhan')
  assert.equal(String(rConfirm.ket_qua_id), String(kq._id))
})

test('GET /doctor/queue không kèm token -> 401', async () => {
  const res = await api('/doctor/queue')
  assert.equal(res.status, 401)
})

test('hàng đợi hôm nay không đếm lượt đang chờ từ ngày trước', async () => {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const futureSlot = new Date(now.getTime() + 2 * 60 * 60 * 1000)

  const stale = await HangDoi.create({
    nguon: 'offline', ten_benh_nhan: 'TEST_EQ_STALE', so_dien_thoai: '0900000012',
    specialty_id: SPECIALTY_ID, doctor_id: DOCTOR_ID, muc_uu_tien: 'offline',
    gio_hen_goc: yesterday, checkin_time: yesterday, trang_thai: 'dang_cho',
  })
  const target = await HangDoi.create({
    nguon: 'offline', ten_benh_nhan: 'TEST_EQ_TODAY', so_dien_thoai: '0900000013',
    specialty_id: SPECIALTY_ID, doctor_id: DOCTOR_ID, muc_uu_tien: 'offline',
    gio_hen_goc: futureSlot, checkin_time: now, trang_thai: 'dang_cho',
  })
  created.entries.push(stale._id, target._id)

  const reachedEntries = await layLuotDaToiCungNgay(target, DOCTOR_ID, now)
  assert.equal(reachedEntries.some((entry) => String(entry._id) === String(stale._id)), false)
})
