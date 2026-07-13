import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { NguoiDung, BacSi, LichHen, ThanhToan, HoaDon } from '../models/index.js'

// ============================================================
// SCRIPT CHỈ ĐỌC (READ-ONLY) — Debug: lịch đã thanh toán không hiện ở trang bác sĩ
// Chạy: node src/scripts/inspect-paid-appointments-not-showing.js
// KHÔNG update/delete/create. KHÔNG in MONGODB_URI/mat_khau/token.
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

const uri = process.env.MONGODB_URI
if (!uri) { console.error('❌ Chưa có MONGODB_URI'); process.exit(1) }

function line(t) { console.log('\n' + '='.repeat(70) + '\n' + t + '\n' + '='.repeat(70)) }

async function main() {
  console.log('⏳ Kết nối MongoDB (không in URI)...')
  await mongoose.connect(uri)
  console.log('✅ Kết nối thành công.')

  // ── 1. Giao dịch ThanhToan.status = 'paid' gần nhất ─────────────────────
  line('1. GIAO DỊCH THANH TOÁN status=paid (10 gần nhất)')
  const paidPayments = await ThanhToan.find({ status: 'paid' })
    .sort({ ngay_thanh_toan: -1 })
    .limit(10)
    .lean()
  console.log(`Tổng số ThanhToan.status='paid': ${await ThanhToan.countDocuments({ status: 'paid' })}`)
  console.log(`Lấy mẫu ${paidPayments.length} giao dịch gần nhất:`)

  const apptIds = paidPayments.map((p) => p.appointment_id).filter(Boolean)
  const appts = await LichHen.find({ _id: { $in: apptIds } }).lean()
  const apptById = new Map(appts.map((a) => [String(a._id), a]))

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today); todayEnd.setDate(todayEnd.getDate() + 1)

  for (const p of paidPayments) {
    const a = apptById.get(String(p.appointment_id))
    console.log(`\n--- ThanhToan ${p._id} (ma_giao_dich=${p.ma_giao_dich}, so_tien=${p.so_tien}) ---`)
    console.log(`  ngay_thanh_toan: ${p.ngay_thanh_toan}`)
    console.log(`  appointment_id: ${p.appointment_id}`)
    if (!a) {
      console.log('  ❌ KHÔNG TÌM THẤY appointment tương ứng trong LichHen (mồ côi)')
      continue
    }
    const isToday = a.ngay_kham >= today && a.ngay_kham < todayEnd
    console.log(`  appointment.status = ${a.status} | payment_status = ${a.payment_status}`)
    console.log(`  appointment.ngay_kham = ${a.ngay_kham?.toISOString().slice(0, 10)} | gio_kham = ${a.gio_kham} | HÔM NAY? ${isToday ? 'CÓ' : 'KHÔNG'}`)
    console.log(`  appointment.doctor_id = ${a.doctor_id ?? '(null)'}`)
    console.log(`  ma_lich_hen = ${a.ma_lich_hen ?? '(null)'}`)

    if (!a.doctor_id) {
      console.log('  ❌ appointment.doctor_id là NULL — không thể hiện ở bất kỳ trang bác sĩ nào')
      continue
    }

    const bacSi = await BacSi.findById(a.doctor_id).lean()
    if (!bacSi) {
      console.log(`  ❌ doctor_id=${a.doctor_id} KHÔNG khớp bản ghi BacSi nào (tham chiếu hỏng)`)
      continue
    }
    const doctorUser = await NguoiDung.findById(bacSi.user_id).select('ho_ten email role status').lean()
    console.log(`  BacSi._id = ${bacSi._id} → user_id = ${bacSi.user_id}`)
    console.log(`  Bác sĩ: "${doctorUser?.ho_ten}" | role=${doctorUser?.role} | status=${doctorUser?.status}`)

    if (a.payment_status === 'paid' && !isToday) {
      console.log('  ⚠️ ĐÃ PAID nhưng KHÔNG PHẢI hôm nay — nếu trang bác sĩ mặc định lọc "hôm nay", lịch này sẽ KHÔNG hiển thị trừ khi đổi bộ lọc ngày.')
    }
  }

  // ── 2. Đối chiếu ngược: appointment payment_status='paid' nhưng KHÔNG có ThanhToan tương ứng
  line('2. APPOINTMENT payment_status=paid NHƯNG KHÔNG CÓ ThanhToan (đối chiếu ngược)')
  const paidAppts = await LichHen.find({ payment_status: 'paid' }).sort({ ngay_cap_nhat: -1 }).limit(15).lean()
  console.log(`Tổng số LichHen.payment_status='paid': ${await LichHen.countDocuments({ payment_status: 'paid' })}`)
  for (const a of paidAppts) {
    const hasPayment = await ThanhToan.exists({ appointment_id: a._id, status: 'paid' })
    if (!hasPayment) {
      console.log(`  ⚠️ [${a.ma_lich_hen ?? a._id}] payment_status=paid nhưng KHÔNG có ThanhToan.status=paid tương ứng — có thể set thủ công/seed, không qua flow thanh toán thật`)
    }
  }

  // ── 3. Appointment doctor_id bị null hoặc trỏ tới BacSi không tồn tại (toàn hệ thống) ─
  line('3. APPOINTMENT CÓ doctor_id HỎNG (toàn hệ thống, không giới hạn payment)')
  const allDoctorIds = await LichHen.distinct('doctor_id')
  let brokenCount = 0
  for (const id of allDoctorIds) {
    if (!id) continue
    const exists = await BacSi.exists({ _id: id })
    if (!exists) {
      brokenCount += 1
      const count = await LichHen.countDocuments({ doctor_id: id })
      console.log(`  ❌ doctor_id=${id} không khớp BacSi nào — ảnh hưởng ${count} lịch hẹn`)
    }
  }
  console.log(`Tổng doctor_id hỏng: ${brokenCount} (trong ${allDoctorIds.length} doctor_id khác nhau đang dùng)`)
  console.log(`Số lịch hẹn có doctor_id = null: ${await LichHen.countDocuments({ doctor_id: null })}`)

  await mongoose.disconnect()
  console.log('\n✅ Hoàn tất — không có thay đổi nào được ghi vào database.')
}

main().catch((err) => {
  console.error('❌ Lỗi:', err.message)
  process.exit(1)
})
