import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import {
  NguoiDung, BacSi, ChuyenKhoa, PhongKham, LichLamViec, LichHen, KetQuaKham, NghiPhepBacSi,
} from '../models/index.js'

// ============================================================
// SEED DỮ LIỆU TEST — TRANG BÁC SĨ (chỉ tạo/bổ sung, KHÔNG xóa/ghi đè dữ liệu thật)
// Chạy: node src/scripts/seed-doctor-test-data.js  (từ thư mục backend/)
//
// An toàn / idempotent:
//   - Không deleteMany, không dropCollection.
//   - Mỗi entity được tìm trước bằng khóa duy nhất (email / ma_lich_hen / doctor_id+ngay / ...),
//     nếu đã tồn tại thì TÁI SỬ DỤNG, không tạo trùng.
//   - Toàn bộ dữ liệu test có prefix rõ ràng: "(TEST)" trong tên, "TEST_" trong ma_lich_hen/ten_khach.
//   - Chỉ tái sử dụng specialty/room/nurse/clinic đã có sẵn (không đụng dữ liệu quản lý của Admin).
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('❌ Lỗi: Chưa có MONGODB_URI trong file .env')
  process.exit(1)
}

const TEST_DOCTOR_EMAIL = 'doctor.test@vitafamily.local'
const TEST_DOCTOR_PASSWORD = 'Test123456' // chỉ dùng để hash — KHÔNG log ra console
const TEST_DOCTOR_NAME = 'BS. Trần Minh Khang (TEST)' // có hậu tố (TEST) để không trùng tên với bác sĩ demo thật đã seed trước đó
const TEST_DOCTOR_PHONE = '0909000099'
const TEST_ROOM_LABEL_FALLBACK = 'Phòng 102, Tầng 1, Tòa A'

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

