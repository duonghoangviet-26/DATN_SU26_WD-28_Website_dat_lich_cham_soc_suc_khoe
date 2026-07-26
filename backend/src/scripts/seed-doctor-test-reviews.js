import '../config/timezone.js'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { NguoiDung, BacSi, LichHen, DanhGia, LichLamViec } from '../models/index.js'

// ============================================================
// SEED ĐÁNH GIÁ MẪU — BS Khang (TEST)
// Dashboard/Hồ sơ bác sĩ TEST đang có diem_danh_gia=0, tong_danh_gia=0 (chưa có DanhGia nào)
// vì DanhGia bắt buộc appointment_id trỏ tới lịch hẹn có user_id thật (bệnh nhân có tài
// khoản) — doctor.test hầu như chỉ có lịch "khách vãng lai" (ten_khach), không đủ để review.
// Script này tạo thêm vài lịch hẹn completed gắn user_id thật (tài khoản bệnh nhân demo có
// sẵn) rồi tạo DanhGia cho từng lịch, sau đó cập nhật diem_danh_gia/tong_danh_gia trên BacSi
// bằng ĐÚNG công thức aggregate mà patient/booking.controller.js dùng khi bệnh nhân tự đánh
// giá (avg so_sao làm tròn 1 chữ số thập phân, đếm theo status='visible' + ngay_xoa=null).
//
// Chạy (từ backend/):
//   node src/scripts/seed-doctor-test-reviews.js            # in hướng dẫn, KHÔNG ghi
//   node src/scripts/seed-doctor-test-reviews.js --confirm  # tạo lịch hẹn + đánh giá mẫu
//   node src/scripts/seed-doctor-test-reviews.js --cleanup  # dọn theo marker + tính lại điểm
//
// An toàn: target BS chặt theo email .local; marker ma_lich_hen 'REVIEWSEED_'; idempotent
// (tự dọn marker cũ trước khi tạo); không tạo/sửa HoaDon/ThanhToan.
// LƯU Ý: LichHen.pre('validate') bắt buộc loai_kham='clinic' phải có schedule_id + slot_id
// (không thể tạo "lịch hẹn ảo" đứng một mình) — script gắn vào slot 'active' có thật của BS,
// ưu tiên ngày CŨ (không đụng 6 ngày lịch sử vận hành LIVEHIST_ hay hôm nay LIVETEST_KH_).
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

const uri = process.env.MONGODB_URI
if (!uri) { console.error('❌ Thiếu MONGODB_URI'); process.exit(1) }

const TARGET_DOCTOR_EMAIL = 'doctor.test@vitafamily.local'
const APT_PREFIX = 'REVIEWSEED_'
// Tài khoản bệnh nhân demo có sẵn trong DB (bỏ qua locked.demo — tài khoản khóa mẫu).
const PATIENT_EMAILS = [
  'patient01.demo@vitafamily.vn',
  'patient02.demo@vitafamily.vn',
  'patient03.demo@vitafamily.vn',
  'lt14062006meitu@gmail.com',
  'patient.test@vitafamily.local',
]

const REVIEWS = [
  { so_sao: 5, noi_dung: 'Bác sĩ khám kỹ, giải thích rõ ràng, rất tận tâm với bệnh nhân.' },
  { so_sao: 5, noi_dung: 'Phòng khám sạch sẽ, bác sĩ tư vấn nhiệt tình, hẹn tái khám đúng giờ.' },
  { so_sao: 4, noi_dung: 'Khám tốt nhưng phải chờ hơi lâu. Bác sĩ chuyên môn tốt.' },
  { so_sao: 5, noi_dung: 'Rất hài lòng, bác sĩ chẩn đoán chính xác, thuốc uống hiệu quả.' },
  { so_sao: 4, noi_dung: 'Thái độ thân thiện, dặn dò kỹ càng cách chăm sóc tại nhà.' },
]

function startOfDay(d) { const x = new Date(d); return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())) }

// Gom N slot 'active' còn trống từ các ngày làm việc CŨ nhất có thể (ưu tiên xa hôm nay, tránh
// đụng 6 ngày lịch sử vận hành LIVEHIST_ mới seed và hôm nay LIVETEST_KH_) — mỗi slot kèm
// luôn document LichLamViec chứa nó để đánh dấu 'booked' đúng chỗ.
async function pickFreeSlots(docId, count) {
  const todayStart = startOfDay(new Date())
  const schedules = await LichLamViec.find({ doctor_id: docId, ngay: { $lt: todayStart } }).sort({ ngay: 1 }).lean()
  const picked = []
  for (const sch of schedules) {
    for (const slot of sch.slots) {
      if (slot.status !== 'active') continue
      picked.push({ schedule: sch, slot })
      if (picked.length >= count) return picked
    }
  }
  return picked
}

async function resolveActors() {
  const doctorUser = await NguoiDung.findOne({ email: TARGET_DOCTOR_EMAIL, role: 'doctor' })
  if (!doctorUser) throw new Error(`Không tìm thấy doctor ${TARGET_DOCTOR_EMAIL} — dừng.`)
  const bacSi = await BacSi.findOne({ user_id: doctorUser._id })
  if (!bacSi) throw new Error('Không tìm thấy hồ sơ BacSi Khang (TEST) — dừng.')

  const patients = await NguoiDung.find({ email: { $in: PATIENT_EMAILS }, role: 'user' }).lean()
  if (patients.length === 0) throw new Error('Không tìm thấy tài khoản bệnh nhân demo nào — dừng.')
  return { doctorUser, bacSi, patients }
}

