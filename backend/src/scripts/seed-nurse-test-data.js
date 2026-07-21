import '../config/timezone.js' // PHẢI đứng đầu — ép TZ=UTC để `ngay` khớp múi giờ với cron (GAP-8)
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'
import {
  NguoiDung, BacSi, ChuyenKhoa, LichLamViec, LichHen, HangDoi, KetQuaKham, SinhHieuKham,
  GiaDinh, ThanhVien,
} from '../models/index.js'

// ============================================================
// SEED DỮ LIỆU KIỂM THỬ — TRANG Y TÁ (PROMPT 29)
// CHỈ chạy trên TEST DATABASE riêng. KHÔNG chạy trên Cloud/production.
//
// Chạy (từ thư mục backend/):
//   node src/scripts/seed-nurse-test-data.js --confirm    # tạo dữ liệu test (dọn trước, tạo lại)
//   node src/scripts/seed-nurse-test-data.js --cleanup    # dọn sạch dữ liệu test theo marker
//   node src/scripts/seed-nurse-test-data.js              # chỉ in hướng dẫn, KHÔNG ghi gì
//
// An toàn:
//   - Cần biến môi trường NURSE_TEST_MONGODB_URI RIÊNG (khác MONGODB_URI của prod).
//   - Từ chối nếu URI == MONGODB_URI, tên DB không chứa 'test'/'local' (trừ --force),
//     hoặc NODE_ENV=production.
//   - Marker: email @nursetest.local, tên có '(NURSETEST)', ma_lich_hen 'NRT_...'.
//   - Không dữ liệu bệnh nhân thật/nhạy cảm; mật khẩu test KHÔNG log.
//   - Cleanup xóa theo marker (cascade), idempotent.
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

// ── Marker & hằng số ────────────────────────────────────────────────────────
const EMAIL_DOMAIN = '@nursetest.local'
const NAME_PREFIX = '(NURSETEST)'
const APT_PREFIX = 'NRT_'
const TEST_PASSWORD = 'NurseTest123456' // chỉ để hash — KHÔNG log

const U = {
  n1: 'nurse.one' + EMAIL_DOMAIN,
  n2: 'nurse.two' + EMAIL_DOMAIN,
  n3: 'nurse.none' + EMAIL_DOMAIN,
  d1: 'doctor.one' + EMAIL_DOMAIN,
  d2: 'doctor.two' + EMAIL_DOMAIN,
  d3: 'doctor.three' + EMAIL_DOMAIN,
  p1: 'patient.one' + EMAIL_DOMAIN,
}

// ── Guard chọn đúng test DB ──────────────────────────────────────────────────
function resolveUri(force) {
  const uri = process.env.NURSE_TEST_MONGODB_URI
  if (!uri) {
    throw new Error('Thiếu NURSE_TEST_MONGODB_URI (URI của test DB riêng). Không dùng MONGODB_URI của prod.')
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NODE_ENV=production — từ chối chạy seed test.')
  }
  if (process.env.MONGODB_URI && uri === process.env.MONGODB_URI) {
    throw new Error('NURSE_TEST_MONGODB_URI trùng MONGODB_URI (prod) — từ chối để tránh ghi vào Cloud/production.')
  }
  const dbName = (uri.split('/').pop() || '').split('?')[0].toLowerCase()
  if (!force && !/(test|local)/.test(dbName)) {
    throw new Error(`Tên DB "${dbName}" không chứa 'test'/'local'. Nếu chắc chắn là test DB, thêm cờ --force.`)
  }
  return { uri, dbName }
}

function startOfDay(d) {
  const x = new Date(d)
  return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()))
}
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const oid = () => new mongoose.Types.ObjectId()

// N slot 15 phút từ 08:00 — đủ chỗ cho các lịch hẹn test.
function buildSlots(count, specialtyId, phongKham) {
  const slots = []
  let mins = 8 * 60
  for (let i = 0; i < count; i += 1) {
    const a = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
    mins += 15
    const b = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
    slots.push({ gio_bat_dau: a, gio_ket_thuc: b, specialty_id: specialtyId, phong_kham: phongKham, status: 'booked' })
  }
  return slots
}

