import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

const BASE = process.env.API_BASE_URL || 'http://localhost:5000/api'
const REFERENCE_DATE = process.env.DEMO_REFERENCE_DATE || '2026-07-17'

const accounts = {
  admin: { email: 'admin@vitafamily.vn', password: '123456' },
  receptionist: { email: 'reception@vitafamily.vn', password: '123456' },
  doctor: { email: 'doctor.khang@vitafamily.vn', password: '123456' },
  otherDoctor: { email: 'doctor.an@vitafamily.vn', password: '123456' },
  patient: { email: 'patient01.demo@vitafamily.vn', password: '123456' },
}

const report = {
  pass: [],
  warn: [],
  fail: [],
}

function addResult(kind, name, detail = '') {
  report[kind].push({ name, detail })
  const icon = kind === 'pass' ? 'PASS' : kind === 'warn' ? 'WARN' : 'FAIL'
  console.log(`[${icon}] ${name}${detail ? ` - ${detail}` : ''}`)
}

function addDays(dateOnly, days) {
  const [year, month, day] = dateOnly.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function request(method, url, { token, body } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${BASE}${url}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let json = null
  try {
    json = await response.json()
  } catch {}

  return { status: response.status, json }
}

async function login(label, credentials) {
  const { status, json } = await request('POST', '/auth/login', {
    body: {
      email: credentials.email,
      mat_khau: credentials.password,
    },
  })

  if (status !== 200 || !json?.data?.token) {
    throw new Error(`Dang nhap that bai cho ${label} (${credentials.email})`)
  }

  addResult('pass', `Dang nhap ${label}`, credentials.email)
  return json.data.token
}

function extractList(data) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.payments)) return data.payments
  if (Array.isArray(data?.appointments)) return data.appointments
  if (Array.isArray(data?.rows)) return data.rows
  return []
}

async function findBookableSlot() {
  const { status, json } = await request('GET', '/patient/booking/doctors')
  if (status !== 200 || !Array.isArray(json?.data) || json.data.length === 0) {
    throw new Error('Khong lay duoc danh sach bac si cong khai')
  }

  const doctors = json.data
  for (const doctor of doctors) {
    for (let offset = 1; offset <= 14; offset += 1) {
      const date = addDays(REFERENCE_DATE, offset)
      const slotResponse = await request('GET', `/patient/booking/doctors/${doctor.id}/slots?date=${date}`)
      const slots = slotResponse.json?.data || []
      if (slotResponse.status === 200 && Array.isArray(slots) && slots.length > 0) {
        return { doctor, date, slot: slots[0] }
      }
    }
  }

  return null
}

async function runSecurityCheck() {
  const { status } = await request('GET', '/receptionist/appointments')
  if (status === 401 || status === 403) {
    addResult('pass', 'Bao ve API le tan khi khong co token', `status=${status}`)
    return
  }

  addResult('fail', 'API le tan dang lo du lieu khi khong co token', `status=${status}, mong doi 401/403`)
}

async function runAdminChecks(adminToken) {
  const summary = await request('GET', '/admin/dashboard', { token: adminToken })
  if (summary.status === 200 && summary.json?.data) {
    const data = summary.json.data
    addResult(
      'pass',
      'Admin dashboard',
      `appointments_today=${data.appointments_today}, doctors_active=${data.doctors_active}, revenue=${data.revenue}`,
    )
  } else {
    addResult('fail', 'Admin dashboard', `status=${summary.status}`)
  }

  const appointments = await request('GET', '/admin/appointments?page=1&limit=5', { token: adminToken })
  const appointmentList = extractList(appointments.json?.data)
  if (appointments.status === 200 && appointmentList.length > 0) {
    addResult('pass', 'Admin xem danh sach lich hen', `sample_count=${appointmentList.length}`)
  } else {
    addResult('fail', 'Admin xem danh sach lich hen', `status=${appointments.status}`)
  }

  const payments = await request('GET', '/admin/payments', { token: adminToken })
  if (payments.status === 200) {
    const paymentList = extractList(payments.json?.data)
    addResult('pass', 'Admin xem danh sach thanh toan', `sample_count=${paymentList.length}`)
  } else {
    addResult('fail', 'Admin xem danh sach thanh toan', `status=${payments.status}`)
  }
}

