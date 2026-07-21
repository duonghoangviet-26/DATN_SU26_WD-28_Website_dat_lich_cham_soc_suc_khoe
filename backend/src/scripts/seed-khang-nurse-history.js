import '../config/timezone.js' // PHẢI đứng đầu — ép TZ=UTC để `ngay` khớp nurse-scope/cron
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  NguoiDung, BacSi, LichLamViec, LichHen, HangDoi, KetQuaKham, SinhHieuKham,
} from '../models/index.js'

// ============================================================
// SEED "LỊCH SỬ VẬN HÀNH" — BS Khang (TEST) ↔ Y tá Thanh Hà
// Tạo dữ liệu các NGÀY LÀM VIỆC GẦN ĐÂY giống phòng khám đang chạy thật:
// mỗi ngày vài bệnh nhân đi TRỌN VÒNG (check-in → khám → y tá nhập hồ sơ →
// bác sĩ xác nhận → completed + paid), xen vài ca hủy/không đến. Tên VN thực tế.
//
// Chạy (từ backend/):
//   node src/scripts/seed-khang-nurse-history.js            # in hướng dẫn, KHÔNG ghi
//   node src/scripts/seed-khang-nurse-history.js --confirm  # tạo lịch sử 6 ngày
//   node src/scripts/seed-khang-nurse-history.js --cleanup  # dọn theo marker
//
// An toàn: target BS chặt theo email .local; y tá = đúng 1 role='nurse';
// marker ma_lich_hen 'LIVEHIST_...'; idempotent (tự dọn marker cũ trước khi tạo).
// KHÔNG đụng luồng hôm nay 'LIVETEST_KH_*' (script khác). Không tạo HoaDon/ThanhToan.
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

const uri = process.env.MONGODB_URI
if (!uri) { console.error('❌ Thiếu MONGODB_URI'); process.exit(1) }

const TARGET_DOCTOR_EMAIL = 'doctor.test@vitafamily.local'
const APT_PREFIX = 'LIVEHIST_'
const SO_NGAY = 6          // số ngày làm việc muốn dựng
const BN_MOI_NGAY = 5      // bệnh nhân mỗi ngày

// Dữ liệu "thật" cho chuyên khoa Tai Mũi Họng của Khang (TEST)
const TEN_BN = [
  'Nguyễn Văn An', 'Trần Thị Hương', 'Lê Hoàng Nam', 'Phạm Thị Lan', 'Hoàng Văn Dũng',
  'Vũ Thị Mai', 'Đặng Minh Quân', 'Bùi Thị Ngọc', 'Đỗ Văn Hải', 'Ngô Thị Thu',
  'Dương Văn Long', 'Lý Thị Hoa', 'Phan Văn Sơn', 'Trịnh Thị Yến', 'Cao Văn Thành',
  'Mai Thị Hồng', 'Tạ Văn Bình', 'Đinh Thị Nhung', 'Hồ Văn Phúc', 'Lương Thị Kim',
  'Nguyễn Thị Tâm', 'Trần Văn Kiên', 'Lê Thị Diệu', 'Phạm Văn Toàn', 'Võ Thị Ánh',
  'Đặng Văn Hùng', 'Bùi Thị Trang', 'Đỗ Thị Vân', 'Ngô Văn Đức', 'Vũ Văn Tiến',
]
const CHAN_DOAN = [
  { cd: 'Viêm họng cấp', hd: 'Súc họng nước muối ấm, uống kháng sinh 5 ngày, hạ sốt khi cần', ly: 'Đau họng, nuốt vướng' },
  { cd: 'Viêm amidan mủ', hd: 'Kháng sinh 7 ngày, giảm đau hạ sốt, nghỉ ngơi nhiều', ly: 'Sốt, đau họng nhiều' },
  { cd: 'Viêm xoang hàm', hd: 'Xịt mũi corticoid, rửa mũi nước muối, kháng sinh 10 ngày', ly: 'Nghẹt mũi, đau vùng má' },
  { cd: 'Viêm tai giữa cấp', hd: 'Kháng sinh, giảm đau, tái khám sau 1 tuần', ly: 'Ù tai, đau tai' },
  { cd: 'Viêm mũi dị ứng', hd: 'Kháng histamin, tránh dị nguyên, xịt mũi khi nghẹt', ly: 'Hắt hơi, chảy mũi' },
  { cd: 'Viêm thanh quản', hd: 'Hạn chế nói to, uống nước ấm, khí dung 3 ngày', ly: 'Khàn tiếng, ho khan' },
]
const LY_DO_HUY = ['Bận công việc đột xuất', 'Đã khám nơi khác', 'Sức khỏe đã ổn']

function startOfDay(d) { const x = new Date(d); return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())) }
function buildGioHenGoc(ngay, hhmm) {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(ngay); d.setHours(h, m, 0, 0); return d
}
const pick = (arr, i) => arr[i % arr.length]