async function makeUser(email, ho_ten, role, phone) {
  const hash = await bcrypt.hash(TEST_PASSWORD, 10)
  return NguoiDung.create({ email, mat_khau: hash, ho_ten, so_dien_thoai: phone, role, status: 'active' })
}

async function makeDoctor(email, ho_ten, phone, specialtyId, phongKham) {
  const user = await makeUser(email, ho_ten, 'doctor', phone)
  const doc = await BacSi.create({
    user_id: user._id,
    specialties: specialtyId ? [specialtyId] : [],
    services: [],
    tieu_su: `${NAME_PREFIX} Bác sĩ dữ liệu kiểm thử — không phải bác sĩ thật.`,
    bang_cap: 'Bác sĩ Chuyên khoa I',
    so_nam_kinh_nghiem: 6,
    gia_kham: 200000,
    phi_kham: 200000,
    tuoi_nhan_kham_tu: 0,
    trang_thai_duyet: 'approved',
    phong_kham_mac_dinh: phongKham,
  })
  return { user, doc }
}

async function makeSchedule(doctorProfileId, nurseUserId, ngay, specialtyId, phongKham) {
  return LichLamViec.create({
    doctor_id: doctorProfileId,
    nurse_id: nurseUserId,
    ngay: startOfDay(ngay),
    trang_thai_ngay: 'lam_viec',
    slots: buildSlots(12, specialtyId, phongKham),
  })
}