async function recomputeRating(doctorId) {
  const result = await DanhGia.aggregate([
    { $match: { doctor_id: doctorId, status: 'visible', ngay_xoa: null } },
    { $group: { _id: '$doctor_id', trungBinhSao: { $avg: '$so_sao' }, tongSo: { $sum: 1 } } },
  ])
  const info = result[0] || { trungBinhSao: 0, tongSo: 0 }
  const roundedRating = Math.round(info.trungBinhSao * 10) / 10
  await BacSi.updateOne({ _id: doctorId }, { $set: { diem_danh_gia: roundedRating, tong_danh_gia: info.tongSo } })
  return { diem_danh_gia: roundedRating, tong_danh_gia: info.tongSo }
}

async function cleanup(bacSi, { silent = false } = {}) {
  const appts = await LichHen.find({ ma_lich_hen: new RegExp('^' + APT_PREFIX) }).select('_id schedule_id slot_id').lean()
  const apptIds = appts.map((a) => a._id)
  const r = {}
  r.danhgia = (await DanhGia.deleteMany({ appointment_id: { $in: apptIds } })).deletedCount
  r.lichhen = (await LichHen.deleteMany({ _id: { $in: apptIds } })).deletedCount

  // Trả slot đã đặt về 'active' theo đúng slot_id đã dùng.
  const bySchedule = new Map()
  for (const a of appts) {
    if (!a.schedule_id || !a.slot_id) continue
    const k = String(a.schedule_id)
    if (!bySchedule.has(k)) bySchedule.set(k, new Set())
    bySchedule.get(k).add(String(a.slot_id))
  }
  let freed = 0
  for (const [schId, slotIds] of bySchedule) {
    const sch = await LichLamViec.findById(schId)
    if (!sch) continue
    let changed = false
    for (const s of sch.slots) {
      if (slotIds.has(String(s._id)) && s.status === 'booked') { s.status = 'active'; freed += 1; changed = true }
    }
    if (changed) await sch.save()
  }
  r.slot_tra_ve_active = freed

  const rating = await recomputeRating(bacSi._id)
  if (!silent) console.log('# CLEANUP REVIEWSEED — đã xóa:', r, '| điểm sau khi dọn:', rating)
}

async function seed({ bacSi, patients }) {
  const docId = bacSi._id
  await cleanup(bacSi, { silent: true }) // idempotent

  const giaKham = bacSi.gia_kham ?? 0
  const freeSlots = await pickFreeSlots(docId, REVIEWS.length)
  if (freeSlots.length < REVIEWS.length) {
    throw new Error(`Chỉ tìm được ${freeSlots.length}/${REVIEWS.length} slot trống ở các ngày cũ — dừng.`)
  }

  const scheduleDocs = new Map() // schedule_id -> mongoose document (để save 1 lần/ngày)
  let created = 0

  for (let i = 0; i < REVIEWS.length; i += 1) {
    const patient = patients[i % patients.length]
    const rv = REVIEWS[i]
    const { schedule, slot } = freeSlots[i]

    if (!scheduleDocs.has(String(schedule._id))) {
      scheduleDocs.set(String(schedule._id), await LichLamViec.findById(schedule._id))
    }
    const schDoc = scheduleDocs.get(String(schedule._id))
    const slotDoc = schDoc.slots.id(slot._id)
    slotDoc.status = 'booked'

    const appt = await LichHen.create({
      doctor_id: docId, user_id: patient._id, ten_khach: patient.ho_ten,
      specialty_id: slot.specialty_id ?? bacSi.specialties?.[0] ?? null,
      schedule_id: schedule._id, slot_id: slot._id,
      loai_kham: 'clinic', ngay_kham: schedule.ngay,
      gio_kham: slot.gio_bat_dau, gio_ket_thuc: slot.gio_ket_thuc,
      phong_kham: slot.phong_kham ?? bacSi.phong_kham_mac_dinh ?? null,
      gia_kham: giaKham, ten_dich_vu: 'Khám Tai Mũi Họng', status: 'completed', payment_status: 'paid',
      ma_lich_hen: `${APT_PREFIX}${String(i + 1).padStart(2, '0')}`,
    })
    await DanhGia.create({
      appointment_id: appt._id, user_id: patient._id, doctor_id: docId,
      so_sao: rv.so_sao, noi_dung: rv.noi_dung, status: 'visible',
    })
    created += 1
  }

  for (const schDoc of scheduleDocs.values()) await schDoc.save()

  const rating = await recomputeRating(docId)
  console.log('# SEED REVIEWSEED — HOÀN TẤT')
  console.log(`  Đã tạo ${created} lịch hẹn + đánh giá cho BS Khang (TEST).`)
  console.log(`  Điểm đánh giá mới: ${rating.diem_danh_gia} (${rating.tong_danh_gia} lượt).`)
}

async function main() {
  const args = process.argv.slice(2)
  const doCleanup = args.includes('--cleanup')
  const doConfirm = args.includes('--confirm')
  if (!doCleanup && !doConfirm) {
    console.log('Seed đánh giá mẫu cho BS Khang (TEST). KHÔNG ghi nếu thiếu cờ.')
    console.log('  --confirm  : tạo 5 lịch hẹn + đánh giá mẫu, cập nhật điểm trung bình')
    console.log('  --cleanup  : dọn sạch theo marker REVIEWSEED_ + tính lại điểm')
    return
  }
  console.log('⏳ Kết nối MongoDB...')
  await mongoose.connect(uri)
  console.log('✅ Đã kết nối.')
  try {
    const actors = await resolveActors()
    if (doCleanup) await cleanup(actors.bacSi)
    else await seed(actors)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((err) => { console.error('❌ Lỗi seed-doctor-test-reviews:', err.message); process.exit(1) })
