import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// ============================================================
// SCRIPT KIỂM TRA API TRANG BÁC SĨ (chỉ đọc/gọi API, không sửa dữ liệu ngoài
// những action test rõ ràng an toàn). Yêu cầu: đã chạy seed-doctor-test-data.js
// và server backend đang chạy (mặc định http://localhost:5000/api).
// Chạy: node src/scripts/test-doctor-page-api.js
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

const BASE = process.env.API_BASE_URL || 'http://localhost:5000/api'

const DOCTOR_EMAIL = 'doctor.test@vitafamily.local'
const OTHER_DOCTOR_EMAIL = 'doctor.other.test@vitafamily.local'
const PASSWORD = 'Test123456' // khớp seed-doctor-test-data.js — không log ra

let passCount = 0
let failCount = 0

function report(label, ok, detail = '') {
  const icon = ok ? '✅' : '❌'
  console.log(`${icon} ${label}${detail ? ' — ' + detail : ''}`)
  if (ok) passCount += 1; else failCount += 1
}

async function request(method, url, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try { json = await res.json() } catch { /* no body */ }
  return { status: res.status, json }
}

async function login(email) {
  const { status, json } = await request('POST', '/auth/login', { body: { email, mat_khau: PASSWORD } })
  if (status !== 200 || !json?.data?.token) {
    throw new Error(`Đăng nhập thất bại cho ${email} (status ${status}): ${json?.message}`)
  }
  return json.data.token
}