async function resolveActors() {
  const doctorUser = await NguoiDung.findOne({ email: TARGET_DOCTOR_EMAIL, role: 'doctor' })
  if (!doctorUser) throw new Error(`Không tìm thấy doctor ${TARGET_DOCTOR_EMAIL} — dừng.`)
  const bacSi = await BacSi.findOne({ user_id: doctorUser._id })
  if (!bacSi) throw new Error('Không tìm thấy hồ sơ BacSi Khang (TEST) — dừng.')
  const nurses = await NguoiDung.find({ role: 'nurse' }).select('_id ho_ten').lean()
  if (nurses.length !== 1) throw new Error(`Cần đúng 1 y tá, hiện ${nurses.length} — dừng.`)
  return { doctorUser, bacSi, nurse: nurses[0] }
}

// Chọn SO_NGAY ngày làm việc gần nhất TRƯỚC hôm nay: có LichLamViec của BS, không Chủ nhật,
// còn >=BN_MOI_NGAY slot 'active'. Trả [{schedule, ngay}].
async function pickWorkingDays(docId) {
  const todayStart = startOfDay(new Date())
  const days = []
  for (let back = 1; back <= 40 && days.length < SO_NGAY; back += 1) {
    const d = new Date(todayStart); d.setUTCDate(d.getUTCDate() - back)
    if (d.getUTCDay() === 0) continue // bỏ Chủ nhật
    const next = new Date(d); next.setUTCDate(next.getUTCDate() + 1)
    const schedules = await LichLamViec.find({ doctor_id: docId, ngay: { $gte: d, $lt: next } })
    if (!schedules.length) continue
    schedules.sort((a, b) =>
      b.slots.filter((s) => s.status === 'active').length - a.slots.filter((s) => s.status === 'active').length)
    const sch = schedules[0]
    if (sch.slots.filter((s) => s.status === 'active').length < BN_MOI_NGAY) continue
    days.push({ schedule: sch, ngay: d })
  }
  return days.reverse() // cũ -> mới
}

async function cleanup({ silent = false } = {}) {
  const appts = await LichHen.find({ ma_lich_hen: new RegExp('^' + APT_PREFIX) }).select('_id slot_id schedule_id').lean()
  const apptIds = appts.map((a) => a._id)
  const r = {}
  r.ketqua = (await KetQuaKham.deleteMany({ appointment_id: { $in: apptIds } })).deletedCount
  r.sinhhieu = (await SinhHieuKham.deleteMany({ appointment_id: { $in: apptIds } })).deletedCount
  r.hangdoi = (await HangDoi.deleteMany({ appointment_id: { $in: apptIds } })).deletedCount
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
  if (!silent) console.log('# CLEANUP LIVEHIST — đã xóa/trả:', r)
}

