import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  NguoiDung, BacSi, LichLamViec, LichHen, KetQuaKham,
  SinhHieuKham, DonThuoc, HoaDon, ThanhToan, ThanhVien,
} from '../models/index.js'

// ============================================================
// SCRIPT CHỈ ĐỌC (READ-ONLY) — Kiểm tra dữ liệu thật liên quan bác sĩ "Khang"
// Chạy: node src/scripts/inspect-khang-doctor-data.js  (từ thư mục backend/)
//
// KHÔNG update/delete/create/seed/migration — chỉ find/countDocuments/aggregate.
// KHÔNG in MONGODB_URI, mat_khau, token, secret ra console.
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('❌ Lỗi: Chưa có MONGODB_URI trong file .env')
  process.exit(1)
}

function maskPhone(phone) {
  if (!phone) return null
  const s = String(phone)
  return s.length <= 3 ? '***' : '*'.repeat(s.length - 3) + s.slice(-3)
}

function maskEmail(email) {
  if (!email) return null
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  return `${local.slice(0, 2)}***@${domain}`
}

function line(title) {
  console.log('\n' + '='.repeat(70))
  console.log(title)
  console.log('='.repeat(70))
}

async function analyzeDoctorDeep(doctorUser, bacSi, nurses) {
  const docId = bacSi._id
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1)

  line(`LỊCH LÀM VIỆC — ${doctorUser.ho_ten} (doctor_id=${docId})`)
  const schedules = await LichLamViec.find({ doctor_id: docId }).sort({ ngay: 1 }).lean()
  console.log(`Tổng số bản ghi lịch làm việc: ${schedules.length}`)
  let todaySchedule = null
  for (const s of schedules) {
    const isToday = s.ngay >= todayStart && s.ngay < todayEnd
    if (isToday) todaySchedule = s
    const bookedSlots = (s.slots || []).filter((sl) => sl.status !== 'active').length
    console.log(`  - ${s.ngay.toISOString().slice(0, 10)}${isToday ? ' (HÔM NAY)' : ''} | ${s.slots.length} slot, ${bookedSlots} đã đặt/khóa | phòng: ${[...new Set(s.slots.map((sl) => sl.phong_kham).filter(Boolean))].join(', ') || '(không có)'}`)
  }
  console.log(`Có lịch làm việc hôm nay? ${todaySchedule ? 'CÓ' : 'KHÔNG'}`)

  line(`LỊCH HẸN (LichHen) — ${doctorUser.ho_ten}`)
  const appts = await LichHen.find({ doctor_id: docId })
    .populate('member_id', 'ho_ten ngay_sinh gioi_tinh benh_nen di_ung')
    .sort({ ngay_kham: 1, gio_kham: 1 })
    .lean()
  console.log(`Tổng số lịch hẹn: ${appts.length}`)

  const byStatus = {}
  for (const a of appts) byStatus[a.status] = (byStatus[a.status] || 0) + 1
  console.log('Theo trạng thái:', byStatus)

  const byPayment = {}
  for (const a of appts) byPayment[a.payment_status] = (byPayment[a.payment_status] || 0) + 1
  console.log('Theo thanh toán:', byPayment)

  const todayAppts = appts.filter((a) => a.ngay_kham >= todayStart && a.ngay_kham < todayEnd)
  console.log(`Lịch hẹn hôm nay: ${todayAppts.length}`)

  console.log('\nChi tiết (đã che SĐT):')
  for (const a of appts) {
    const benhNhan = a.member_id?.ho_ten ?? a.ten_khach ?? '(không rõ)'
    const phone = maskPhone(a.so_dien_thoai_khach)
    console.log(`  - [${a.ma_lich_hen ?? a._id}] ${a.ngay_kham.toISOString().slice(0, 10)} ${a.gio_kham} | BN: ${benhNhan} (${phone ?? 'không có SĐT'}) | status=${a.status} | payment=${a.payment_status} | loai_kham=${a.loai_kham}`)
  }

  line(`BỆNH NHÂN LIÊN QUAN — ${doctorUser.ho_ten}`)
  const memberIdsOfDoc = [...new Set(appts.filter((a) => a.member_id).map((a) => String(a.member_id._id)))]
  const guestNamesOfDoc = [...new Set(appts.filter((a) => !a.member_id && a.ten_khach).map((a) => a.ten_khach))]
  console.log(`Bệnh nhân có tài khoản: ${memberIdsOfDoc.length} | Khách vãng lai: ${guestNamesOfDoc.length}`)
  const seenMember = new Set()
  for (const a of appts) {
    if (!a.member_id || seenMember.has(String(a.member_id._id))) continue
    seenMember.add(String(a.member_id._id))
    const m = a.member_id
    const tuoi = m.ngay_sinh ? new Date().getFullYear() - new Date(m.ngay_sinh).getFullYear() : '(không có ngày sinh)'
    console.log(`  - ${m.ho_ten} | tuổi=${tuoi} | giới tính=${m.gioi_tinh ?? '(không có)'} | bệnh nền=${m.benh_nen ? 'CÓ' : 'không có'} | dị ứng=${m.di_ung ? 'CÓ' : 'không có'}`)
  }
  if (guestNamesOfDoc.length) {
    console.log('Khách vãng lai:', guestNamesOfDoc.join(', '))
  }

  line(`HỒ SƠ KHÁM (KetQuaKham) — ${doctorUser.ho_ten}`)
  const apptIds = appts.map((a) => a._id)
  const records = await KetQuaKham.find({ appointment_id: { $in: apptIds } }).lean()
  console.log(`Tổng số hồ sơ khám: ${records.length}`)
  const byRecordStatus = {}
  for (const r of records) byRecordStatus[r.status] = (byRecordStatus[r.status] || 0) + 1
  console.log('Theo trạng thái hồ sơ:', byRecordStatus)
  const missingNguoiNhap = records.filter((r) => !r.nguoi_nhap_id).length
  console.log(`Hồ sơ thiếu nguoi_nhap_id: ${missingNguoiNhap}`)

  const vitalsCount = await SinhHieuKham.countDocuments({ appointment_id: { $in: apptIds } })
  const rxCount = await DonThuoc.countDocuments({ ket_qua_kham_id: { $in: records.map((r) => r._id) } })
  console.log(`Sinh hiệu liên quan: ${vitalsCount} | Đơn thuốc liên quan: ${rxCount}`)

  line(`PAYMENT/INVOICE — ${doctorUser.ho_ten}`)
  const invoiceCount = await HoaDon.countDocuments({ appointment_id: { $in: apptIds } })
  const paymentTxCount = await ThanhToan.countDocuments({ appointment_id: { $in: apptIds } })
  console.log(`HoaDon liên quan: ${invoiceCount} | ThanhToan liên quan: ${paymentTxCount}`)
  const paidCount = appts.filter((a) => a.payment_status === 'paid').length
  console.log(`Lịch hẹn payment_status='paid': ${paidCount} (đối chiếu ${invoiceCount} hóa đơn + ${paymentTxCount} giao dịch thật)`)
  const unpaidButCompleted = appts.filter((a) => a.status === 'completed' && a.payment_status === 'unpaid').length
  console.log(`Lịch hẹn COMPLETED nhưng UNPAID: ${unpaidButCompleted}`)

  line(`TỔNG KẾT — ${doctorUser.ho_ten}`)
  console.log(`doctor_id=${docId} | user_id=${doctorUser._id}`)
  console.log(`Lịch làm việc: ${schedules.length} | Lịch hẹn: ${appts.length} | Hồ sơ khám: ${records.length}`)
  console.log(`Bệnh nhân có tài khoản: ${memberIdsOfDoc.length} | Khách vãng lai: ${guestNamesOfDoc.length}`)
  console.log(`Y tá hệ thống hiện có (chưa gắn field nào — nurse_id không tồn tại trên LichHen/LichLamViec/KetQuaKham): ${nurses.length}`)
}