// ── SEED ─────────────────────────────────────────────────────────────────────
async function seed() {
  const specialty = await ChuyenKhoa.findOne({})
  if (!specialty) {
    throw new Error('Test DB chưa có ChuyenKhoa nào. Chạy base seed (specialties/clinics) trước — script này KHÔNG tự tạo chuyên khoa.')
  }
  const specialtyId = specialty._id
  const PHONG = `${NAME_PREFIX} Phòng 999`

  // Dọn trước để idempotent (tránh trùng ma_lich_hen/email khi chạy lại).
  await cleanup(true)

  const today = startOfDay(new Date())
  const tomorrow = addDays(today, 1)

  // 1) Người dùng
  const n1 = await makeUser(U.n1, `${NAME_PREFIX} Y tá Một`, 'nurse', '0900000001')
  const n2 = await makeUser(U.n2, `${NAME_PREFIX} Y tá Hai`, 'nurse', '0900000002')
  await makeUser(U.n3, `${NAME_PREFIX} Y tá Không ca`, 'nurse', '0900000003') // N3: không ca
  const { user: d1u, doc: d1 } = await makeDoctor(U.d1, `${NAME_PREFIX} BS Một`, '0900000011', specialtyId, PHONG)
  const { doc: d2 } = await makeDoctor(U.d2, `${NAME_PREFIX} BS Hai`, '0900000012', specialtyId, PHONG)
  const { doc: d3 } = await makeDoctor(U.d3, `${NAME_PREFIX} BS Ba`, '0900000013', specialtyId, PHONG)

  const p1u = await makeUser(U.p1, `${NAME_PREFIX} Bệnh nhân Một`, 'user', '0900000021')
  const fam = await GiaDinh.create({ user_id: p1u._id, ten_nhom: `${NAME_PREFIX} Gia đình test` })
  const p1m = await ThanhVien.create({
    family_id: fam._id, tai_khoan_id: p1u._id, ho_ten: `${NAME_PREFIX} Thành viên chủ hộ`,
    ngay_sinh: new Date('1990-01-15'), gioi_tinh: 'nu', quan_he: 'ban_than', la_chu_ho: true,
  })

  // 2) Ca làm việc (LichLamViec.nurse_id)
  const schD1 = await makeSchedule(d1._id, n1._id, today, specialtyId, PHONG)     // N1 hôm nay - D1
  await makeSchedule(d2._id, n1._id, today, specialtyId, PHONG)                   // N1 hôm nay - D2 (ca nhiều bác sĩ)
  await makeSchedule(d3._id, n2._id, today, specialtyId, PHONG)                   // N2 hôm nay - D3 (phân quyền)
  await makeSchedule(d1._id, n1._id, tomorrow, specialtyId, PHONG)                // N1 T+1 (nhiều ca)

  let apti = 0
  const nextSlot = () => schD1.slots[apti]
  async function makeAppt(fields) {
    const slot = nextSlot()
    const ma = `${APT_PREFIX}${String(apti + 1).padStart(3, '0')}`
    apti += 1
    return LichHen.create({
      doctor_id: d1._id, schedule_id: schD1._id, slot_id: slot._id, loai_kham: 'clinic',
      ngay_kham: today, gio_kham: slot.gio_bat_dau, gio_ket_thuc: slot.gio_ket_thuc,
      phong_kham: PHONG, gia_kham: 200000, ten_dich_vu: 'Khám tổng quát',
      so_dien_thoai_khach: '0900000099', ma_lich_hen: ma, ...fields,
    })
  }
  async function makeQueue(appt, trang_thai, extra = {}) {
    return HangDoi.create({
      nguon: 'online', appointment_id: appt._id, ten_benh_nhan: `${NAME_PREFIX} ${appt.ten_khach ?? 'BN'}`,
      so_dien_thoai: '0900000099', specialty_id: specialtyId, doctor_id: d1._id,
      muc_uu_tien: 'online_thuong', trang_thai, checkin_time: new Date(),
      nguoi_tiep_nhan_id: n1._id, vai_tro_tiep_nhan: 'nurse', ...extra,
    })
  }
  async function makeResult(appt, queue, status, extra = {}) {
    return KetQuaKham.create({
      appointment_id: appt._id, hang_doi_id: queue?._id, nguoi_nhap_id: n1._id,
      bac_si_phu_trach_id: d1._id, status,
      chan_doan: `${NAME_PREFIX} Chẩn đoán test (${status})`, ...extra,
    })
  }

  // 3) Lịch hẹn theo tình huống (dưới D1 hôm nay — N1 thấy)
  // #5 chưa đến
  await makeAppt({ status: 'confirmed', payment_status: 'paid', ten_khach: 'BN Chưa đến', ly_do_kham: 'Khám định kỳ' })
  // #6 đã đến
  const a2 = await makeAppt({ status: 'confirmed', payment_status: 'paid', trang_thai_den: 'da_den', gio_den_thuc_te: new Date(), ten_khach: 'BN Đã đến', ly_do_kham: 'Đau họng' })
  await makeQueue(a2, 'dang_cho')
  // #7 đang khám
  const a3 = await makeAppt({ status: 'in_progress', payment_status: 'paid', trang_thai_den: 'da_den', gio_den_thuc_te: new Date(), ten_khach: 'BN Đang khám', ly_do_kham: 'Sốt' })
  await makeQueue(a3, 'trong_phong', { thoi_diem_vao_phong: new Date() })
  // #8 chờ nhập hồ sơ (chưa có KetQuaKham)
  const a4 = await makeAppt({ status: 'waiting_record', payment_status: 'paid', trang_thai_den: 'da_den', ten_khach: 'BN Chờ nhập hồ sơ', ly_do_kham: 'Đau lưng' })
  await makeQueue(a4, 'hoan_thanh', { thoi_diem_ket_thuc: new Date() })
  // #9 hồ sơ nháp
  const a5 = await makeAppt({ status: 'waiting_record', payment_status: 'paid', trang_thai_den: 'da_den', ten_khach: 'BN Hồ sơ nháp', ly_do_kham: 'Chóng mặt' })
  const q5 = await makeQueue(a5, 'hoan_thanh', { thoi_diem_ket_thuc: new Date() })
  await makeResult(a5, q5, 'ban_nhap')
  await SinhHieuKham.create({ appointment_id: a5._id, hang_doi_id: q5._id, can_nang: 60, chieu_cao: 165, huyet_ap: '120/80', nhiet_do: 37, nhip_tim: 78, nguoi_do_id: n1._id, thoi_diem_do: new Date() })
  // #10 hồ sơ đã gửi
  const a6 = await makeAppt({ status: 'waiting_doctor_confirm', payment_status: 'paid', trang_thai_den: 'da_den', ten_khach: 'BN Hồ sơ đã gửi', ly_do_kham: 'Ho kéo dài' })
  const q6 = await makeQueue(a6, 'hoan_thanh', { thoi_diem_ket_thuc: new Date() })
  await makeResult(a6, q6, 'cho_xac_nhan', { submitted_at: new Date() })
  // #11 hồ sơ cần sửa
  const a7 = await makeAppt({ status: 'waiting_record', payment_status: 'paid', trang_thai_den: 'da_den', ten_khach: 'BN Hồ sơ cần sửa', ly_do_kham: 'Mất ngủ' })
  const q7 = await makeQueue(a7, 'hoan_thanh', { thoi_diem_ket_thuc: new Date() })
  await makeResult(a7, q7, 'yeu_cau_chinh_sua', {
    doctor_revision_note: `${NAME_PREFIX} Bổ sung sinh hiệu và mô tả triệu chứng chi tiết hơn`,
    lich_su_sua: [{ nguoi_sua_id: d1u._id, thoi_diem_sua: new Date(), noi_dung: `${NAME_PREFIX} Bác sĩ yêu cầu chỉnh sửa` }],
  })
  // #12 hồ sơ đã xác nhận (khóa)
  const a8 = await makeAppt({ status: 'completed', payment_status: 'paid', trang_thai_den: 'da_den', ten_khach: 'BN Hồ sơ đã xác nhận', ly_do_kham: 'Tái khám' })
  const q8 = await makeQueue(a8, 'hoan_thanh', { thoi_diem_ket_thuc: new Date() })
  await makeResult(a8, q8, 'da_xac_nhan', { nguoi_xac_nhan_id: d1u._id, thoi_diem_xac_nhan: new Date() })
  // #13 lịch hủy
  await makeAppt({ status: 'cancelled', payment_status: 'refunded', ten_khach: 'BN Hủy', ly_do_kham: 'Bận việc', ly_do_huy: `${NAME_PREFIX} Hủy do bận đột xuất`, huy_boi: 'doctor', nguoi_huy_id: d1u._id, thoi_diem_huy: new Date() })
  // #14 không đến
  await makeAppt({ status: 'no_show', payment_status: 'paid', trang_thai_den: 'khong_den', no_show_confirmed_at: new Date(), ten_khach: 'BN Không đến', ly_do_kham: 'Khám tổng quát' })
  // #15 dữ liệu quan hệ bị thiếu: member_id treo (không có ThanhVien), ten_khach không đặt → 'Không rõ'
  await makeAppt({ status: 'confirmed', payment_status: 'paid', member_id: oid(), ly_do_kham: 'Quan hệ dữ liệu thiếu (test null-guard)' })

  // #16 lịch của D3 (của N2) — N1 KHÔNG được thấy. Dùng member thật để đa dạng nguồn.
  const schD3 = await LichLamViec.findOne({ doctor_id: d3._id, ngay: today })
  const s3 = schD3.slots[0]
  await LichHen.create({
    doctor_id: d3._id, schedule_id: schD3._id, slot_id: s3._id, loai_kham: 'clinic',
    ngay_kham: today, gio_kham: s3.gio_bat_dau, gio_ket_thuc: s3.gio_ket_thuc, phong_kham: PHONG,
    gia_kham: 200000, ten_dich_vu: 'Khám tổng quát', status: 'confirmed', payment_status: 'paid',
    user_id: p1u._id, member_id: p1m._id, ma_lich_hen: `${APT_PREFIX}D3_01`, ly_do_kham: 'Lịch bác sĩ khác (phân quyền)',
  })

  console.log('# SEED NURSE TEST DATA — HOÀN TẤT')
  console.log('Đăng nhập test (mật khẩu chung, xem TEST_PASSWORD trong mã — không log):')
  Object.entries(U).forEach(([k, v]) => console.log(`  ${k}: ${v}`))
  console.log('\nGợi ý kiểm thử phân quyền: đăng nhập', U.n1, '→ KHÔNG thấy lịch của D3;', U.n2, '→ chỉ thấy D3.')
  console.log('#17 (hồ sơ trùng): gọi createDraft lại trên', APT_PREFIX + '009/010 ⇒ 409.')
  console.log('#18 (đồng thời): 2 request submit song song trên', APT_PREFIX + '009 (ban_nhap) ⇒ 1×200, 1×409.')
}

