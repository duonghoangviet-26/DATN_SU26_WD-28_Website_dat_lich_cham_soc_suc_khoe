import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

// ============================================================
// INTEGRATION TEST — Đồng bộ Lịch làm việc <-> Xin nghỉ (SYNC-01, SYNC-02, LEAVE-01)
// Yêu cầu: backend chạy tại BASE_URL, đã seed doctor.test@vitafamily.local
//          (node src/scripts/seed-doctor-test-data.js) và admin@vitafamily.vn (seed-all.js).
// Tự tạo lịch làm việc RIÊNG cho ngày xa tương lai (ensure-day, idempotent) để KHÔNG đụng
// 6 ngày lịch mẫu dùng chung với doctor.schedule.test.js / doctor.api.test.js.
// Tự dọn dữ liệu: unlock lại slot + trả trang_thai_ngay về 'lam_viec' ở after().
// ============================================================

const BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:5000/api'
const DOCTOR_EMAIL = 'doctor.test@vitafamily.local'
const DOCTOR_PASSWORD = 'Test123456'
const ADMIN_EMAIL = 'admin@vitafamily.vn'
const ADMIN_PASSWORD = '123456'
const PATIENT_EMAIL = 'patient.test@vitafamily.local'
const PATIENT_PASSWORD = 'Test123456'

let doctorToken
let adminToken
let patientToken
let doctorId

async function api(path, { method = 'GET', body, auth } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, body: json }
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Ngày làm việc xa tương lai (ngoài rolling window ~21 ngày của cron), tránh Chủ nhật.
// Offset khác doctor.schedule.test.js (+40) để không trùng NghiPhepBacSi của test khác.
// RUN_SALT xoay ngày theo LẦN CHẠY (dựa vào epoch mili-giây, biên độ ~10 năm) — bắt buộc vì
// một khi đơn nghỉ được duyệt (da_duyet) thì KHÔNG có đường hủy/mở lại (giới hạn đã biết, xem
// plan mục "Giới hạn đã biết"), nên chạy lại test nhiều lần trong cùng phiên làm việc với salt
// biên độ hẹp (vd theo giây) dễ trùng lại ngày của lần chạy trước và đụng đơn cũ còn sót lại.
function chonNgayLamViecTrong(startOffset, activeLeaves, usedDates) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let offset = startOffset; offset < startOffset + 3650; offset += 1) {
    const d = new Date(today)
    d.setDate(d.getDate() + offset)
    if (d.getDay() === 0) continue
    const date = ymd(d)
    const occupied = activeLeaves.some((leave) => date >= leave.tu_ngay && date <= leave.den_ngay)
    if (!occupied && !usedDates.has(date)) return date
  }
  throw new Error('Khong tim duoc ngay lam viec sach de test nghi phep')
}

// Lấy (hoặc tạo, idempotent qua ensure-day) lịch làm việc chuẩn cho 1 ngày cụ thể.
async function ensureSchedule(dateStr) {
  const ensureRes = await api('/admin/slots/ensure-day', {
    method: 'POST',
    auth: adminToken,
    body: { doctor_id: doctorId, ngay: dateStr },
  })
  assert.ok([200, 201].includes(ensureRes.status), `ensure-day that bai cho ${dateStr}: ${JSON.stringify(ensureRes.body)}`)
  const scheduleId = ensureRes.body.data._id
  const detail = await api(`/admin/slots/${scheduleId}`, { auth: adminToken })
  assert.equal(detail.status, 200)
  return detail.body.data
}

async function ensureDoctorPubliclyBookable() {
  const detail = await api(`/admin/doctors/${doctorId}`, { auth: adminToken })
  assert.equal(detail.status, 200, `Khong doc duoc doctor.test: ${JSON.stringify(detail.body)}`)

  const approvalStatus = detail.body.data.trang_thai_duyet
  if (approvalStatus === 'suspended') {
    const restore = await api(`/admin/doctors/${doctorId}/restore`, { method: 'PUT', auth: adminToken })
    assert.equal(restore.status, 200, `Khong restore duoc doctor.test: ${JSON.stringify(restore.body)}`)
  } else if (['pending', 'rejected'].includes(approvalStatus)) {
    const approve = await api(`/admin/doctors/${doctorId}/approve`, {
      method: 'PUT',
      auth: adminToken,
      body: { phong_kham_mac_dinh: detail.body.data.phong_kham_mac_dinh ?? undefined },
    })
    assert.equal(approve.status, 200, `Khong approve duoc doctor.test: ${JSON.stringify(approve.body)}`)
  }

  const res = await api(`/admin/doctors/${doctorId}`, {
    method: 'PUT',
    auth: adminToken,
    body: { la_hien: true, trang_thai: 'active' },
  })
  assert.equal(res.status, 200, `Khong bat duoc doctor.test ve trang thai public/bookable: ${JSON.stringify(res.body)}`)
}