async function main() {
  console.log('⏳ Đang kết nối MongoDB (không in URI)...')
  await mongoose.connect(uri)
  console.log('✅ Kết nối thành công.')

  line('1. TÌM BÁC SĨ "KHANG"')
  const candidateUsers = await NguoiDung.find({
    $or: [{ ho_ten: /khang/i }, { email: /khang/i }],
  }).select('_id ho_ten email so_dien_thoai role status').lean()

  console.log(`Số user khớp từ khóa "khang": ${candidateUsers.length}`)
  for (const u of candidateUsers) {
    console.log(`  - _id=${u._id} | ho_ten="${u.ho_ten}" | email=${maskEmail(u.email)} | role=${u.role} | status=${u.status}`)
  }

  const doctorUsers = candidateUsers.filter((u) => u.role === 'doctor')
  if (doctorUsers.length === 0) {
    console.log('\n❌ KHÔNG tìm thấy user role=doctor khớp "khang".')
    await mongoose.disconnect()
    return
  }
  if (doctorUsers.length > 1) {
    console.log(`\n⚠️ CÓ ${doctorUsers.length} bác sĩ khác nhau khớp "khang" — phân tích riêng từng người bên dưới.`)
  }

  line('2. Y TÁ HIỆN CÓ TRONG HỆ THỐNG (chung, không riêng theo bác sĩ)')
  const nurses = await NguoiDung.find({ role: 'nurse' }).select('_id ho_ten email status').lean()
  console.log(`Tổng số NguoiDung role='nurse': ${nurses.length}`)
  for (const n of nurses) {
    console.log(`  - _id=${n._id} | ho_ten="${n.ho_ten}" | email=${maskEmail(n.email)} | status=${n.status}`)
  }

  for (const doctorUser of doctorUsers) {
    line(`3. HỒ SƠ BacSi — ${doctorUser.ho_ten} (${maskEmail(doctorUser.email)})`)
    const bacSi = await BacSi.findOne({ user_id: doctorUser._id }).populate('specialties', 'ten').lean()
    if (!bacSi) {
      console.log('❌ Không có hồ sơ BacSi liên kết user này.')
      continue
    }
    console.log(`doctor_id=${bacSi._id}`)
    console.log(`specialties: ${(bacSi.specialties || []).map((s) => s.ten).join(', ') || '(không có)'}`)
    console.log(`trang_thai_duyet: ${bacSi.trang_thai_duyet} | phong_kham_mac_dinh: ${bacSi.phong_kham_mac_dinh || '(không có)'} | gia_kham: ${bacSi.gia_kham}`)

    await analyzeDoctorDeep(doctorUser, bacSi, nurses)
  }

  await mongoose.disconnect()
  console.log('\n✅ Hoàn tất — không có thay đổi nào được ghi vào database.')
}

main().catch((err) => {
  console.error('❌ Lỗi khi đọc dữ liệu:', err.message)
  process.exit(1)
})
