/**
 * SINH LAI SLOT CHO LICH LAM VIEC TUONG LAI THEO CAU HINH CHUYEN KHOA
 * =========================================================================
 * Rule muc 2/4: so slot moi khung + quota online 70/30 lay tu `ChuyenKhoa`.
 *
 * VAN DE: `scheduleGenerator` BO QUA ngay da co lich (`reason: 'exists'`), nen sau khi
 * khoi phuc cau hinh (L14) cac ngay tuong lai VAN giu chuan cu — do 2026-07-26 tren DB
 * nhom: 195 lich con 15 slot khong co `khung_index`/`loai_slot`, tuc benh nhan chi thay
 * 1 cho moi khung va khong ton tai slot walk-in nao.
 *
 * AN TOAN — chi dung toi lich thoa DU CA 4 dieu kien:
 *   1. Ngay >= hom nay (khong bao gio sua qua khu).
 *   2. MOI slot deu `status='active'` — chua ai giu cho, chua ai dat, khong slot nao bi
 *      khoa boi nghi phep (khoa se lam status != 'active').
 *   3. Khong co `LichHen` con hieu luc nao tro toi lich do.
 *   4. Bo slot hien tai KHAC voi bo slot sinh ra tu cau hinh (khong ghi thua).
 *
 *   - Mac dinh DRY-RUN. Phai truyen --apply moi ghi.
 *   - Sao luu toan bo lich bi anh huong ra JSON truoc khi ghi.
 *   - GIU NGUYEN `trang_thai_ngay`, `trang_thai_xac_nhan`, `chi_nhanh_id` — chi thay `slots`.
 *
 * DUNG:
 *   node src/scripts/regenerate-future-schedules.js                # xem truoc
 *   node src/scripts/regenerate-future-schedules.js --apply        # thuc thi
 *   node src/scripts/regenerate-future-schedules.js --days 30      # gioi han pham vi
 */
import '../config/timezone.js'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { BacSi, LichLamViec, LichHen, NhatKyThaoTac } from '../models/index.js'
import { buildDefaultScheduleSlots } from '../services/scheduleGenerator.service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const APPLY = process.argv.includes('--apply')
const daysArgIndex = process.argv.indexOf('--days')
const SO_NGAY = daysArgIndex >= 0 ? Number(process.argv[daysArgIndex + 1]) : null

const TRANG_THAI_LICH_HEN_CON_HIEU_LUC = [
  'pending', 'confirmed', 'checked_in', 'in_progress',
  'waiting_record', 'waiting_doctor_confirm', 'completed', 'no_show', 'skipped',
]

