import '../config/timezone.js' // PHẢI đứng đầu — ép TZ=UTC để `ngay` khớp với cron & nurse-scope
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  NguoiDung, BacSi, LichLamViec, LichHen, HangDoi, KetQuaKham, SinhHieuKham,
} from '../models/index.js'

// ============================================================
// SEED LUỒNG TEST HOÀN CHỈNH — BS Khang (TEST) ↔ Y tá Thanh Hà
// Chạy (từ thư mục backend/):
//   node src/scripts/seed-khang-nurse-live-flow.js            # chỉ in hướng dẫn, KHÔNG ghi
//   node src/scripts/seed-khang-nurse-live-flow.js --confirm  # gắn nurse_id + tạo 8 chặng hôm nay
//   node src/scripts/seed-khang-nurse-live-flow.js --cleanup  # dọn sạch theo marker, trả trạng thái
//
// Ghi thẳng vào DB Cloud (MONGODB_URI) — người dùng đã xác nhận. An toàn:
//   - Target BS CHẶT theo email 'doctor.test@vitafamily.local' — KHÔNG bao giờ đụng Khang thật.
//   - Y tá = đúng 1 role='nurse' (Thanh Hà); 0 hoặc >1 → DỪNG.
//   - Ca hôm nay của Khang(TEST) phải tồn tại — KHÔNG tự tạo ca mới.
//   - Marker: ma_lich_hen 'LIVETEST_KH_...', ten_khach '(LIVETEST) ...'.
//   - Idempotent: seed tự cleanup marker cũ trước khi tạo. Không tạo HoaDon/ThanhToan/bệnh nhân mới.
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('❌ Thiếu MONGODB_URI trong .env')
  process.exit(1)
}

const TARGET_DOCTOR_EMAIL = 'doctor.test@vitafamily.local' // BS. Trần Minh Khang (TEST)
const APT_PREFIX = 'LIVETEST_KH_'
const NAME_PREFIX = '(LIVETEST)'
const FAKE_PHONE = '0900000099'

function todayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(end.getDate() + 1)
  return { start, end }
}

// Ghép Date giờ hẹn gốc từ ngay_kham + 'HH:MM' (local — khớp buildGioHenGoc của controller).
function buildGioHenGoc(ngay, hhmm) {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(ngay); d.setHours(h, m, 0, 0)
  return d
}

async function resolveActors() {
  const doctorUser = await NguoiDung.findOne({ email: TARGET_DOCTOR_EMAIL, role: 'doctor' })
  if (!doctorUser) throw new Error(`Không tìm thấy doctor email ${TARGET_DOCTOR_EMAIL} — dừng, không ghi gì.`)
  const bacSi = await BacSi.findOne({ user_id: doctorUser._id })
  if (!bacSi) throw new Error('Không tìm thấy hồ sơ BacSi của Khang (TEST) — dừng.')

  const nurses = await NguoiDung.find({ role: 'nurse' }).select('_id ho_ten status').lean()
  if (nurses.length !== 1) {
    throw new Error(`Cần đúng 1 y tá (role='nurse'), hiện có ${nurses.length} — dừng để tránh gắn nhầm.`)
  }
  const nurse = nurses[0]
  if (nurse.status !== 'active') {
    console.warn(`⚠️ Y tá "${nurse.ho_ten}" đang status="${nurse.status}" — vẫn gắn dữ liệu nhưng có thể chưa đăng nhập được.`)
  }
  return { doctorUser, bacSi, nurse }
}

// Chọn ca hôm nay của Khang(TEST) có đủ >=8 slot 'active' để đặt.
async function findTodaySchedule(doctorId) {
  const { start, end } = todayRange()
  const schedules = await LichLamViec.find({ doctor_id: doctorId, ngay: { $gte: start, $lt: end } })
  if (schedules.length === 0) return null
  // Ưu tiên ca có nhiều slot active nhất.
  schedules.sort((a, b) =>
    b.slots.filter((s) => s.status === 'active').length - a.slots.filter((s) => s.status === 'active').length)
  return schedules[0]
}