async function runPatientChecks(patientToken) {
  const family = await request('GET', '/patient/family', { token: patientToken })
  const members = family.json?.data?.members || []
  if (family.status !== 200 || members.length === 0) {
    addResult('fail', 'Benh nhan xem ho so gia dinh', `status=${family.status}`)
    return
  }

  addResult('pass', 'Benh nhan xem ho so gia dinh', `members=${members.length}`)

  const slotCandidate = await findBookableSlot()
  if (!slotCandidate) {
    addResult('fail', 'Tim slot de dat lich', `Khong tim thay slot trong 14 ngay sau ${REFERENCE_DATE}`)
    return
  }

  addResult(
    'pass',
    'Tim slot de dat lich',
    `${slotCandidate.doctor.ho_ten} - ${slotCandidate.date} ${slotCandidate.slot.gio_bat_dau}`,
  )

  const createBooking = await request('POST', '/patient/booking', {
    token: patientToken,
    body: {
      loai_kham: 'clinic',
      doctor_id: slotCandidate.doctor.id,
      schedule_id: slotCandidate.slot.schedule_id,
      slot_id: slotCandidate.slot.id,
      ngay_kham: slotCandidate.date,
      ly_do_kham: 'Codex demo flow test',
      member_id: members[0].id,
    },
  })

  const appointmentId = createBooking.json?.data?.id
  if (createBooking.status !== 201 || !appointmentId) {
    addResult('fail', 'Benh nhan dat lich', `status=${createBooking.status}`)
    return
  }

  addResult(
    'pass',
    'Benh nhan dat lich',
    `appointment_id=${appointmentId}, ngay=${slotCandidate.date}, gio=${slotCandidate.slot.gio_bat_dau}`,
  )

  const cancelBooking = await request('PATCH', `/patient/booking/${appointmentId}/cancel`, {
    token: patientToken,
    body: { ly_do_huy: 'Codex cleanup after live flow test' },
  })

  if (cancelBooking.status === 200 && cancelBooking.json?.data?.status === 'cancelled') {
    addResult('pass', 'Benh nhan huy lich vua tao', `appointment_id=${appointmentId}`)
  } else {
    addResult('fail', 'Benh nhan huy lich vua tao', `status=${cancelBooking.status}`)
  }
}

async function runReceptionistChecks(receptionToken) {
  const appointments = await request('GET', '/receptionist/appointments?timeframe=today', { token: receptionToken })
  if (appointments.status === 200) {
    const list = extractList(appointments.json?.data)
    addResult('pass', 'Le tan xem lich hen hom nay', `count=${list.length}`)
  } else {
    addResult('fail', 'Le tan xem lich hen hom nay', `status=${appointments.status}`)
  }

  const doctors = await request('GET', '/receptionist/booking/doctors', { token: receptionToken })
  if (doctors.status === 200) {
    const list = extractList(doctors.json?.data)
    addResult('pass', 'Le tan tra cuu danh sach bac si dat ho', `count=${list.length}`)
  } else {
    addResult('fail', 'Le tan tra cuu danh sach bac si dat ho', `status=${doctors.status}`)
  }

  const payments = await request('GET', '/receptionist/payments', { token: receptionToken })
  if (payments.status === 200) {
    const list = extractList(payments.json?.data)
    addResult('pass', 'Le tan xem danh sach thanh toan', `count=${list.length}`)
  } else {
    addResult('fail', 'Le tan xem danh sach thanh toan', `status=${payments.status}`)
  }
}