// Trả 1 schedule về trạng thái sạch để test chạy lại nhiều lần được (self-cleaning).
async function resetSchedule(scheduleId) {
  const detail = await api(`/admin/slots/${scheduleId}`, { auth: adminToken })
  if (detail.status !== 200) return
  for (const slot of detail.body.data.slots) {
    if (slot.bi_khoa_boi_nghi_phep || slot.status === 'locked') {
      await api(`/admin/slots/${scheduleId}/slots/${slot._id}`, {
        method: 'PATCH',
        auth: adminToken,
        body: { status: 'active', bi_khoa_boi_nghi_phep: false, nghi_phep_id: null },
      })
    }
  }
  if (detail.body.data.trang_thai_ngay !== 'lam_viec') {
    await api(`/admin/slots/${scheduleId}/workday`, {
      method: 'PATCH',
      auth: adminToken,
      body: { trang_thai_ngay: 'lam_viec' },
    })
  }
}

let partialDate
let fullDayDate
let filterOnlyDate
let leaveOverlapDate
let bookingGuardDate

let partialSchedule
let fullDaySchedule
let filterOnlySchedule
let bookingGuardSchedule

before(async () => {
  const login = await api('/auth/login', { method: 'POST', body: { email: DOCTOR_EMAIL, mat_khau: DOCTOR_PASSWORD } })
  assert.equal(login.status, 200, 'Seed script phai duoc chay truoc khi test')
  doctorToken = login.body.data.token

  const adminLogin = await api('/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, mat_khau: ADMIN_PASSWORD } })
  assert.equal(adminLogin.status, 200, 'Tai khoan admin@vitafamily.vn phai ton tai (seed-all.js)')
  adminToken = adminLogin.body.data.token

  const patientLogin = await api('/auth/login', { method: 'POST', body: { email: PATIENT_EMAIL, mat_khau: PATIENT_PASSWORD } })
  assert.equal(patientLogin.status, 200, 'Tai khoan patient.test phai ton tai (seed-doctor-test-data.js)')
  patientToken = patientLogin.body.data.token

  const scheduleList = await api('/doctor/schedule', { auth: doctorToken })
  assert.equal(scheduleList.status, 200)
  assert.ok(scheduleList.body.data.length > 0, 'doctor.test can co it nhat 1 lich (chay seed-doctor-test-data.js truoc)')
  const anyScheduleId = scheduleList.body.data[0].schedule_id
  const anyScheduleDetail = await api(`/admin/slots/${anyScheduleId}`, { auth: adminToken })
  assert.equal(anyScheduleDetail.status, 200)
  doctorId = anyScheduleDetail.body.data.doctor_id
  await ensureDoctorPubliclyBookable()

  const existingLeaves = await api('/doctor/leaves', { auth: doctorToken })
  assert.equal(existingLeaves.status, 200)
  const activeLeaves = existingLeaves.body.data
    .filter((leave) => ['cho_duyet', 'da_duyet'].includes(leave.trang_thai))
  const usedDates = new Set()
  partialDate = chonNgayLamViecTrong(60, activeLeaves, usedDates); usedDates.add(partialDate)
  fullDayDate = chonNgayLamViecTrong(62, activeLeaves, usedDates); usedDates.add(fullDayDate)
  filterOnlyDate = chonNgayLamViecTrong(64, activeLeaves, usedDates); usedDates.add(filterOnlyDate)
  leaveOverlapDate = chonNgayLamViecTrong(66, activeLeaves, usedDates); usedDates.add(leaveOverlapDate)
  bookingGuardDate = chonNgayLamViecTrong(68, activeLeaves, usedDates)

  partialSchedule = await ensureSchedule(partialDate)
  fullDaySchedule = await ensureSchedule(fullDayDate)
  filterOnlySchedule = await ensureSchedule(filterOnlyDate)
  bookingGuardSchedule = await ensureSchedule(bookingGuardDate)
})

after(async () => {
  await resetSchedule(partialSchedule._id)
  await resetSchedule(fullDaySchedule._id)
  await resetSchedule(filterOnlySchedule._id)
  await resetSchedule(bookingGuardSchedule._id)
})

// ── SYNC-02: duyệt nghỉ theo KHUNG GIỜ chỉ khóa đúng slot giao nhau ─────────
test('Duyet nghi theo khung gio: chi khoa slot giao gio, ngay van lam_viec, patient khong con thay khung gio do', async () => {
  const targetSlot = partialSchedule.slots.find((s) => s.status === 'active')
  assert.ok(targetSlot, 'can it nhat 1 slot active de test')
  // Phai lay slot o KHUNG GIO KHAC — khong chi khac _id. Mot khung 30' chua NHIEU slot
  // (rule §1-§2: TMH 2 slot/khung), nen slot thu 2 cung khung VAN bi khoa dung theo quy tac
  // giao gio. Truoc day test chi loc theo _id nen bat nham slot cung khung -> fail oan
  // ("locked" !== "active") trong khi controller xu ly dung.
  const keepSlot = partialSchedule.slots.find(
    (s) => s.status === 'active' && s.gio_bat_dau !== targetSlot.gio_bat_dau,
  )
  assert.ok(keepSlot, 'can it nhat 2 slot active o KHUNG GIO KHAC nhau de phan biet khoa/khong khoa')

  const createRes = await api('/doctor/leaves', {
    method: 'POST',
    auth: doctorToken,
    body: {
      tu_ngay: partialDate,
      den_ngay: partialDate,
      ly_do: 'test SYNC-02 khung gio',
      gio_bat_dau: targetSlot.gio_bat_dau,
      gio_ket_thuc: targetSlot.gio_ket_thuc,
    },
  })
  assert.equal(createRes.status, 201)
  const leaveId = createRes.body.data.id

  const beforeApprove = await api(`/patient/booking/doctors/${doctorId}/slots?date=${partialDate}`)
  assert.equal(beforeApprove.status, 200)
  assert.ok(beforeApprove.body.data.some((s) => s.gio_bat_dau === targetSlot.gio_bat_dau), 'truoc khi duyet, gio nay van phai con dat duoc')

  const approveRes = await api(`/admin/doctor-leaves/${leaveId}/approve`, { method: 'PATCH', auth: adminToken })
  assert.equal(approveRes.status, 200)
  assert.equal(approveRes.body.data.trang_thai, 'da_duyet')
  assert.ok(approveRes.body.data.so_slot_da_khoa >= 1, 'response duyet phai bao so slot da khoa')

  const scheduleAfter = await api(`/admin/slots/${partialSchedule._id}`, { auth: adminToken })
  const lockedSlot = scheduleAfter.body.data.slots.find((s) => s._id === targetSlot._id)
  assert.equal(lockedSlot.status, 'locked')
  assert.equal(lockedSlot.bi_khoa_boi_nghi_phep, true)
  assert.equal(String(lockedSlot.nghi_phep_id), String(leaveId))
  assert.equal(scheduleAfter.body.data.trang_thai_ngay, 'lam_viec', 'nghi theo ca khong duoc doi trang thai CA NGAY')

  const stillFreeSlot = scheduleAfter.body.data.slots.find((s) => s._id === keepSlot._id)
  assert.equal(stillFreeSlot.status, 'active', 'slot khong lien quan khong duoc dung toi')

  const afterApprove = await api(`/patient/booking/doctors/${doctorId}/slots?date=${partialDate}`)
  assert.equal(afterApprove.status, 200)
  assert.ok(!afterApprove.body.data.some((s) => s.gio_bat_dau === targetSlot.gio_bat_dau), 'sau khi duyet, khung gio nghi phai bi loai khoi danh sach dat lich')
  assert.ok(afterApprove.body.data.some((s) => s.gio_bat_dau === keepSlot.gio_bat_dau), 'ca khac trong ngay van con dat duoc')
})

// ── SYNC-02: duyệt nghỉ cả ngày -> cả ngày biến mất khỏi danh sách đặt lịch ──
test('Duyet nghi ca ngay: trang_thai_ngay thanh nghi_phep, patient khong con slot nao trong ngay', async () => {
  const createRes = await api('/doctor/leaves', {
    method: 'POST',
    auth: doctorToken,
    body: { tu_ngay: fullDayDate, den_ngay: fullDayDate, ly_do: 'test SYNC-02 ca ngay' },
  })
  assert.equal(createRes.status, 201)
  const leaveId = createRes.body.data.id

  const approveRes = await api(`/admin/doctor-leaves/${leaveId}/approve`, { method: 'PATCH', auth: adminToken })
  assert.equal(approveRes.status, 200)
  assert.ok(approveRes.body.data.so_slot_da_khoa >= 1)

  const scheduleAfter = await api(`/admin/slots/${fullDaySchedule._id}`, { auth: adminToken })
  assert.equal(scheduleAfter.body.data.trang_thai_ngay, 'nghi_phep')

  const afterApprove = await api(`/patient/booking/doctors/${doctorId}/slots?date=${fullDayDate}`)
  assert.equal(afterApprove.status, 200)
  assert.deepEqual(afterApprove.body.data, [], 'ca ngay nghi phai tra danh sach rong cho benh nhan')
})

// ── SYNC-02: chặn xử lý trùng — không duyệt 2 lần, không từ chối đơn đã duyệt ──
test('Duyet lai don da duyet -> 409; tu choi don da duyet -> 409', async () => {
  const createRes = await api('/doctor/leaves', {
    method: 'POST',
    auth: doctorToken,
    body: { tu_ngay: filterOnlyDate, den_ngay: filterOnlyDate, ly_do: 'test duyet 2 lan', gio_bat_dau: '08:00', gio_ket_thuc: '08:30' },
  })
  assert.equal(createRes.status, 201)
  const leaveId = createRes.body.data.id

  const firstApprove = await api(`/admin/doctor-leaves/${leaveId}/approve`, { method: 'PATCH', auth: adminToken })
  assert.equal(firstApprove.status, 200)

  const secondApprove = await api(`/admin/doctor-leaves/${leaveId}/approve`, { method: 'PATCH', auth: adminToken })
  assert.equal(secondApprove.status, 409)

  const rejectAfterApprove = await api(`/admin/doctor-leaves/${leaveId}/reject`, { method: 'PATCH', auth: adminToken })
  assert.equal(rejectAfterApprove.status, 409, 'khong duoc tu choi mot don da duyet')
})

// ── SYNC-01: phòng vệ — slot bi_khoa_boi_nghi_phep=true phải bị loại dù status còn 'active' ──
// Dùng schedule/date RIÊNG (bookingGuardSchedule) — không dùng chung filterOnlySchedule với
// test "Duyet lai don da duyet" ở trên, vì test đó (sau khi SYNC-02 sửa xong) sẽ THẬT SỰ khóa
// slot 08:00-08:30 của filterOnlyDate, khiến test này đọc nhầm slot đã locked sẵn thay vì tự
// tạo tình huống dữ liệu không nhất quán (active + bi_khoa_boi_nghi_phep=true) như chủ đích.
test('getSlots va createBooking loai slot co bi_khoa_boi_nghi_phep=true du status con active', async () => {
  const targetSlot = bookingGuardSchedule.slots.find((s) => s.status === 'active')
  assert.ok(targetSlot)

  // Mô phỏng dữ liệu KHÔNG nhất quán (vd admin sửa tay qua updateSlot): set cờ khóa nhưng
  // KHÔNG đổi status — đây chính là kịch bản mà chỉ dựa vào status=active/locked sẽ bỏ sót.
  const patchRes = await api(`/admin/slots/${bookingGuardSchedule._id}/slots/${targetSlot._id}`, {
    method: 'PATCH',
    auth: adminToken,
    body: { bi_khoa_boi_nghi_phep: true },
  })
  assert.equal(patchRes.status, 200)

  const res = await api(`/patient/booking/doctors/${doctorId}/slots?date=${bookingGuardDate}`)
  assert.equal(res.status, 200)
  assert.ok(!res.body.data.some((s) => s.gio_bat_dau === targetSlot.gio_bat_dau), 'slot bi khoa boi nghi phep khong duoc xuat hien du status con active')

  const bookingRes = await api('/patient/booking', {
    method: 'POST',
    auth: patientToken,
    body: {
      loai_kham: 'clinic',
      doctor_id: doctorId,
      schedule_id: bookingGuardSchedule._id,
      slot_id: targetSlot._id,
      ngay_kham: bookingGuardDate,
      ten_khach: 'TEST Guest SYNC-01',
    },
  })
  assert.ok([400, 409].includes(bookingRes.status), 'dat lich truc tiep vao slot bi khoa boi nghi phep phai bi tu choi du status con active')
})

// ── GAP-010: updateSlot khong cho doi status ngam khi slot dang bi khoa boi nghi phep ──
// Dung slot KHAC voi test SYNC-01 o tren (schedule da bi test truoc do mutate 1 slot).
test('updateSlot: doi status khi slot dang bi_khoa_boi_nghi_phep=true ma khong bo khoa tuong minh -> 409', async () => {
  const detail = await api(`/admin/slots/${bookingGuardSchedule._id}`, { auth: adminToken })
  assert.equal(detail.status, 200)
  const targetSlot = detail.body.data.slots.find((s) => s.status === 'active' && !s.bi_khoa_boi_nghi_phep)
  assert.ok(targetSlot, 'Can 1 slot active chua bi khoa de test')

  // Mo phong dung trang thai sau khi duyet nghi phep: status='locked' + bi_khoa_boi_nghi_phep=true.
  const lockRes = await api(`/admin/slots/${bookingGuardSchedule._id}/slots/${targetSlot._id}`, {
    method: 'PATCH', auth: adminToken,
    body: { status: 'locked', bi_khoa_boi_nghi_phep: true, nghi_phep_id: targetSlot._id },
  })
  assert.equal(lockRes.status, 200)

  // Doi status ma KHONG tuong minh bo khoa -> phai bi tu choi (truoc fix: cho qua, "mo lai" slot).
  const blockedRes = await api(`/admin/slots/${bookingGuardSchedule._id}/slots/${targetSlot._id}`, {
    method: 'PATCH', auth: adminToken,
    body: { status: 'active' },
  })
  assert.equal(blockedRes.status, 409)

  // Doi status KEM bi_khoa_boi_nghi_phep=false trong CUNG request -> duoc phep (bo khoa tuong minh).
  const allowedRes = await api(`/admin/slots/${bookingGuardSchedule._id}/slots/${targetSlot._id}`, {
    method: 'PATCH', auth: adminToken,
    body: { status: 'active', bi_khoa_boi_nghi_phep: false, nghi_phep_id: null },
  })
  assert.equal(allowedRes.status, 200)
})

// ── LEAVE-01: chống trùng theo KHUNG GIỜ, không còn chặn cả ngày ───────────
test('2 don nghi cung ngay, khac khung gio khong giao nhau -> ca 2 deu tao duoc (201); giao gio -> 409', async () => {
  const first = await api('/doctor/leaves', {
    method: 'POST',
    auth: doctorToken,
    body: { tu_ngay: leaveOverlapDate, den_ngay: leaveOverlapDate, ly_do: 'test LEAVE-01 ca sang', gio_bat_dau: '08:00', gio_ket_thuc: '09:00' },
  })
  assert.equal(first.status, 201)

  const second = await api('/doctor/leaves', {
    method: 'POST',
    auth: doctorToken,
    body: { tu_ngay: leaveOverlapDate, den_ngay: leaveOverlapDate, ly_do: 'test LEAVE-01 ca chieu', gio_bat_dau: '13:30', gio_ket_thuc: '14:30' },
  })
  assert.equal(second.status, 201)

  const overlapping = await api('/doctor/leaves', {
    method: 'POST',
    auth: doctorToken,
    body: { tu_ngay: leaveOverlapDate, den_ngay: leaveOverlapDate, ly_do: 'test LEAVE-01 giao gio', gio_bat_dau: '08:30', gio_ket_thuc: '09:30' },
  })
  assert.equal(overlapping.status, 409, 'khung gio giao voi don thu 1 phai bi chan')

  await api(`/doctor/leaves/${first.body.data.id}/cancel`, { method: 'PATCH', auth: doctorToken })
  await api(`/doctor/leaves/${second.body.data.id}/cancel`, { method: 'PATCH', auth: doctorToken })
})