// ── CLEANUP theo marker (cascade) + trả trạng thái ca ban đầu ────────────────
async function cleanup(doctorId, nurseId, { silent = false } = {}) {
  const appts = await LichHen.find({ ma_lich_hen: new RegExp('^' + APT_PREFIX) })
    .select('_id slot_id schedule_id').lean()
  const apptIds = appts.map((a) => a._id)

  const r = {}
  r.ketqua = (await KetQuaKham.deleteMany({ appointment_id: { $in: apptIds } })).deletedCount
  r.sinhhieu = (await SinhHieuKham.deleteMany({ appointment_id: { $in: apptIds } })).deletedCount
  r.hangdoi = (await HangDoi.deleteMany({
    $or: [{ appointment_id: { $in: apptIds } }, { ten_benh_nhan: new RegExp('^' + NAME_PREFIX.replace(/[()]/g, '\\$&')) }],
  })).deletedCount
  r.lichhen = (await LichHen.deleteMany({ _id: { $in: apptIds } })).deletedCount

  // Trả các slot đã đặt bởi marker về 'active' + gỡ nurse_id ca hôm nay của Khang(TEST).
  const bookedSlotIds = new Set(appts.filter((a) => a.slot_id).map((a) => String(a.slot_id)))
  const { start, end } = todayRange()
  const schedules = await LichLamViec.find({ doctor_id: doctorId, ngay: { $gte: start, $lt: end } })
  let slotsFreed = 0
  for (const sch of schedules) {
    let changed = false
    for (const s of sch.slots) {
      if (bookedSlotIds.has(String(s._id)) && s.status === 'booked') { s.status = 'active'; slotsFreed += 1; changed = true }
    }
    if (String(sch.nurse_id) === String(nurseId)) { sch.nurse_id = null; changed = true }
    if (changed) await sch.save()
  }
  r.slot_tra_ve_active = slotsFreed

  if (!silent) console.log('# CLEANUP LIVETEST — đã xóa/trả:', r)
  return r
}