// 6 ngày làm việc gần nhất kể từ hôm nay, bỏ Chủ nhật (getDay() === 0)
function next6WorkingDays(from = new Date()) {
  const days = []
  const cursor = startOfDay(from)
  while (days.length < 6) {
    if (cursor.getDay() !== 0) days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

async function findOrCreateDoctorUser() {
  let user = await NguoiDung.findOne({ email: TEST_DOCTOR_EMAIL })
  if (user) return { user, created: false }

  const hash = await bcrypt.hash(TEST_DOCTOR_PASSWORD, 10)
  user = await NguoiDung.create({
    email: TEST_DOCTOR_EMAIL,
    mat_khau: hash,
    ho_ten: TEST_DOCTOR_NAME,
    so_dien_thoai: TEST_DOCTOR_PHONE,
    role: 'doctor',
    status: 'active',
  })
  return { user, created: true }
}

async function findOrCreateDoctorProfile(userId) {
  let doc = await BacSi.findOne({ user_id: userId })
  if (doc) return { doc, created: false }

  // Tái sử dụng 1 chuyên khoa đã có sẵn (không tạo mới — đây là dữ liệu Admin quản lý)
  const specialty = await ChuyenKhoa.findOne({ ten: 'Tai Mũi Họng' }) || await ChuyenKhoa.findOne({})
  const room = await PhongKham.findOne({ ten: 'Phòng 102', toa: 'A' })
  const phongKhamMacDinh = room ? `${room.ten}, Tầng ${room.tang}, Tòa ${room.toa}` : TEST_ROOM_LABEL_FALLBACK

  doc = await BacSi.create({
    user_id: userId,
    specialties: specialty ? [specialty._id] : [],
    services: [],
    tieu_su: '(TEST) Bác sĩ dữ liệu kiểm thử — dùng để test trang bác sĩ, không phải bác sĩ thật.',
    bang_cap: 'Bác sĩ Chuyên khoa I',
    so_nam_kinh_nghiem: 8,
    gia_kham: 220000,
    phi_kham: 220000,
    tuoi_nhan_kham_tu: 0,
    trang_thai_duyet: 'approved',
    phong_kham_mac_dinh: phongKhamMacDinh,
  })
  return { doc, created: true }
}

async function findOrCreateSchedule(doctorId, ngay, slotDefs) {
  let schedule = await LichLamViec.findOne({ doctor_id: doctorId, ngay: startOfDay(ngay) })
  if (schedule) return { schedule, created: false }

  schedule = await LichLamViec.create({
    doctor_id: doctorId,
    ngay: startOfDay(ngay),
    slots: slotDefs,
  })
  return { schedule, created: true }
}

async function findOrCreateAppointment(maLichHen, buildFn) {
  let appt = await LichHen.findOne({ ma_lich_hen: maLichHen })
  if (appt) return { appt, created: false }
  appt = await LichHen.create(await buildFn())
  return { appt, created: true }
}

async function findOrCreateResult(appointmentId, buildFn) {
  let result = await KetQuaKham.findOne({ appointment_id: appointmentId })
  if (result) return { result, created: false }
  result = await KetQuaKham.create(await buildFn())
  return { result, created: true }
}

async function findOrCreateLeave(doctorId, tuNgay, buildFn) {
  let leave = await NghiPhepBacSi.findOne({ bac_si_id: doctorId, tu_ngay: startOfDay(tuNgay) })
  if (leave) return { leave, created: false }
  leave = await NghiPhepBacSi.create(await buildFn())
  return { leave, created: true }
}

async function main() {
  console.log('⏳ Đang kết nối MongoDB Cloud...')
  await mongoose.connect(uri)
  console.log('✅ Kết nối thành công (không log MONGO_URI).\n')

  const report = { created: {}, existed: {} }
  const bump = (bucket, key) => { report[bucket][key] = (report[bucket][key] || 0) + 1 }

  // ── 1. User + Doctor profile ────────────────────────────────────────────
  const { user: doctorUser, created: userCreated } = await findOrCreateDoctorUser()
  bump(userCreated ? 'created' : 'existed', 'doctor_user')

  const { doc: bacSi, created: bacSiCreated } = await findOrCreateDoctorProfile(doctorUser._id)
  bump(bacSiCreated ? 'created' : 'existed', 'doctor_profile')

  const docId = bacSi._id

  // Y tá đã có sẵn trong DB — tái sử dụng để test luồng "hồ sơ do y tá nhập"
  const nurse = await NguoiDung.findOne({ role: 'nurse' })

  // ── 2. Lịch làm việc: 6 ngày làm việc gần nhất, bỏ Chủ nhật ─────────────
  const workDays = next6WorkingDays()
  const schedules = []
  for (const day of workDays) {
    // Mỗi ngày 4 slot nửa tiếng — đủ chỗ cho appointment test + vài slot còn trống để test "còn chỗ"
    const slotDefs = [
      { gio_bat_dau: '08:00', gio_ket_thuc: '08:30', status: 'active' },
      { gio_bat_dau: '08:30', gio_ket_thuc: '09:00', status: 'active' },
      { gio_bat_dau: '13:30', gio_ket_thuc: '14:00', status: 'active' },
      { gio_bat_dau: '14:00', gio_ket_thuc: '14:30', status: 'active' },
    ]
    const { schedule, created } = await findOrCreateSchedule(docId, day, slotDefs)
    bump(created ? 'created' : 'existed', 'schedule')
    schedules.push(schedule)
  }

  // Ngày cuối cùng (workDays[5]) dùng để test lịch "đã kín chỗ" — khóa hết slot còn trống
  const fullDaySchedule = schedules[5]
  let fullDayNeedsSave = false
  fullDaySchedule.slots.forEach((s) => {
    if (s.status === 'active') { s.status = 'booked'; fullDayNeedsSave = true }
  })
  if (fullDayNeedsSave) await fullDaySchedule.save()

  // ── 3. Appointments (8 lịch hẹn, đủ trạng thái thật của hệ thống) ───────
  // Lưu ý: enum LichHen.status có 'checked_in'/'in_progress' nhưng KHÔNG route nào của hệ thống
  // hiện set 2 giá trị này (đã xác nhận qua audit code trước đó) — cố tình KHÔNG tạo dữ liệu test
  // cho 2 trạng thái này để tránh tạo dữ liệu test không phản ánh đúng nghiệp vụ thật.
  const reasons = [
    'Đau đầu kéo dài', 'Ho, sốt, đau họng', 'Đau bụng sau ăn', 'Tái khám huyết áp',
    'Mệt mỏi, chóng mặt', 'Kiểm tra sức khỏe tổng quát', 'Đau lưng', 'Khó ngủ kéo dài',
  ]
  const patients = [
    { ten: 'TEST_PATIENT_001 Nguyễn Văn Bình', gioi_tinh: 'male', nam: 1990 },
    { ten: 'TEST_PATIENT_002 Trần Thị Hoa', gioi_tinh: 'female', nam: 1985 },
    { ten: 'TEST_PATIENT_003 Lê Minh Đức', gioi_tinh: 'male', nam: 1978 },
    { ten: 'TEST_PATIENT_004 Phạm Ngọc Mai', gioi_tinh: 'female', nam: 1995 },
    { ten: 'TEST_PATIENT_005 Hoàng Tuấn Anh', gioi_tinh: 'male', nam: 2000 },
    { ten: 'TEST_PATIENT_006 Đỗ Thảo Vy', gioi_tinh: 'female', nam: 1992 },
    { ten: 'TEST_PATIENT_007 Bùi Quốc Huy', gioi_tinh: 'male', nam: 1988 },
    { ten: 'TEST_PATIENT_008 Vũ Thanh Tâm', gioi_tinh: 'female', nam: 1975 },
  ]

  // (index ngày, index slot trong ngày, trạng thái, payment_status)
  const plan = [
    { day: 0, slot: 0, status: 'pending',   payment: 'unpaid' },
    { day: 0, slot: 1, status: 'confirmed', payment: 'paid' },
    { day: 1, slot: 0, status: 'completed', payment: 'paid', result: 'cho_xac_nhan' },
    { day: 2, slot: 0, status: 'completed', payment: 'paid', result: 'da_xac_nhan' },
    { day: 3, slot: 0, status: 'completed', payment: 'paid', result: 'yeu_cau_chinh_sua' },
    { day: 4, slot: 0, status: 'cancelled', payment: 'refunded' },
    { day: 4, slot: 1, status: 'no_show',   payment: 'paid' },
    { day: 5, slot: 0, status: 'completed', payment: 'paid' }, // chưa nhập kết quả khám
  ]

  const appointments = []
  for (let i = 0; i < plan.length; i += 1) {
    const p = plan[i]
    const maLichHen = `TESTAPT${String(i + 1).padStart(3, '0')}`
    const day = workDays[p.day]
    const schedule = schedules[p.day]
    const slot = schedule.slots[p.slot]
    const patient = patients[i]

    const { appt, created } = await findOrCreateAppointment(maLichHen, async () => ({
      doctor_id: docId,
      schedule_id: schedule._id,
      slot_id: slot._id,
      loai_kham: 'clinic',
      ngay_kham: startOfDay(day),
      gio_kham: slot.gio_bat_dau,
      gio_ket_thuc: slot.gio_ket_thuc,
      ly_do_kham: reasons[i],
      phong_kham: bacSi.phong_kham_mac_dinh,
      status: p.status,
      payment_status: p.payment,
      gia_kham: bacSi.gia_kham,
      ten_dich_vu: 'Khám tổng quát',
      ten_khach: patient.ten,
      gioi_tinh_khach: patient.gioi_tinh,
      nam_sinh_khach: patient.nam,
      so_dien_thoai_khach: '09' + String(10000000 + i).padStart(8, '0'),
      ma_lich_hen: maLichHen,
      ...(p.status === 'cancelled'
        ? { ly_do_huy: 'Bác sĩ có lịch đột xuất, hủy khẩn cấp (dữ liệu test)', huy_boi: 'doctor', nguoi_huy_id: doctorUser._id, thoi_diem_huy: new Date() }
        : {}),
      ...(p.status === 'no_show' ? { no_show_confirmed_at: new Date(), trang_thai_den: 'khong_den' } : {}),
    }))
    bump(created ? 'created' : 'existed', 'appointment')

    // Đồng bộ trạng thái slot cho khớp với appointment (booked/locked) — chỉ khi vừa tạo mới
    if (created && slot.status === 'active') {
      slot.status = p.status === 'cancelled' ? 'locked' : 'booked'
      await schedule.save()
    }

    appointments.push({ ...p, appt })
  }

  // ── 4. Hồ sơ khám (KetQuaKham) cho 3 appointment cần test luồng xác nhận ─
  for (const item of appointments) {
    if (!item.result) continue
    const { appt, result: resultStatus } = item

    if (resultStatus === 'cho_xac_nhan') {
      const { created } = await findOrCreateResult(appt._id, async () => ({
        appointment_id: appt._id,
        nguoi_nhap_id: nurse ? nurse._id : doctorUser._id, // mô phỏng hồ sơ do y tá nhập (theo đúng quy ước dữ liệu demo hiện có trong DB)
        bac_si_phu_trach_id: docId,
        status: 'cho_xac_nhan',
        chan_doan: '(TEST) Viêm họng cấp, theo dõi thêm',
        huong_dan_dieu_tri: 'Uống thuốc kháng viêm, súc miệng nước muối, tái khám nếu không giảm sau 5 ngày',
        ngay_tai_kham: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      }))
      bump(created ? 'created' : 'existed', 'medical_record')
    }

    if (resultStatus === 'da_xac_nhan') {
      const now = new Date()
      const { created } = await findOrCreateResult(appt._id, async () => ({
        appointment_id: appt._id,
        nguoi_nhap_id: doctorUser._id,
        bac_si_phu_trach_id: docId,
        nguoi_xac_nhan_id: doctorUser._id,
        thoi_diem_xac_nhan: now,
        status: 'da_xac_nhan',
        chan_doan: '(TEST) Tăng huyết áp độ 1, đã ổn định',
        huong_dan_dieu_tri: 'Duy trì thuốc hạ áp theo đơn, tái khám định kỳ mỗi tháng',
        ngay_tai_kham: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      }))
      bump(created ? 'created' : 'existed', 'medical_record')
    }

    if (resultStatus === 'yeu_cau_chinh_sua') {
      const { created } = await findOrCreateResult(appt._id, async () => ({
        appointment_id: appt._id,
        nguoi_nhap_id: nurse ? nurse._id : doctorUser._id,
        bac_si_phu_trach_id: docId,
        status: 'yeu_cau_chinh_sua',
        chan_doan: '(TEST) Đau bụng chưa rõ nguyên nhân',
        lich_su_sua: [{
          nguoi_sua_id: doctorUser._id,
          thoi_diem_sua: new Date(),
          noi_dung: 'Yêu cầu chỉnh sửa: Cần bổ sung mô tả triệu chứng chi tiết hơn và kết quả xét nghiệm liên quan (dữ liệu test)',
        }],
      }))
      bump(created ? 'created' : 'existed', 'medical_record')
    }
  }

  // ── 5. Yêu cầu xin nghỉ (NghiPhepBacSi) — pending / approved / rejected ─
  const admin = await NguoiDung.findOne({ role: 'admin' })

  {
    const { created } = await findOrCreateLeave(docId, '2026-07-20', async () => ({
      bac_si_id: docId,
      tu_ngay: startOfDay('2026-07-20'),
      den_ngay: startOfDay('2026-07-20'),
      ly_do: '(TEST) Xin nghỉ khám sức khỏe định kỳ',
      trang_thai: 'cho_duyet',
    }))
    bump(created ? 'created' : 'existed', 'leave_request')
  }
  {
    const { created } = await findOrCreateLeave(docId, '2026-07-21', async () => ({
      bac_si_id: docId,
      tu_ngay: startOfDay('2026-07-21'),
      den_ngay: startOfDay('2026-07-21'),
      ly_do: '(TEST) Việc gia đình đột xuất',
      trang_thai: 'da_duyet',
      nguoi_duyet_id: admin ? admin._id : null,
      thoi_diem_duyet: new Date(),
      ghi_chu: 'Đã duyệt — đã sắp xếp bác sĩ trực thay',
    }))
    bump(created ? 'created' : 'existed', 'leave_request')
  }
  {
    const { created } = await findOrCreateLeave(docId, '2026-07-22', async () => ({
      bac_si_id: docId,
      tu_ngay: startOfDay('2026-07-22'),
      den_ngay: startOfDay('2026-07-22'),
      ly_do: '(TEST) Nghỉ phép cá nhân',
      trang_thai: 'tu_choi',
      nguoi_duyet_id: admin ? admin._id : null,
      thoi_diem_duyet: new Date(),
      ghi_chu: 'Từ chối — đã có bác sĩ khác nghỉ cùng ngày, không đủ nhân sự trực',
    }))
    bump(created ? 'created' : 'existed', 'leave_request')
  }

  // ── Báo cáo ──────────────────────────────────────────────────────────────
  console.log('# SEED DOCTOR TEST DATA RESULT\n')
  console.log('Mới tạo:', report.created)
  console.log('Đã tồn tại (bỏ qua, không tạo trùng):', report.existed)
  console.log('\nTest login:')
  console.log('  email:', TEST_DOCTOR_EMAIL)
  console.log('  password: (xem trong mã nguồn / tài liệu — không in ra log)')
  console.log('\nDoctor._id:', docId.toString())

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('❌ Lỗi khi seed dữ liệu test:', err.message)
  process.exit(1)
})
