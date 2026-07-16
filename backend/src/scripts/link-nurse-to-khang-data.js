import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { NguoiDung, BacSi, LichLamViec, LichHen } from '../models/index.js'

// ============================================================
// SCRIPT UPDATE — Gắn nurse_id (y tá có sẵn) vào dữ liệu của bác sĩ Khang (TEST)
// Chạy: node src/scripts/link-nurse-to-khang-data.js  (từ thư mục backend/)
//
// Phạm vi CHỈ:
//   - LichLamViec.nurse_id, LichHen.nurse_id — CHỈ cho doctor_id của "BS. Trần Minh Khang (TEST)".
//   - Không đụng bác sĩ khác, không đụng patient, không đụng payment_status/doctor_id.
//   - Không tạo appointment/patient mới, không tạo y tá mới (tái sử dụng y tá có sẵn).
//   - Idempotent: chỉ set nurse_id cho bản ghi đang null — chạy lại nhiều lần không đổi gì thêm.
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('❌ Lỗi: Chưa có MONGODB_URI trong file .env')
  process.exit(1)
}

const TARGET_DOCTOR_EMAIL = 'doctor.test@vitafamily.local' // BS. Trần Minh Khang (TEST) — đã xác nhận với người dùng

function maskEmail(email) {
  if (!email) return null
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  return `${local.slice(0, 2)}***@${domain}`
}

async function main() {
  console.log('⏳ Đang kết nối MongoDB (không in URI)...')
  await mongoose.connect(uri)
  console.log('✅ Kết nối thành công.\n')

  // ── 1. Xác định lại đúng bác sĩ Khang (TEST) — không tin ID hard-code, tra lại theo email ──
  const doctorUser = await NguoiDung.findOne({ email: TARGET_DOCTOR_EMAIL, role: 'doctor' })
  if (!doctorUser) {
    console.error(`❌ Không tìm thấy user role=doctor với email ${TARGET_DOCTOR_EMAIL}. Dừng lại, không update gì.`)
    await mongoose.disconnect()
    process.exit(1)
  }
  const bacSi = await BacSi.findOne({ user_id: doctorUser._id })
  if (!bacSi) {
    console.error('❌ Không tìm thấy hồ sơ BacSi liên kết. Dừng lại, không update gì.')
    await mongoose.disconnect()
    process.exit(1)
  }
  const docId = bacSi._id
  console.log(`✅ Bác sĩ mục tiêu: "${doctorUser.ho_ten}" (doctor_id=${docId})`)

  // ── 2. Tái sử dụng y tá có sẵn (đã xác nhận với người dùng — không tạo mới) ─────────
  const nurses = await NguoiDung.find({ role: 'nurse' }).select('_id ho_ten email status').lean()
  if (nurses.length === 0) {
    console.error('❌ Không có tài khoản y tá nào trong DB (role=\'nurse\'). Dừng lại — không tự tạo y tá mới trong script này.')
    await mongoose.disconnect()
    process.exit(1)
  }
  if (nurses.length > 1) {
    console.error(`❌ Có ${nurses.length} tài khoản y tá — script cần đúng 1 để tránh gắn nhầm. Dừng lại, chưa update gì. Hãy chỉ định rõ nurse_id nếu muốn tiếp tục.`)
    await mongoose.disconnect()
    process.exit(1)
  }
  const nurse = nurses[0]
  console.log(`✅ Y tá tái sử dụng: "${nurse.ho_ten}" (nurse_id=${nurse._id}, email=${maskEmail(nurse.email)}, status=${nurse.status})`)

  if (nurse.status !== 'active') {
    console.warn(`⚠️ Cảnh báo: tài khoản y tá đang status="${nurse.status}", không phải "active" — vẫn tiếp tục gắn dữ liệu, nhưng y tá có thể không đăng nhập được cho tới khi active.`)
  }

  // ── 3. Gắn nurse_id vào LichLamViec — CHỈ bản ghi đang null, CHỈ của bác sĩ này ─────
  const scheduleResult = await LichLamViec.updateMany(
    { doctor_id: docId, nurse_id: null },
    { $set: { nurse_id: nurse._id } },
  )
  console.log(`\nLichLamViec: đã gắn nurse_id cho ${scheduleResult.modifiedCount} bản ghi (khớp ${scheduleResult.matchedCount}).`)

  const scheduleAlready = await LichLamViec.countDocuments({ doctor_id: docId, nurse_id: nurse._id })
  console.log(`Tổng số lịch làm việc của bác sĩ này đã có nurse_id=${nurse._id}: ${scheduleAlready}`)

  // ── 4. Gắn nurse_id vào LichHen — CHỈ bản ghi đang null, CHỈ của bác sĩ này ────────
  const apptResult = await LichHen.updateMany(
    { doctor_id: docId, nurse_id: null },
    { $set: { nurse_id: nurse._id } },
  )
  console.log(`\nLichHen: đã gắn nurse_id cho ${apptResult.modifiedCount} bản ghi (khớp ${apptResult.matchedCount}).`)

  const apptAlready = await LichHen.countDocuments({ doctor_id: docId, nurse_id: nurse._id })
  console.log(`Tổng số lịch hẹn của bác sĩ này đã có nurse_id=${nurse._id}: ${apptAlready}`)

  // ── 5. Xác nhận không đụng bác sĩ/dữ liệu khác ─────────────────────────────────────
  const otherDoctorsAffected = await LichHen.countDocuments({ doctor_id: { $ne: docId }, nurse_id: nurse._id })
  console.log(`\nKiểm tra an toàn: số lịch hẹn của BÁC SĨ KHÁC bị gắn nurse_id ngoài ý muốn: ${otherDoctorsAffected} (phải = 0)`)

  await mongoose.disconnect()
  console.log('\n✅ Hoàn tất. Không tạo bệnh nhân/lịch hẹn mới, không sửa payment_status/doctor_id, không tạo y tá mới.')
}

main().catch((err) => {
  console.error('❌ Lỗi khi update:', err.message)
  process.exit(1)
})