// ── SEED 8 chặng ─────────────────────────────────────────────────────────────
async function seed({ doctorUser, bacSi, nurse }) {
  const docId = bacSi._id
  const { start: today } = todayRange()

  // Idempotent — dọn marker cũ trước.
  await cleanup(docId, nurse._id, { silent: true })

  const schedule = await findTodaySchedule(docId)
  if (!schedule) throw new Error('Khang (TEST) KHÔNG có ca hôm nay — dừng (script không tự tạo ca).')

  const activeSlots = schedule.slots.filter((s) => s.status === 'active')
  if (activeSlots.length < 8) {
    throw new Error(`Ca hôm nay chỉ còn ${activeSlots.length} slot 'active', cần >=8 để dựng 8 chặng — dừng.`)
  }

  // Bước A — gắn y tá vào ca hôm nay (điều kiện tiên quyết của nurse-scope).
  schedule.nurse_id = nurse._id

  const specialtyId = activeSlots[0].specialty_id ?? bacSi.specialties?.[0] ?? null
  const phongKham = activeSlots[0].phong_kham ?? bacSi.phong_kham_mac_dinh ?? null
  const giaKham = bacSi.gia_kham ?? 0

  let n = 0
  async function makeAppt(slot, stage) {
    n += 1
    slot.status = 'booked' // đặt slot
    return LichHen.create({
      doctor_id: docId,
      nurse_id: nurse._id, // metadata lịch sử (nurse-scope không dùng field này)
      schedule_id: schedule._id,
      slot_id: slot._id,
      specialty_id: specialtyId,
      loai_kham: 'clinic',
      ngay_kham: today,
      gio_kham: slot.gio_bat_dau,
      gio_ket_thuc: slot.gio_ket_thuc,
      phong_kham: phongKham,
      gia_kham: giaKham,
      ten_dich_vu: 'Khám Tai Mũi Họng',
      ten_khach: `${NAME_PREFIX} ${stage.ten}`,
      so_dien_thoai_khach: FAKE_PHONE,
      ly_do_kham: stage.ly_do,
      ma_lich_hen: `${APT_PREFIX}${String(n).padStart(3, '0')}`,
      ...stage.appt,
    })
  }
  async function makeQueue(appt, trang_thai, extra = {}) {
    return HangDoi.create({
      nguon: 'online',
      appointment_id: appt._id,
      ten_benh_nhan: appt.ten_khach,
      so_dien_thoai: FAKE_PHONE,
      specialty_id: specialtyId,
      doctor_id: docId,
      muc_uu_tien: 'online_thuong',
      gio_hen_goc: buildGioHenGoc(appt.ngay_kham, appt.gio_kham),
      trang_thai,
      checkin_time: new Date(),
      nguoi_tiep_nhan_id: nurse._id,
      vai_tro_tiep_nhan: 'nurse',
      ...extra,
    })
  }
  async function makeResult(appt, queue, status, extra = {}) {
    return KetQuaKham.create({
      appointment_id: appt._id,
      hang_doi_id: queue?._id,
      nguoi_nhap_id: nurse._id,
      bac_si_phu_trach_id: docId,
      status,
      chan_doan: `${NAME_PREFIX} Chẩn đoán thử (${status})`,
      trieu_chung_ban_dau: 'Ho, đau họng, sốt nhẹ',
      ...extra,
    })
  }

  const now = new Date()

  // A1 — chưa đến (không hàng đợi)
  await makeAppt(activeSlots[0], {
    ten: 'A1 Chưa đến', ly_do: 'Khám định kỳ',
    appt: { status: 'confirmed', payment_status: 'paid' },
  })

  // A2 — đã đến, chờ gọi
  const a2 = await makeAppt(activeSlots[1], {
    ten: 'A2 Chờ gọi', ly_do: 'Đau họng',
    appt: { status: 'confirmed', payment_status: 'paid', trang_thai_den: 'da_den', gio_den_thuc_te: now },
  })
  await makeQueue(a2, 'dang_cho')

  // A3 — đang khám (trong phòng)
  const a3 = await makeAppt(activeSlots[2], {
    ten: 'A3 Đang khám', ly_do: 'Sốt',
    appt: { status: 'in_progress', payment_status: 'paid', trang_thai_den: 'da_den', gio_den_thuc_te: now },
  })
  await makeQueue(a3, 'trong_phong', { thoi_diem_vao_phong: now })

  // A4 — chờ nhập hồ sơ (chưa có KetQuaKham)
  const a4 = await makeAppt(activeSlots[3], {
    ten: 'A4 Chờ nhập hồ sơ', ly_do: 'Đau tai',
    appt: { status: 'waiting_record', payment_status: 'paid', trang_thai_den: 'da_den', gio_den_thuc_te: now },
  })
  await makeQueue(a4, 'hoan_thanh', { thoi_diem_vao_phong: now, thoi_diem_ket_thuc: now })

  // A5 — hồ sơ nháp + sinh hiệu
  const a5 = await makeAppt(activeSlots[4], {
    ten: 'A5 Hồ sơ nháp', ly_do: 'Chóng mặt',
    appt: { status: 'waiting_record', payment_status: 'paid', trang_thai_den: 'da_den', gio_den_thuc_te: now },
  })
  const q5 = await makeQueue(a5, 'hoan_thanh', { thoi_diem_vao_phong: now, thoi_diem_ket_thuc: now })
  await makeResult(a5, q5, 'ban_nhap')
  await SinhHieuKham.create({
    appointment_id: a5._id, hang_doi_id: q5._id,
    can_nang: 60, chieu_cao: 165, huyet_ap: '120/80', nhiet_do: 37, nhip_tim: 78,
    nguoi_do_id: nurse._id, thoi_diem_do: now,
  })

  // A6 — hồ sơ đã gửi, chờ BS xác nhận (điểm handoff sang bác sĩ)
  const a6 = await makeAppt(activeSlots[5], {
    ten: 'A6 Chờ BS xác nhận', ly_do: 'Ho kéo dài',
    appt: { status: 'waiting_doctor_confirm', payment_status: 'paid', trang_thai_den: 'da_den', gio_den_thuc_te: now },
  })
  const q6 = await makeQueue(a6, 'hoan_thanh', { thoi_diem_vao_phong: now, thoi_diem_ket_thuc: now })
  await makeResult(a6, q6, 'cho_xac_nhan', { submitted_at: now })

  // A7 — BS yêu cầu chỉnh sửa
  const a7 = await makeAppt(activeSlots[6], {
    ten: 'A7 BS yêu cầu sửa', ly_do: 'Mất ngủ',
    appt: { status: 'waiting_record', payment_status: 'paid', trang_thai_den: 'da_den', gio_den_thuc_te: now },
  })
  const q7 = await makeQueue(a7, 'hoan_thanh', { thoi_diem_vao_phong: now, thoi_diem_ket_thuc: now })
  await makeResult(a7, q7, 'yeu_cau_chinh_sua', {
    submitted_at: now,
    doctor_revision_note: `${NAME_PREFIX} Bổ sung sinh hiệu và mô tả triệu chứng chi tiết hơn`,
    lich_su_sua: [{ nguoi_sua_id: doctorUser._id, thoi_diem_sua: now, noi_dung: `${NAME_PREFIX} Bác sĩ yêu cầu chỉnh sửa` }],
  })

  // A8 — đã xác nhận (khóa, hoàn tất)
  const a8 = await makeAppt(activeSlots[7], {
    ten: 'A8 Đã xác nhận', ly_do: 'Tái khám',
    appt: { status: 'completed', payment_status: 'paid', trang_thai_den: 'da_den', gio_den_thuc_te: now },
  })
  const q8 = await makeQueue(a8, 'hoan_thanh', { thoi_diem_vao_phong: now, thoi_diem_ket_thuc: now })
  await makeResult(a8, q8, 'da_xac_nhan', {
    huong_dan_dieu_tri: 'Uống thuốc theo đơn, tái khám sau 7 ngày',
    nguoi_xac_nhan_id: doctorUser._id, thoi_diem_xac_nhan: now, co_the_sua: false,
  })

  await schedule.save() // lưu nurse_id + slot đã booked (1 lần cuối)

  console.log('# SEED LIVETEST — HOÀN TẤT')
  console.log(`  Bác sĩ (TEST): "${doctorUser.ho_ten}" (doctor_id=${docId})`)
  console.log(`  Y tá: "${nurse.ho_ten}" (nurse_id=${nurse._id}) — đã gắn vào ca hôm nay ${today.toISOString().slice(0, 10)}`)
  console.log(`  Đã tạo ${n} lịch hẹn hôm nay (A1..A8), mã ${APT_PREFIX}001..${String(n).padStart(3, '0')}.`)
  console.log('  Kiểm thử: đăng nhập Y tá Thanh Hà (hàng đợi/DS lịch hẹn/hồ sơ cần nhập) → thao tác A1..A5;')
  console.log('           đăng nhập BS Khang (TEST) → xác nhận/yêu cầu sửa A6; A8 là hồ sơ đã khóa.')
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const doCleanup = args.includes('--cleanup')
  const doConfirm = args.includes('--confirm')

  if (!doCleanup && !doConfirm) {
    console.log('Seed luồng test Khang (TEST) ↔ Y tá Thanh Hà. KHÔNG ghi gì nếu thiếu cờ.')
    console.log('  --confirm  : gắn nurse_id ca hôm nay + tạo 8 chặng A1..A8')
    console.log('  --cleanup  : dọn sạch theo marker + trả slot/nurse_id về trạng thái ban đầu')
    return
  }

  console.log('⏳ Kết nối MongoDB (không in URI)...')
  await mongoose.connect(uri)
  console.log('✅ Đã kết nối.')
  try {
    const actors = await resolveActors()
    if (doCleanup) await cleanup(actors.bacSi._id, actors.nurse._id)
    else await seed(actors)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((err) => {
  console.error('❌ Lỗi seed-khang-nurse-live-flow:', err.message)
  process.exit(1)
})