async function seed({ doctorUser, bacSi, nurse }) {
  const docId = bacSi._id
  await cleanup({ silent: true }) // idempotent

  const days = await pickWorkingDays(docId)
  if (days.length === 0) throw new Error('Không tìm được ngày làm việc phù hợp để dựng lịch sử — dừng.')

  const giaKham = bacSi.gia_kham ?? 0
  let nameIdx = 0
  let dxIdx = 0
  let totalAppt = 0, totalDone = 0, totalCancel = 0, totalNoShow = 0

  for (const { schedule, ngay } of days) {
    if (!schedule.nurse_id) schedule.nurse_id = nurse._id // gắn y tá trực ngày đó
    const activeSlots = schedule.slots.filter((s) => s.status === 'active').slice(0, BN_MOI_NGAY)
    const specialtyId = activeSlots[0]?.specialty_id ?? bacSi.specialties?.[0] ?? null
    const phongKham = activeSlots[0]?.phong_kham ?? bacSi.phong_kham_mac_dinh ?? null
    const dateStr = ngay.toISOString().slice(2, 10).replace(/-/g, '') // yymmdd

    for (let i = 0; i < activeSlots.length; i += 1) {
      const slot = activeSlots[i]
      const ten = pick(TEN_BN, nameIdx); nameIdx += 1
      const dx = pick(CHAN_DOAN, dxIdx); dxIdx += 1
      const ma = `${APT_PREFIX}${dateStr}_${String(i + 1).padStart(2, '0')}`
      // Ca cuối mỗi ngày: luân phiên hủy / không đến cho thực tế; còn lại đi trọn vòng.
      const isLast = i === activeSlots.length - 1
      const kind = isLast ? (i % 2 === 0 ? 'cancelled' : 'no_show') : 'done'
      slot.status = 'booked'

      const base = {
        doctor_id: docId, nurse_id: nurse._id, schedule_id: schedule._id, slot_id: slot._id,
        specialty_id: specialtyId, loai_kham: 'clinic', ngay_kham: ngay,
        gio_kham: slot.gio_bat_dau, gio_ket_thuc: slot.gio_ket_thuc, phong_kham: phongKham,
        gia_kham: giaKham, ten_dich_vu: 'Khám Tai Mũi Họng', ten_khach: ten,
        so_dien_thoai_khach: '09' + String(10000000 + ((nameIdx * 7919) % 89999999)).slice(0, 8),
        ly_do_kham: dx.ly, ma_lich_hen: ma,
      }
      const doneAt = buildGioHenGoc(ngay, slot.gio_bat_dau) ?? ngay

      if (kind === 'cancelled') {
        await LichHen.create({ ...base, status: 'cancelled', payment_status: 'refunded',
          ly_do_huy: pick(LY_DO_HUY, i), huy_boi: 'patient', thoi_diem_huy: doneAt })
        totalCancel += 1
      } else if (kind === 'no_show') {
        await LichHen.create({ ...base, status: 'no_show', payment_status: 'paid',
          trang_thai_den: 'khong_den', no_show_confirmed_at: doneAt })
        totalNoShow += 1
      } else {
        // TRỌN VÒNG: completed + đã thanh toán, hồ sơ da_xac_nhan, có sinh hiệu.
        const appt = await LichHen.create({ ...base, status: 'completed', payment_status: 'paid',
          trang_thai_den: 'da_den', gio_den_thuc_te: doneAt })
        const q = await HangDoi.create({
          nguon: 'online', appointment_id: appt._id, ten_benh_nhan: ten,
          so_dien_thoai: base.so_dien_thoai_khach, specialty_id: specialtyId, doctor_id: docId,
          muc_uu_tien: 'online_thuong', gio_hen_goc: doneAt, trang_thai: 'hoan_thanh',
          checkin_time: doneAt, thoi_diem_vao_phong: doneAt, thoi_diem_ket_thuc: doneAt,
          nguoi_tiep_nhan_id: nurse._id, vai_tro_tiep_nhan: 'nurse',
        })
        await KetQuaKham.create({
          appointment_id: appt._id, hang_doi_id: q._id, nguoi_nhap_id: nurse._id,
          bac_si_phu_trach_id: docId, status: 'da_xac_nhan',
          chan_doan: dx.cd, huong_dan_dieu_tri: dx.hd,
          trieu_chung_ban_dau: dx.ly, ghi_chu_dieu_duong: 'Bệnh nhân tỉnh, hợp tác tốt',
          nguoi_xac_nhan_id: doctorUser._id, thoi_diem_xac_nhan: doneAt, co_the_sua: false,
          lich_su_sua: [
            { nguoi_sua_id: nurse._id, thoi_diem_sua: doneAt, noi_dung: 'Y tá nhập hồ sơ khám' },
            { nguoi_sua_id: doctorUser._id, thoi_diem_sua: doneAt, noi_dung: 'Bác sĩ xác nhận hồ sơ khám' },
          ],
        })
        await SinhHieuKham.create({
          appointment_id: appt._id, hang_doi_id: q._id,
          can_nang: 48 + ((i * 5 + nameIdx) % 30), chieu_cao: 152 + ((nameIdx * 3) % 26),
          huyet_ap: pick(['110/70', '118/76', '120/80', '126/82', '130/85'], nameIdx),
          nhiet_do: [36.5, 36.8, 37, 37.2, 38][i % 5], nhip_tim: 68 + ((nameIdx * 4) % 24),
          nguoi_do_id: nurse._id, thoi_diem_do: doneAt,
        })
        totalDone += 1
      }
      totalAppt += 1
    }
    await schedule.save()
  }

  console.log('# SEED LIVEHIST — HOÀN TẤT')
  console.log(`  BS: "${doctorUser.ho_ten}" | Y tá: "${nurse.ho_ten}"`)
  console.log(`  Số ngày làm việc dựng: ${days.length} (${days.map((d) => d.ngay.toISOString().slice(0, 10)).join(', ')})`)
  console.log(`  Tổng lịch hẹn: ${totalAppt} — trọn vòng completed: ${totalDone}, hủy: ${totalCancel}, không đến: ${totalNoShow}`)
  console.log(`  Hồ sơ da_xac_nhan (y tá nhập + BS xác nhận): ${totalDone} · sinh hiệu: ${totalDone}`)
}

async function main() {
  const args = process.argv.slice(2)
  const doCleanup = args.includes('--cleanup')
  const doConfirm = args.includes('--confirm')
  if (!doCleanup && !doConfirm) {
    console.log('Seed "lịch sử vận hành" Khang (TEST) ↔ Thanh Hà. KHÔNG ghi nếu thiếu cờ.')
    console.log('  --confirm  : tạo lịch sử 6 ngày (dọn marker cũ trước)')
    console.log('  --cleanup  : dọn sạch theo marker LIVEHIST_ + trả slot về active')
    return
  }
  console.log('⏳ Kết nối MongoDB...')
  await mongoose.connect(uri)
  console.log('✅ Đã kết nối.')
  try {
    const actors = await resolveActors()
    if (doCleanup) await cleanup()
    else await seed(actors)
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((err) => { console.error('❌ Lỗi seed-khang-nurse-history:', err.message); process.exit(1) })
