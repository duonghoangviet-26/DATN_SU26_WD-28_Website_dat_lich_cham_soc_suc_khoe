/**
 * NHA SLOT `pending_payment` BI KET VINH VIEN
 * =========================================================================
 * VAN DE (phat hien 2026-07-25 tren DATN_VITAFAMILY):
 *   Co che nha slot hien chay TU PHIA LICH HEN: cron `autoCancelExpiredHomeAppointments`
 *   tim `LichHen` co `payment_deadline < now` roi goi `releaseAppointmentSlot({ appointment })`.
 *   => Slot `pending_payment` KHONG con LichHen tro tới (hoac LichHen da `cancelled`,
 *      `payment_deadline=null`) thi khong co duong nao duoc nha. Slot khoa VINH VIEN,
 *      khach khong dat duoc trong khi ghe that su trong.
 *
 *   Ngoai ra co slot `pending_payment` ma `pending_expired_at = null` — giu cho KHONG HAN,
 *   khong bao gio het han nen cung khong bao gio duoc nha.
 *
 * SCRIPT NAY chi sua DU LIEU (nha slot). Lo hong CO CHE (thieu quet tu phia slot +
 * nha lazy luc doc lich) thuoc rule §11 — xem docs/Phan tich lo hong... (2026-07-25).
 *
 * AN TOAN:
 *   - Mac dinh DRY-RUN, chi in ra. Phai truyen --apply moi ghi.
 *   - Sao luu cac document bi anh huong ra file JSON truoc khi ghi.
 *   - BO QUA slot dang giu cho HOP LE (pending_expired_at con o tuong lai).
 *   - BO QUA slot co LichHen dang hoat dong (`pending`/`confirmed` chua qua han) —
 *     nhung slot nay de cron xu ly theo dung luong, khong can can thiep.
 *
 * DUNG:
 *   node src/scripts/release-stuck-pending-slots.js              # xem truoc
 *   node src/scripts/release-stuck-pending-slots.js --apply      # thuc thi
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { LichLamViec, LichHen, NhatKyThaoTac } from '../models/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const APPLY = process.argv.includes('--apply')
const TRANG_THAI_LICH_HEN_CON_HIEU_LUC = ['pending', 'confirmed']

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  const dbName = mongoose.connection.db.databaseName
  console.log(`DB: ${dbName}`)
  console.log(`Che do: ${APPLY ? '⚠️  APPLY (se ghi)' : 'DRY-RUN (chi xem)'}\n`)

  const now = new Date()
  const schedules = await LichLamViec.find({ 'slots.status': 'pending_payment' })

  const canNha = []
  const boQua = []

  for (const sch of schedules) {
    for (const slot of sch.slots) {
      if (slot.status !== 'pending_payment') continue

      const ngay = sch.ngay?.toISOString().slice(0, 10)
      const nhan = `${ngay} ${slot.gio_bat_dau} (slot ...${String(slot._id).slice(-6)})`

      // Giu cho HOP LE — con trong cua so thanh toan, khong duoc dung.
      if (slot.pending_expired_at && slot.pending_expired_at > now) {
        boQua.push(`${nhan} — dang giu cho hop le, het han ${slot.pending_expired_at.toISOString()}`)
        continue
      }

      // Tim LichHen: uu tien slot_id, fallback schedule+gio (lich cu khong co slot_id).
      const lichHen = await LichHen.findOne({ slot_id: slot._id })
        ?? await LichHen.findOne({ schedule_id: sch._id, gio_kham: slot.gio_bat_dau })

      // LichHen con hieu luc va CHUA qua han thanh toan -> de cron xu ly dung luong.
      if (
        lichHen
        && TRANG_THAI_LICH_HEN_CON_HIEU_LUC.includes(lichHen.status)
        && lichHen.payment_deadline
        && lichHen.payment_deadline > now
      ) {
        boQua.push(`${nhan} — LichHen ${lichHen.ma_lich_hen} con han thanh toan, de cron xu ly`)
        continue
      }

      canNha.push({
        schedule_id: sch._id,
        slot_id: slot._id,
        nhan,
        ly_do: !lichHen
          ? 'khong co LichHen tro tới'
          : `LichHen ${lichHen.ma_lich_hen ?? '(khong ma)'} status=${lichHen.status} payment=${lichHen.payment_status} deadline=${lichHen.payment_deadline?.toISOString() ?? 'null'}`,
        pending_expired_at: slot.pending_expired_at,
        benh_nhan_id: slot.benh_nhan_id,
      })
    }
  }

  console.log(`Se nha: ${canNha.length} slot`)
  canNha.forEach((r) => console.log(`  ✓ ${r.nhan}\n      ${r.ly_do}`))
  if (boQua.length > 0) {
    console.log(`\nBo qua: ${boQua.length} slot`)
    boQua.forEach((m) => console.log(`  – ${m}`))
  }

  if (canNha.length === 0) {
    console.log('\nKhong co slot nao can nha.')
    await mongoose.disconnect()
    return
  }

  if (!APPLY) {
    console.log('\nDRY-RUN — chua ghi gi. Chay lai voi --apply de thuc thi.')
    await mongoose.disconnect()
    return
  }

  // ── Sao luu truoc khi ghi ─────────────────────────────────────────────────
  const scheduleIds = [...new Set(canNha.map((r) => String(r.schedule_id)))]
  const backup = await LichLamViec.find({ _id: { $in: scheduleIds } }).lean()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(__dirname, `../../backups/stuck-slots-${dbName}-${stamp}.json`)
  await fs.mkdir(path.dirname(backupPath), { recursive: true })
  await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf8')
  console.log(`\nDa sao luu ${backup.length} document lich lam viec -> ${backupPath}`)

  // ── Nha slot ──────────────────────────────────────────────────────────────
  let daNha = 0
  for (const r of canNha) {
    const res = await LichLamViec.updateOne(
      { _id: r.schedule_id },
      {
        $set: {
          'slots.$[s].status': 'active',
          'slots.$[s].benh_nhan_id': null,
          'slots.$[s].benh_nhan_tam_giu_id': null,
          'slots.$[s].pending_expired_at': null,
        },
      },
      { arrayFilters: [{ 's._id': r.slot_id, 's.status': 'pending_payment' }] },
    )
    if (res.modifiedCount > 0) daNha += 1
  }

  // 1 ban ghi nhat ky / lich lam viec bi anh huong — `doi_tuong_id` la required nen khong
  // ghi duoc 1 ban ghi tong voi doi_tuong_id=null.
  for (const scheduleId of scheduleIds) {
    const soSlot = canNha.filter((r) => String(r.schedule_id) === scheduleId).length
    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: null,
      vai_tro: 'system',
      hanh_dong: 'RELEASE_STUCK_PENDING_SLOTS',
      loai_doi_tuong: 'schedule',
      doi_tuong_id: scheduleId,
      ly_do: `Nha ${soSlot} slot pending_payment bi ket vinh vien (khong co duong nha tu phia LichHen). Sao luu: ${path.basename(backupPath)}`,
    })
  }

  console.log(`\n✅ Da nha ${daNha}/${canNha.length} slot.`)
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error('❌ Loi:', err.message)
  await mongoose.disconnect()
  process.exit(1)
})
