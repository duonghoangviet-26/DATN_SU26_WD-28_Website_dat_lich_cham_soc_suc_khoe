import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import {
  NguoiDung, BacSi, ChuyenKhoa, PhongKham, LichLamViec, LichHen, KetQuaKham, NghiPhepBacSi,
  GiaDinh, ThanhVien, DonThuoc, SinhHieuKham,
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

if (process.env.NODE_ENV === 'production') {
  console.error('❌ Không chạy script seed dữ liệu test khi NODE_ENV=production.')
  process.exit(1)
}

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

// Bác sĩ khác — chỉ để test phân quyền (đăng nhập bằng TEST_DOCTOR_EMAIL không được thấy dữ liệu của bác sĩ này)
const TEST_OTHER_DOCTOR_EMAIL = 'doctor.other.test@vitafamily.local'
const TEST_OTHER_DOCTOR_PASSWORD = 'Test123456'
const TEST_OTHER_DOCTOR_NAME = 'BS. Lê Phương Thảo (TEST — bác sĩ khác)'
const TEST_OTHER_DOCTOR_PHONE = '0909000098'

// Bệnh nhân có tài khoản thật — để test luồng đặt lịch qua member_id (khác với khách vãng lai ten_khach)
const TEST_PATIENT_EMAIL = 'patient.test@vitafamily.local'
const TEST_PATIENT_PASSWORD = 'Test123456'
const TEST_PATIENT_NAME = 'Nguyễn Thị Hạnh (TEST)'
const TEST_PATIENT_PHONE = '0909000097'

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

// ── Bác sĩ khác (test phân quyền) ───────────────────────────────────────────
async function findOrCreateOtherDoctor() {
  let user = await NguoiDung.findOne({ email: TEST_OTHER_DOCTOR_EMAIL })
  let userCreated = false
  if (!user) {
    const hash = await bcrypt.hash(TEST_OTHER_DOCTOR_PASSWORD, 10)
    user = await NguoiDung.create({
      email: TEST_OTHER_DOCTOR_EMAIL,
      mat_khau: hash,
      ho_ten: TEST_OTHER_DOCTOR_NAME,
      so_dien_thoai: TEST_OTHER_DOCTOR_PHONE,
      role: 'doctor',
      status: 'active',
    })
    userCreated = true
  }

  let doc = await BacSi.findOne({ user_id: user._id })
  let docCreated = false
  if (!doc) {
    // Ưu tiên chuyên khoa khác với bác sĩ chính để 2 bác sĩ tách biệt rõ ràng khi test phân quyền
    const specialty = await ChuyenKhoa.findOne({ ten: 'Nội tổng quát' }) || await ChuyenKhoa.findOne({})
    doc = await BacSi.create({
      user_id: user._id,
      specialties: specialty ? [specialty._id] : [],
      services: [],
      tieu_su: '(TEST) Bác sĩ khác — chỉ dùng để kiểm thử phân quyền, không phải bác sĩ thật.',
      bang_cap: 'Bác sĩ Chuyên khoa I',
      so_nam_kinh_nghiem: 5,
      gia_kham: 200000,
      phi_kham: 200000,
      tuoi_nhan_kham_tu: 0,
      trang_thai_duyet: 'approved',
      phong_kham_mac_dinh: TEST_ROOM_LABEL_FALLBACK,
    })
    docCreated = true
  }

  return { user, doc, userCreated, docCreated }
}

// ── Bệnh nhân có tài khoản thật (GiaDinh + ThanhVien) ───────────────────────
async function findOrCreatePatientAccount() {
  let user = await NguoiDung.findOne({ email: TEST_PATIENT_EMAIL })
  let userCreated = false
  if (!user) {
    const hash = await bcrypt.hash(TEST_PATIENT_PASSWORD, 10)
    user = await NguoiDung.create({
      email: TEST_PATIENT_EMAIL,
      mat_khau: hash,
      ho_ten: TEST_PATIENT_NAME,
      so_dien_thoai: TEST_PATIENT_PHONE,
      role: 'user',
      status: 'active',
    })
    userCreated = true
  }

  let family = await GiaDinh.findOne({ user_id: user._id })
  let familyCreated = false
  if (!family) {
    family = await GiaDinh.create({ user_id: user._id, ten_nhom: `Gia đình ${TEST_PATIENT_NAME}` })
    familyCreated = true
  }

  let member = await ThanhVien.findOne({ family_id: family._id, la_chu_ho: true })
  let memberCreated = false
  if (!member) {
    member = await ThanhVien.create({
      family_id: family._id,
      tai_khoan_id: user._id,
      ho_ten: TEST_PATIENT_NAME,
      ngay_sinh: new Date('1993-05-10'),
      gioi_tinh: 'nu',
      quan_he: 'ban_than',
      la_chu_ho: true,
    })
    memberCreated = true
  }

  return { user, family, member, userCreated, familyCreated, memberCreated }
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

  // ── 1b. Bác sĩ khác (test phân quyền) + bệnh nhân tài khoản thật ────────
  const { user: otherDoctorUser, doc: otherDoc, userCreated: otherUserCreated, docCreated: otherDocCreated } = await findOrCreateOtherDoctor()
  bump(otherUserCreated ? 'created' : 'existed', 'other_doctor_user')
  bump(otherDocCreated ? 'created' : 'existed', 'other_doctor_profile')

  const { user: patientUser, member: patientMember, userCreated: patientUserCreated, memberCreated: patientMemberCreated } = await findOrCreatePatientAccount()
  bump(patientUserCreated ? 'created' : 'existed', 'patient_user')
  bump(patientMemberCreated ? 'created' : 'existed', 'patient_member')

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

  // ── 2b. Lịch + lịch hẹn của BÁC SĨ KHÁC hôm nay (test phân quyền) ───────
  // Mục tiêu: đăng nhập bằng TEST_DOCTOR_EMAIL không được thấy 2 lịch hẹn này.
  const { schedule: otherSchedule } = await findOrCreateSchedule(otherDoc._id, workDays[0], [
    { gio_bat_dau: '09:00', gio_ket_thuc: '09:30', status: 'active' },
    { gio_bat_dau: '09:30', gio_ket_thuc: '10:00', status: 'active' },
  ])

  const otherDoctorPlan = [
    { maLichHen: 'TEST_OTHER_DOCTOR_APT_01', slot: 0, status: 'confirmed', payment: 'paid', ten: 'TEST_PATIENT_OTHER_01 Ngô Bảo Châu', gioi_tinh: 'male', nam: 1982 },
    { maLichHen: 'TEST_OTHER_DOCTOR_APT_02', slot: 1, status: 'pending',   payment: 'unpaid', ten: 'TEST_PATIENT_OTHER_02 Lý Thu Trang', gioi_tinh: 'female', nam: 1998 },
  ]
  for (const p of otherDoctorPlan) {
    const slot = otherSchedule.slots[p.slot]
    const { created } = await findOrCreateAppointment(p.maLichHen, async () => ({
      doctor_id: otherDoc._id,
      schedule_id: otherSchedule._id,
      slot_id: slot._id,
      loai_kham: 'clinic',
      ngay_kham: startOfDay(workDays[0]),
      gio_kham: slot.gio_bat_dau,
      gio_ket_thuc: slot.gio_ket_thuc,
      ly_do_kham: 'Khám định kỳ (dữ liệu test — bác sĩ khác)',
      phong_kham: otherDoc.phong_kham_mac_dinh,
      status: p.status,
      payment_status: p.payment,
      gia_kham: otherDoc.gia_kham,
      ten_dich_vu: 'Khám tổng quát',
      ten_khach: p.ten,
      gioi_tinh_khach: p.gioi_tinh,
      nam_sinh_khach: p.nam,
      ma_lich_hen: p.maLichHen,
    }))
    bump(created ? 'created' : 'existed', 'other_doctor_appointment')
    if (created && slot.status === 'active') { slot.status = 'booked'; await otherSchedule.save() }
  }

  // ── 3. Appointments (8 lịch hẹn, đủ trạng thái có action API thật) ──────
  // 'checked_in'/'in_progress' được seed riêng ở mục 3b (không qua action API — xem comment ở đó).
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

  // ── 3b. Lịch hẹn trạng thái checked_in/in_progress + bệnh nhân tài khoản thật ─
  // Lưu ý: 'checked_in' và 'in_progress' tồn tại trong enum LichHen.status nhưng KHÔNG có
  // route/action nào trong hệ thống hiện set được 2 giá trị này (không có nút Check-in/Bắt đầu
  // khám) — seed thẳng bằng create() chỉ để test hiển thị/lọc trạng thái trên UI, không phản
  // ánh có action API tương ứng. Đồng thời dùng member_id (bệnh nhân có tài khoản) thay vì
  // ten_khach (khách vãng lai) để test luồng đặt lịch qua tài khoản thật.
  const todaySchedule = schedules[0]
  const memberPlan = [
    { maLichHen: 'TEST_APT_CHECKED_IN_01', slot: 2, status: 'checked_in', reason: 'Tái khám theo lịch hẹn định kỳ' },
    { maLichHen: 'TEST_APT_IN_PROGRESS_01', slot: 3, status: 'in_progress', reason: 'Khám sức khỏe tổng quát' },
  ]
  for (const p of memberPlan) {
    const slot = todaySchedule.slots[p.slot]
    const { appt, created } = await findOrCreateAppointment(p.maLichHen, async () => ({
      user_id: patientUser._id,
      member_id: patientMember._id,
      doctor_id: docId,
      schedule_id: todaySchedule._id,
      slot_id: slot._id,
      loai_kham: 'clinic',
      ngay_kham: startOfDay(workDays[0]),
      gio_kham: slot.gio_bat_dau,
      gio_ket_thuc: slot.gio_ket_thuc,
      ly_do_kham: p.reason,
      phong_kham: bacSi.phong_kham_mac_dinh,
      status: p.status,
      payment_status: 'paid',
      gia_kham: bacSi.gia_kham,
      ten_dich_vu: 'Khám tổng quát',
      ma_lich_hen: p.maLichHen,
      trang_thai_den: p.status === 'checked_in' || p.status === 'in_progress' ? 'da_den' : null,
      gio_den_thuc_te: p.status === 'checked_in' || p.status === 'in_progress' ? new Date() : null,
    }))
    bump(created ? 'created' : 'existed', 'appointment')
    if (created && slot.status === 'active') { slot.status = 'booked'; await todaySchedule.save() }
    appointments.push({ day: 0, slot: p.slot, status: p.status, appt })
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

  // ── 4b. Sinh hiệu + đơn thuốc mẫu cho các hồ sơ khám vừa tạo/tái sử dụng ─
  for (const item of appointments) {
    if (!item.result) continue
    const { appt } = item
    const result = await KetQuaKham.findOne({ appointment_id: appt._id })
    if (!result) continue

    const existingVitals = await SinhHieuKham.findOne({ appointment_id: appt._id })
    if (!existingVitals) {
      await SinhHieuKham.create({
        appointment_id: appt._id,
        can_nang: 62,
        chieu_cao: 165,
        huyet_ap: '120/80',
        nhiet_do: 37,
        nhip_tim: 78,
        nguoi_do_id: nurse ? nurse._id : doctorUser._id,
      })
      bump('created', 'vital_signs')
    } else {
      bump('existed', 'vital_signs')
    }

    // Lưu ý field kép: `ket_qua_kham_id` là field BẮT BUỘC theo schema (DonThuoc.js), nhưng
    // toàn bộ code đọc hiện tại (doctor getResult, patient records.controller.js) lại tra cứu
    // đơn thuốc qua field `medical_record_id` bằng chính result._id (quy ước thực tế của cả
    // codebase, dù lệch tên so với ref khai báo trong schema — đã audit, xem tài liệu seed).
    // Set cả 2 field để: (a) qua validate bắt buộc, (b) hiển thị đúng trên API/FE hiện tại.
    const existingRx = await DonThuoc.findOne({ ket_qua_kham_id: result._id })
    if (!existingRx) {
      await DonThuoc.create({
        ket_qua_kham_id: result._id,
        medical_record_id: result._id,
        ten_khach: appt.ten_khach ?? null,
        doctor_id: docId,
        nguon: 'bac_si',
        items: [{
          ten_thuoc: '(TEST) Paracetamol 500mg',
          lieu_luong: '1 viên',
          tan_suat: '3 lần/ngày',
          gio_uong: ['07:00', '12:00', '19:00'],
          so_ngay: 5,
          ghi_chu: 'Uống sau ăn (dữ liệu test)',
        }],
      })
      bump('created', 'prescription')
    } else {
      // Vá dữ liệu cũ (nếu chạy lại seed sau khi đã tồn tại nhưng thiếu medical_record_id)
      if (!existingRx.medical_record_id) {
        existingRx.medical_record_id = result._id
        await existingRx.save()
      }
      bump('existed', 'prescription')
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
  console.log('\nTest login (bác sĩ chính — dùng để xem đầy đủ dữ liệu):')
  console.log('  email:', TEST_DOCTOR_EMAIL)
  console.log('Test login (bác sĩ khác — dùng để xác nhận KHÔNG thấy dữ liệu ở trên):')
  console.log('  email:', TEST_OTHER_DOCTOR_EMAIL)
  console.log('Test login (bệnh nhân tài khoản thật):')
  console.log('  email:', TEST_PATIENT_EMAIL)
  console.log('  password: (giống nhau cho cả 3 tài khoản — xem hằng số *_PASSWORD trong mã nguồn, không in ra log)')
  console.log('\nDoctor._id (chính):', docId.toString())
  console.log('Doctor._id (khác):', otherDoc._id.toString())

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('❌ Lỗi khi seed dữ liệu test:', err.message)
  process.exit(1)
})
