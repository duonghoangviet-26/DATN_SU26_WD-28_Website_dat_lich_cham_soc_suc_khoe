import 'dotenv/config'
import mongoose from 'mongoose'
import { NguoiDung, BacSi, LichLamViec, LichHen } from '../models/index.js'

// ============================================================
// Tạo 2 lịch hẹn ĐÃ THANH TOÁN cho BS. Lê Quốc Bảo, cùng ca sáng, khác khung —
// mục đích DUY NHẤT: có dữ liệu thật để test luồng "Điều phối bác sĩ" (rule mục 14/15:
// bác sĩ báo bận/nghỉ → hệ thống tự đề xuất phương án dời → lễ tân/admin duyệt).
// Idempotent: chạy lại không tạo trùng (tìm theo ma_lich_hen trước).
// KHÔNG đụng logic điều phối, KHÔNG đụng schema — chỉ tạo dữ liệu test giống pattern
// seed-doctor-test-data.js.
// ============================================================

if (process.env.NODE_ENV === 'production') {
  console.error('Khong chay script seed test khi NODE_ENV=production')
  process.exit(1)
}

const DOCTOR_EMAIL = "doctor.khang@vitafamily.vn";
const TARGET_DATE = '2026-08-29' // ngay lam viec that cua BS. Bao, con nguyen 15 khung active online

const PATIENTS = [
  { ma: 'TEST_DP_BAO_01', khung: 0, ten: 'Nguyen Van An', gioi_tinh: 'male', nam: 1990, sdt: '0909111001' },
  { ma: 'TEST_DP_BAO_02', khung: 1, ten: 'Tran Thi Binh', gioi_tinh: 'female', nam: 1993, sdt: '0909111002' },
]

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)

  const user = await NguoiDung.findOne({ email: DOCTOR_EMAIL })
  if (!user) throw new Error(`Khong tim thay tai khoan ${DOCTOR_EMAIL}`)
  const doctor = await BacSi.findOne({ user_id: user._id })
  if (!doctor) throw new Error('BS. Le Quoc Bao chua co ho so bac si')
  if (!doctor.specialties?.[0]) throw new Error('BS. Le Quoc Bao chua gan chuyen khoa')

  const targetDate = new Date(`${TARGET_DATE}T00:00:00.000Z`)
  const schedule = await LichLamViec.findOne({ doctor_id: doctor._id, ngay: targetDate })
  if (!schedule) throw new Error(`Khong tim thay lich lam viec ngay ${TARGET_DATE} cua bac si`)

  const results = []
  for (const p of PATIENTS) {
    const existed = await LichHen.findOne({ ma_lich_hen: p.ma })
    if (existed) {
      results.push({ ma: p.ma, created: false, id: String(existed._id) })
      continue
    }

    const slot = schedule.slots.find((s) => s.khung_index === p.khung && s.loai_slot === 'online')
    if (!slot) throw new Error(`Khong tim thay slot online o khung ${p.khung}`)
    if (slot.status !== 'active') throw new Error(`Slot khung ${p.khung} dang o trang thai ${slot.status}, khong the dat`)

    const now = new Date()
    const appt = await LichHen.create({
      doctor_id: doctor._id,
      schedule_id: schedule._id,
      slot_id: slot._id,
      specialty_id: doctor.specialties[0],
      loai_kham: 'clinic',
      ngay_kham: targetDate,
      gio_kham: slot.gio_bat_dau,
      gio_ket_thuc: slot.gio_ket_thuc,
      ly_do_kham: '(TEST) Kham dinh ky - du lieu test dieu phoi bac si',
      phong_kham: doctor.phong_kham_mac_dinh,
      status: 'confirmed',
      payment_status: 'paid',
      gia_kham: doctor.gia_kham,
      ten_dich_vu: 'Kham tong quat',
      ten_khach: p.ten,
      gioi_tinh_khach: p.gioi_tinh,
      nam_sinh_khach: p.nam,
      so_dien_thoai_khach: p.sdt,
      ma_lich_hen: p.ma,
      nguon: 'online',
      thoi_diem_thanh_toan: now,
      dieu_khoan_version: 'v1-test',
      dieu_khoan_dong_y_luc: now,
    })

    slot.status = 'booked'
    results.push({ ma: p.ma, created: true, id: String(appt._id) })
  }
  await schedule.save()

  console.log(JSON.stringify({
    doctor: { id: String(doctor._id), name: user.ho_ten, email: user.email },
    date: TARGET_DATE,
    scheduleId: String(schedule._id),
    appointments: results,
  }, null, 2))

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Loi khi tao du lieu test dieu phoi:', err.message)
  process.exitCode = 1
})