async function main() {
  console.log(`# TEST DOCTOR PAGE API — base: ${BASE}\n`)

  // ── 0. Chưa đăng nhập → 401 ─────────────────────────────────────────────
  {
    const { status } = await request('GET', '/doctor/appointments')
    report('GET /doctor/appointments (không token) → 401', status === 401, `status=${status}`)
  }

  const doctorToken = await login(DOCTOR_EMAIL)
  const otherDoctorToken = await login(OTHER_DOCTOR_EMAIL)
  report('Đăng nhập bác sĩ chính', true)
  report('Đăng nhập bác sĩ khác', true)

  // ── 1. Profile ───────────────────────────────────────────────────────────
  {
    const { status, json } = await request('GET', '/doctor/profile', { token: doctorToken })
    report('GET /doctor/profile', status === 200 && !!json?.data, `status=${status}`)
  }

  // ── 2. Dashboard/Stats ───────────────────────────────────────────────────
  {
    const { status, json } = await request('GET', '/doctor/stats', { token: doctorToken })
    report('GET /doctor/stats', status === 200 && !!json?.data, `status=${status}`)
  }
  {
    const { status, json } = await request('GET', '/doctor/stats/today', { token: doctorToken })
    const d = json?.data
    report(
      'GET /doctor/stats/today',
      status === 200 && !!d,
      `status=${status} tong_lich_hen=${d?.tong_lich_hen} y_ta_ho_tro=${JSON.stringify(d?.y_ta_ho_tro)}`,
    )
  }

  // ── 3. Lịch làm việc ─────────────────────────────────────────────────────
  let scheduleCount = 0
  {
    const { status, json } = await request('GET', '/doctor/schedule', { token: doctorToken })
    scheduleCount = Array.isArray(json?.data) ? json.data.length : 0
    report('GET /doctor/schedule', status === 200 && scheduleCount > 0, `status=${status} slots=${scheduleCount}`)
  }

  // ── 4. Danh sách lịch hẹn (không filter + filter theo status) ───────────
  let appointments = []
  {
    const { status, json } = await request('GET', '/doctor/appointments', { token: doctorToken })
    appointments = Array.isArray(json?.data) ? json.data : []
    report('GET /doctor/appointments (tất cả)', status === 200 && appointments.length > 0, `status=${status} count=${appointments.length}`)
  }
  {
    const { status, json } = await request('GET', '/doctor/appointments?status=completed', { token: doctorToken })
    const list = Array.isArray(json?.data) ? json.data : []
    const allCompleted = list.every((a) => a.status === 'completed')
    report('GET /doctor/appointments?status=completed', status === 200 && allCompleted, `status=${status} count=${list.length}`)
  }
  {
    const withRecord = appointments.find((a) => a.da_co_ket_qua)
    report(
      'Danh sách lịch hẹn có field populate đủ (benh_nhan, ten_dich_vu, phong_kham, ket_qua_status)',
      !!withRecord && !!withRecord.benh_nhan && withRecord.ten_dich_vu !== undefined && withRecord.phong_kham !== undefined,
      withRecord ? `vd: ${withRecord.ma_lich_hen} → ket_qua_status=${withRecord.ket_qua_status}` : 'không có bản ghi nào da_co_ket_qua=true',
    )
  }

  // ── 5. Chi tiết 1 lịch hẹn ───────────────────────────────────────────────
  const sample = appointments[0]
  if (sample) {
    const { status, json } = await request('GET', `/doctor/appointments/${sample.id}`, { token: doctorToken })
    report('GET /doctor/appointments/:id', status === 200 && !!json?.data, `status=${status}`)
  }

  // ── 6. Hồ sơ khám: GET result cho appointment đã có kết quả ─────────────
  const withResult = appointments.find((a) => a.da_co_ket_qua)
  if (withResult) {
    const { status, json } = await request('GET', `/doctor/appointments/${withResult.id}/result`, { token: doctorToken })
    const d = json?.data
    report(
      'GET /doctor/appointments/:id/result',
      status === 200 && !!d?.chan_doan,
      `status=${status} status_ho_so=${d?.status} thuoc=${d?.thuoc?.length ?? 0} món`,
    )
  }

  // ── 7. Hồ sơ chờ xác nhận ────────────────────────────────────────────────
  {
    const { status, json } = await request('GET', '/doctor/appointments/pending-results', { token: doctorToken })
    const list = Array.isArray(json?.data) ? json.data : []
    report('GET /doctor/appointments/pending-results', status === 200 && list.length > 0, `status=${status} count=${list.length}`)
  }

  // ── 8. Xin nghỉ ──────────────────────────────────────────────────────────
  {
    const { status, json } = await request('GET', '/doctor/leaves', { token: doctorToken })
    const list = Array.isArray(json?.data) ? json.data : []
    report('GET /doctor/leaves', status === 200 && list.length > 0, `status=${status} count=${list.length}`)
  }

  // ── 9. PHÂN QUYỀN: bác sĩ chính không được thấy dữ liệu bác sĩ khác ─────
  {
    const { status, json } = await request('GET', '/doctor/appointments', { token: otherDoctorToken })
    const list = Array.isArray(json?.data) ? json.data : []
    const leaked = list.some((a) => appointments.some((mine) => mine.id === a.id))
    report(
      'Bác sĩ khác đăng nhập KHÔNG thấy lịch hẹn của bác sĩ chính (và ngược lại không lẫn)',
      status === 200 && !leaked && list.length > 0,
      `status=${status} count(bac_si_khac)=${list.length} leaked=${leaked}`,
    )
  }
  if (sample) {
    const { status } = await request('GET', `/doctor/appointments/${sample.id}`, { token: otherDoctorToken })
    report(
      'Bác sĩ khác KHÔNG xem được chi tiết appointment của bác sĩ chính',
      status === 404 || status === 403,
      `status=${status} (mong đợi 404/403)`,
    )
  }
  if (withResult) {
    const { status } = await request(
      'PATCH',
      `/doctor/appointments/${withResult.id}/result/confirm`,
      { token: otherDoctorToken },
    )
    report(
      'Bác sĩ khác KHÔNG xác nhận được hồ sơ khám của bác sĩ chính',
      status === 404 || status === 403,
      `status=${status} (mong đợi 404/403)`,
    )
  }

  // ── 10. Sai trạng thái → 409 ─────────────────────────────────────────────
  const completed = appointments.find((a) => a.status === 'completed')
  if (completed) {
    const { status } = await request('PATCH', `/doctor/appointments/${completed.id}/complete`, { token: doctorToken })
    report(
      'PATCH .../complete trên lịch hẹn đã completed → 409',
      status === 409,
      `status=${status} (mong đợi 409)`,
    )
  }

  console.log(`\n# KẾT QUẢ: ${passCount} pass / ${failCount} fail`)
  if (failCount > 0) process.exit(1)
}

main().catch((err) => {
  console.error('❌ Lỗi khi chạy test API:', err.message)
  process.exit(1)
})