async function runDoctorChecks(doctorToken, otherDoctorToken) {
  const profile = await request('GET', '/doctor/profile', { token: doctorToken })
  if (profile.status === 200 && profile.json?.data) {
    addResult('pass', 'Bac si xem ho so ca nhan', profile.json.data.ho_ten || 'ok')
  } else {
    addResult('fail', 'Bac si xem ho so ca nhan', `status=${profile.status}`)
  }

  const stats = await request('GET', '/doctor/stats', { token: doctorToken })
  if (stats.status === 200 && stats.json?.data) {
    addResult('pass', 'Bac si xem dashboard thong ke', 'ok')
  } else {
    addResult('fail', 'Bac si xem dashboard thong ke', `status=${stats.status}`)
  }

  const appointments = await request('GET', `/doctor/appointments?date=${REFERENCE_DATE}`, { token: doctorToken })
  const list = appointments.json?.data || []
  if (appointments.status !== 200 || !Array.isArray(list) || list.length === 0) {
    addResult('fail', 'Bac si xem lich hen theo ngay', `status=${appointments.status}`)
    return
  }

  addResult('pass', 'Bac si xem lich hen theo ngay', `date=${REFERENCE_DATE}, count=${list.length}`)

  const sample = list[0]
  const detail = await request('GET', `/doctor/appointments/${sample.id}`, { token: doctorToken })
  if (detail.status === 200 && detail.json?.data) {
    addResult('pass', 'Bac si xem chi tiet lich hen', `${sample.ma_lich_hen || sample.id}`)
  } else {
    addResult('fail', 'Bac si xem chi tiet lich hen', `status=${detail.status}`)
  }

  const withResult = list.find((item) => item.da_co_ket_qua)
  if (withResult) {
    const result = await request('GET', `/doctor/appointments/${withResult.id}/result`, { token: doctorToken })
    if (result.status === 200 && result.json?.data) {
      addResult('pass', 'Bac si xem ket qua kham', `${withResult.ma_lich_hen || withResult.id}`)
    } else {
      addResult('fail', 'Bac si xem ket qua kham', `status=${result.status}`)
    }
  } else {
    addResult('warn', 'Bac si xem ket qua kham', `Khong co lich nao trong ngay ${REFERENCE_DATE} da co ket qua`)
  }

  const pendingResults = await request('GET', '/doctor/appointments/pending-results', { token: doctorToken })
  if (pendingResults.status === 200) {
    const count = Array.isArray(pendingResults.json?.data) ? pendingResults.json.data.length : 0
    if (count > 0) {
      addResult('pass', 'Bac si co ho so cho xac nhan', `count=${count}`)
    } else {
      addResult('warn', 'Bac si co ho so cho xac nhan', `Khong co du lieu seed cho man pending-results tai thoi diem test`)
    }
  } else {
    addResult('fail', 'Bac si xem ho so cho xac nhan', `status=${pendingResults.status}`)
  }

  if (otherDoctorToken) {
    const leakCheck = await request('GET', `/doctor/appointments/${sample.id}`, { token: otherDoctorToken })
    if (leakCheck.status === 404 || leakCheck.status === 403) {
      addResult('pass', 'Phan quyen giua hai bac si', `status=${leakCheck.status}`)
    } else {
      addResult('fail', 'Phan quyen giua hai bac si', `status=${leakCheck.status}, mong doi 404/403`)
    }
  }
}

function printSummary() {
  console.log('\n=== TONG KET ===')
  console.log(`PASS: ${report.pass.length}`)
  console.log(`WARN: ${report.warn.length}`)
  console.log(`FAIL: ${report.fail.length}`)
}

async function main() {
  console.log(`# LIVE DEMO ROLE FLOW CHECK`)
  console.log(`# Base: ${BASE}`)
  console.log(`# Reference date: ${REFERENCE_DATE}\n`)

  await runSecurityCheck()

  const adminToken = await login('admin', accounts.admin)
  const receptionistToken = await login('receptionist', accounts.receptionist)
  const doctorToken = await login('doctor', accounts.doctor)
  const patientToken = await login('patient', accounts.patient)

  let otherDoctorToken = null
  try {
    otherDoctorToken = await login('other doctor', accounts.otherDoctor)
  } catch (error) {
    addResult('warn', 'Dang nhap bac si thu hai de kiem tra phan quyen', error.message)
  }

  await runAdminChecks(adminToken)
  await runPatientChecks(patientToken)
  await runReceptionistChecks(receptionistToken)
  await runDoctorChecks(doctorToken, otherDoctorToken)

  printSummary()

  if (report.fail.length > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`\n[ERROR] ${error.message}`)
  process.exit(1)
})