// Hai bo slot coi la giong nhau khi trung ca gio, khung va loai — du _id khac.
function chuKySlot(slots) {
  return slots
    .map((s) => `${s.gio_bat_dau}-${s.gio_ket_thuc}|${s.khung_index ?? 'x'}|${s.loai_slot ?? 'x'}`)
    .join(',')
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  const dbName = mongoose.connection.db.databaseName
  console.log(`DB: ${dbName}`)
  console.log(`Che do: ${APPLY ? '⚠️  APPLY (se ghi)' : 'DRY-RUN (chi xem)'}`)

  const homNay = new Date()
  homNay.setUTCHours(0, 0, 0, 0)
  const filter = { ngay: { $gte: homNay } }
  if (SO_NGAY) {
    filter.ngay.$lt = new Date(homNay.getTime() + SO_NGAY * 86400000)
    console.log(`Pham vi: ${SO_NGAY} ngay toi`)
  }
  console.log('')

  const schedules = await LichLamViec.find(filter).sort({ ngay: 1 }).lean()
  const doctorIds = [...new Set(schedules.map((s) => String(s.doctor_id)))]
  const doctors = await BacSi.find({ _id: { $in: doctorIds } })
    .select('_id specialties phong_kham_mac_dinh').lean()
  const bacSiTheoId = new Map(doctors.map((d) => [String(d._id), d]))

  // Mot truy van duy nhat cho toan bo lich — tranh N+1 tren vai tram ban ghi.
  const lichCoHen = new Set(
    (await LichHen.find({
      schedule_id: { $in: schedules.map((s) => s._id) },
      status: { $in: TRANG_THAI_LICH_HEN_CON_HIEU_LUC },
    }).select('schedule_id').lean()).map((a) => String(a.schedule_id))
  )

  const canSua = []
  const boQua = { coLichHen: 0, slotDaDung: 0, daDungChuan: 0, khongCoBacSi: 0 }
  const cacheSlotTheoBacSi = new Map()

  for (const schedule of schedules) {
    const nhan = `${schedule.ngay.toISOString().slice(0, 10)} bac si ...${String(schedule.doctor_id).slice(-6)}`

    if (lichCoHen.has(String(schedule._id))) { boQua.coLichHen += 1; continue }
    if (schedule.slots.some((s) => s.status !== 'active')) { boQua.slotDaDung += 1; continue }

    const doctor = bacSiTheoId.get(String(schedule.doctor_id))
    if (!doctor) { boQua.khongCoBacSi += 1; continue }

    const khoaCache = `${doctor._id}`
    if (!cacheSlotTheoBacSi.has(khoaCache)) {
      cacheSlotTheoBacSi.set(khoaCache, await buildDefaultScheduleSlots({
        specialtyId: doctor.specialties?.[0] ?? null,
        phongKham: doctor.phong_kham_mac_dinh ?? null,
      }))
    }
    const slotMoi = cacheSlotTheoBacSi.get(khoaCache)

    if (chuKySlot(schedule.slots) === chuKySlot(slotMoi)) { boQua.daDungChuan += 1; continue }

    canSua.push({
      _id: schedule._id,
      nhan,
      slotCu: schedule.slots.length,
      slotMoi,
    })
  }

  console.log(`Tong lich xet          : ${schedules.length}`)
  console.log(`  da dung chuan        : ${boQua.daDungChuan}`)
  console.log(`  co lich hen (bo qua) : ${boQua.coLichHen}`)
  console.log(`  co slot da dung      : ${boQua.slotDaDung}`)
  console.log(`  khong tim thay bac si: ${boQua.khongCoBacSi}`)
  console.log(`  SE SINH LAI          : ${canSua.length}`)

  if (canSua.length > 0) {
    const mau = canSua[0]
    const online = mau.slotMoi.filter((s) => s.loai_slot === 'online').length
    console.log(`\nVi du (${mau.nhan}): ${mau.slotCu} slot -> ${mau.slotMoi.length} slot `
      + `(${online} online / ${mau.slotMoi.length - online} walk-in)`)
  }

  if (canSua.length === 0 || !APPLY) {
    if (canSua.length > 0) console.log('\nDRY-RUN — chua ghi gi. Chay lai voi --apply de thuc thi.')
    await mongoose.disconnect()
    return
  }

  const backup = await LichLamViec.find({ _id: { $in: canSua.map((r) => r._id) } }).lean()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(__dirname, `../../backups/regenerate-schedules-${dbName}-${stamp}.json`)
  await fs.mkdir(path.dirname(backupPath), { recursive: true })
  await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf8')
  console.log(`\nDa sao luu ${backup.length} lich -> ${backupPath}`)

  let daSua = 0
  for (const r of canSua) {
    // Dieu kien lap lai trong filter: giua luc doc va luc ghi co the co nguoi vua dat cho.
    const res = await LichLamViec.updateOne(
      { _id: r._id, slots: { $not: { $elemMatch: { status: { $ne: 'active' } } } } },
      { $set: { slots: r.slotMoi } },
    )
    if (res.modifiedCount > 0) daSua += 1
  }

  await NhatKyThaoTac.create({
    nguoi_thuc_hien_id: null,
    vai_tro: 'system',
    hanh_dong: 'REGENERATE_FUTURE_SCHEDULE_SLOTS',
    loai_doi_tuong: 'schedule',
    doi_tuong_id: canSua[0]._id,
    ly_do: `Sinh lai slot cho ${daSua} lich lam viec tuong lai theo cau hinh chuyen khoa `
      + `(rule muc 2/4). Sao luu: ${path.basename(backupPath)}`,
  })

  console.log(`\n✅ Da sinh lai ${daSua}/${canSua.length} lich.`)
  if (daSua < canSua.length) {
    console.log(`   ${canSua.length - daSua} lich bi bo qua vi vua co nguoi giu cho trong luc chay.`)
  }
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error('❌ Loi:', err.message)
  await mongoose.disconnect()
  process.exit(1)
})
