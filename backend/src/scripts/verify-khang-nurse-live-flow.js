import '../config/timezone.js'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { NguoiDung, BacSi, LichLamViec, LichHen, HangDoi, KetQuaKham, SinhHieuKham } from '../models/index.js'

// READ-ONLY — kiểm chứng luồng test theo đúng logic nurse-scope. Không ghi gì.
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

const TARGET_DOCTOR_EMAIL = 'doctor.test@vitafamily.local'
const APT_PREFIX = 'LIVETEST_KH_'

function todayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return { start, end }
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  const { start, end } = todayRange()

  const doctorUser = await NguoiDung.findOne({ email: TARGET_DOCTOR_EMAIL, role: 'doctor' })
  const bacSi = await BacSi.findOne({ user_id: doctorUser._id })
  const nurse = await NguoiDung.findOne({ role: 'nurse' }).select('_id ho_ten').lean()
  const docId = bacSi._id

  // 1) nurse-scope hôm nay (LichLamViec.nurse_id) — điều kiện tiên quyết
  const scopeIds = (await LichLamViec.find({ nurse_id: nurse._id, ngay: { $gte: start, $lt: end } }).distinct('doctor_id')).map(String)
  console.log('1) getMyDoctorIdsToday(Thanh Hà) =', scopeIds)
  console.log('   → Khang(TEST) trong phạm vi?', scopeIds.includes(String(docId)) ? '✅ CÓ' : '❌ KHÔNG')

  // 2) DS lịch hẹn y tá thấy hôm nay (theo QUEUE_STATUSES)
  const QUEUE_STATUSES = ['confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm', 'completed', 'skipped']
  const appts = await LichHen.find({ doctor_id: { $in: scopeIds }, ngay_kham: { $gte: start, $lt: end } })
    .select('ma_lich_hen ten_khach status payment_status gio_kham').sort({ gio_kham: 1 }).lean()
  const shown = appts.filter((a) => QUEUE_STATUSES.includes(a.status))
  console.log(`\n2) Lịch hẹn hôm nay trong phạm vi: ${appts.length} (hiện trên DS y tá: ${shown.length})`)
  for (const a of appts) console.log(`   - [${a.ma_lich_hen ?? '—'}] ${a.gio_kham} | ${a.ten_khach} | status=${a.status}`)

  // 3) Hàng đợi hôm nay
  const queue = await HangDoi.find({ doctor_id: docId, appointment_id: { $in: appts.map((a) => a._id) } })
    .select('trang_thai ten_benh_nhan').lean()
  const byQ = {}
  for (const q of queue) byQ[q.trang_thai] = (byQ[q.trang_thai] || 0) + 1
  console.log(`\n3) Hàng đợi (HangDoi) gắn với các lịch này: ${queue.length}`, byQ)

  // 4) Hồ sơ + sinh hiệu
  const apptIds = appts.map((a) => a._id)
  const recs = await KetQuaKham.find({ appointment_id: { $in: apptIds } }).select('status').lean()
  const byR = {}
  for (const r of recs) byR[r.status] = (byR[r.status] || 0) + 1
  const vitals = await SinhHieuKham.countDocuments({ appointment_id: { $in: apptIds } })
  console.log(`\n4) Hồ sơ khám (KetQuaKham): ${recs.length}`, byR, `| Sinh hiệu: ${vitals}`)

  // 5) Hồ sơ cần nhập (pending-records)
  const pending = appts.filter((a) => ['waiting_record', 'waiting_doctor_confirm'].includes(a.status))
  console.log(`\n5) 'Hồ sơ cần nhập' (waiting_record/waiting_doctor_confirm): ${pending.length}`)

  // 6) Chỉ tính bản ghi marker LIVETEST
  const live = await LichHen.countDocuments({ ma_lich_hen: new RegExp('^' + APT_PREFIX) })
  console.log(`\n6) Tổng lịch hẹn marker ${APT_PREFIX}*: ${live}`)

  await mongoose.disconnect()
}
main().catch((e) => { console.error('❌', e.message); process.exit(1) })