// ── CLEANUP (theo marker, cascade) ──────────────────────────────────────────
async function cleanup(silent = false) {
  const users = await NguoiDung.find({ email: new RegExp(EMAIL_DOMAIN.replace('.', '\\.') + '$') }).select('_id').lean()
  const userIds = users.map((u) => u._id)
  const docProfiles = await BacSi.find({ user_id: { $in: userIds } }).select('_id').lean()
  const docIds = docProfiles.map((d) => d._id)

  // Lịch hẹn test: theo ma_lich_hen prefix HOẶC thuộc bác sĩ test.
  const appts = await LichHen.find({ $or: [{ ma_lich_hen: new RegExp('^' + APT_PREFIX) }, { doctor_id: { $in: docIds } }] }).select('_id').lean()
  const apptIds = appts.map((a) => a._id)

  const r = {}
  r.ketqua = (await KetQuaKham.deleteMany({ appointment_id: { $in: apptIds } })).deletedCount
  r.sinhhieu = (await SinhHieuKham.deleteMany({ appointment_id: { $in: apptIds } })).deletedCount
  r.hangdoi = (await HangDoi.deleteMany({ $or: [{ appointment_id: { $in: apptIds } }, { ten_benh_nhan: new RegExp('^' + NAME_PREFIX.replace(/[()]/g, '\\$&')) }] })).deletedCount
  r.lichhen = (await LichHen.deleteMany({ _id: { $in: apptIds } })).deletedCount
  r.lichlamviec = (await LichLamViec.deleteMany({ $or: [{ doctor_id: { $in: docIds } }, { nurse_id: { $in: userIds } }] })).deletedCount
  r.thanhvien = (await ThanhVien.deleteMany({ ho_ten: new RegExp('^' + NAME_PREFIX.replace(/[()]/g, '\\$&')) })).deletedCount
  r.giadinh = (await GiaDinh.deleteMany({ user_id: { $in: userIds } })).deletedCount
  r.bacsi = (await BacSi.deleteMany({ _id: { $in: docIds } })).deletedCount
  r.nguoidung = (await NguoiDung.deleteMany({ _id: { $in: userIds } })).deletedCount

  if (!silent) console.log('# CLEANUP NURSE TEST DATA — đã xóa:', r)
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const doCleanup = args.includes('--cleanup')
  const doConfirm = args.includes('--confirm')

  if (!doCleanup && !doConfirm) {
    console.log('Seed dữ liệu kiểm thử trang Y tá (PROMPT 29). KHÔNG ghi gì nếu thiếu cờ.')
    console.log('  --confirm  : tạo dữ liệu test (dọn trước, tạo lại)')
    console.log('  --cleanup  : dọn sạch dữ liệu test theo marker')
    console.log('  --force    : bỏ qua kiểm tra tên DB chứa test/local (dùng cẩn thận)')
    console.log('Yêu cầu biến môi trường NURSE_TEST_MONGODB_URI trỏ tới TEST DB riêng (không phải prod).')
    return
  }

  const { uri, dbName } = resolveUri(force)
  await mongoose.connect(uri)
  console.log(`✅ Kết nối test DB "${dbName}" (không log URI).`)
  try {
    if (doCleanup) await cleanup()
    else await seed()
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((err) => {
  console.error('❌ Lỗi seed-nurse-test-data:', err.message)
  process.exit(1)
})
