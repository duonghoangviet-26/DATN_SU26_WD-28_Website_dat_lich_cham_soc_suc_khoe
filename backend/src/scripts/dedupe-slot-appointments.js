/**
 * GO TRUNG LICH HEN TREN CUNG MOT SLOT
 * =========================================================================
 * Rule muc 7: moi slot <-> toi da 1 `LichHen`. Rang buoc nay hien CHI ton tai trong code,
 * chua co index -> du lieu that da tich 5 cap trung (do 2026-07-26).
 *
 * Script nay don du lieu de CO THE tao unique partial index {schedule_id, slot_id}.
 * Chay TRUOC khi khoi dong backend co index moi, neu khong index build se that bai.
 *
 * LUAT GIU BAN NAO (theo do manh cua bang chung nghiep vu, giam dan):
 *   1. Da thuc su kham  — co `ket_qua_kham` hoac `hang_doi`
 *   2. Da thuc su tra tien — co ban ghi `thanh_toan` status='paid'
 *   3. Trang thai tien xa hon trong luong kham
 *   4. Tao sau (ban khach thuc su dung thuong la ban moi hon)
 *
 * AN TOAN:
 *   - Mac dinh DRY-RUN. Phai truyen --apply moi ghi.
 *   - KHONG XOA ban thua — chi chuyen sang `status='cancelled'` de index partial bo qua.
 *     Du lieu van tra cuu duoc, va co the hoan tac tu file sao luu.
 *   - Sao luu toan bo document bi anh huong ra JSON truoc khi ghi.
 *   - DUNG LAI neu mot nhom khong chon duoc ban thang ro rang (hoa o ca 4 tieu chi).
 *
 * DUNG:
 *   node src/scripts/dedupe-slot-appointments.js            # xem truoc
 *   node src/scripts/dedupe-slot-appointments.js --apply    # thuc thi
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { LichHen, HangDoi, KetQuaKham, ThanhToan, NhatKyThaoTac } from '../models/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const APPLY = process.argv.includes('--apply')

// Trang thai coi la "con chiem slot". `cancelled` khong chiem — do cung la cach script nay
// go trung: chuyen ban thua sang cancelled.
const TRANG_THAI_CHIEM_SLOT = [
  'pending', 'confirmed', 'checked_in', 'in_progress',
  'waiting_record', 'waiting_doctor_confirm', 'completed', 'no_show', 'skipped',
]

// Cang ve cuoi cang tien xa trong luong -> diem cao hon.
const THU_TU_TRANG_THAI = [
  'skipped', 'no_show', 'pending', 'confirmed', 'checked_in',
  'in_progress', 'waiting_record', 'waiting_doctor_confirm', 'completed',
]

async function chamDiem(appointment) {
  const [soHangDoi, soKetQua, soThanhToanPaid] = await Promise.all([
    HangDoi.countDocuments({ appointment_id: appointment._id }),
    KetQuaKham.countDocuments({ appointment_id: appointment._id }),
    ThanhToan.countDocuments({ appointment_id: appointment._id, status: 'paid' }),
  ])

  return {
    daKham: soHangDoi > 0 || soKetQua > 0 ? 1 : 0,
    daTraTien: soThanhToanPaid > 0 ? 1 : 0,
    tienTrinh: Math.max(0, THU_TU_TRANG_THAI.indexOf(appointment.status)),
    thoiDiemTao: appointment.ngay_tao?.getTime() ?? 0,
    _chiTiet: { soHangDoi, soKetQua, soThanhToanPaid },
  }
}

// Tra ve so am neu a thang, duong neu b thang, 0 neu hoa o ca 4 tieu chi.
function soSanh(a, b) {
  return (
    b.diem.daKham - a.diem.daKham
    || b.diem.daTraTien - a.diem.daTraTien
    || b.diem.tienTrinh - a.diem.tienTrinh
    || b.diem.thoiDiemTao - a.diem.thoiDiemTao
  )
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  const dbName = mongoose.connection.db.databaseName
  console.log(`DB: ${dbName}`)
  console.log(`Che do: ${APPLY ? '⚠️  APPLY (se ghi)' : 'DRY-RUN (chi xem)'}\n`)

  const nhomTrung = await LichHen.aggregate([
    {
      $match: {
        status: { $in: TRANG_THAI_CHIEM_SLOT },
        schedule_id: { $ne: null },
        slot_id: { $ne: null },
      },
    },
    { $group: { _id: { schedule_id: '$schedule_id', slot_id: '$slot_id' }, ids: { $push: '$_id' } } },
    { $match: { 'ids.1': { $exists: true } } },
  ])

  if (nhomTrung.length === 0) {
    console.log('Khong co slot nao bi trung lich hen. Co the tao index an toan.')
    await mongoose.disconnect()
    return
  }

  const canHuy = []
  const khongQuyetDuoc = []

  for (const nhom of nhomTrung) {
    const docs = await LichHen.find({ _id: { $in: nhom.ids } })
    const ungVien = []
    for (const doc of docs) {
      ungVien.push({ doc, diem: await chamDiem(doc) })
    }
    ungVien.sort(soSanh)

    const thang = ungVien[0]
    const thua = ungVien.slice(1)

    // Hoa tuyet doi voi ban ke tiep -> khong tu quyet, de nguoi xem.
    if (soSanh(thang, thua[0]) === 0) {
      khongQuyetDuoc.push({ nhom, ungVien })
      continue
    }

    console.log(`Slot ...${String(nhom._id.slot_id).slice(-6)}`)
    console.log(`  GIU  ${thang.doc.ma_lich_hen || '(khong ma)'} — status=${thang.doc.status}, `
      + `da_kham=${thang.diem.daKham ? 'co' : 'khong'}, thanh_toan_paid=${thang.diem._chiTiet.soThanhToanPaid}`)
    for (const item of thua) {
      console.log(`  HUY  ${item.doc.ma_lich_hen || '(khong ma)'} — status=${item.doc.status}, `
        + `da_kham=${item.diem.daKham ? 'co' : 'khong'}, thanh_toan_paid=${item.diem._chiTiet.soThanhToanPaid}`)
      canHuy.push({
        _id: item.doc._id,
        ma: item.doc.ma_lich_hen,
        giu_lai_ma: thang.doc.ma_lich_hen,
        slot_id: nhom._id.slot_id,
      })
    }
  }

  if (khongQuyetDuoc.length > 0) {
    console.log(`\n⛔ ${khongQuyetDuoc.length} nhom KHONG quyet duoc (hoa ca 4 tieu chi) — `
      + 'phai xu ly tay, script dung lai de khong doan bua:')
    for (const { nhom, ungVien } of khongQuyetDuoc) {
      console.log(`  slot ${nhom._id.slot_id}: ${ungVien.map((u) => u.doc.ma_lich_hen || u.doc._id).join(' vs ')}`)
    }
    await mongoose.disconnect()
    process.exit(1)
  }

  console.log(`\nTong: se huy ${canHuy.length} lich hen trung tren ${nhomTrung.length} slot.`)

  if (!APPLY) {
    console.log('DRY-RUN — chua ghi gi. Chay lai voi --apply de thuc thi.')
    await mongoose.disconnect()
    return
  }

  const backup = await LichHen.find({ _id: { $in: canHuy.map((r) => r._id) } }).lean()
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(__dirname, `../../backups/dedupe-slot-appointments-${dbName}-${stamp}.json`)
  await fs.mkdir(path.dirname(backupPath), { recursive: true })
  await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf8')
  console.log(`\nDa sao luu ${backup.length} lich hen -> ${backupPath}`)

  let daHuy = 0
  for (const r of canHuy) {
    // updateOne truc tiep: bo qua pre('validate') cua LichHen — cac ban ghi cu nay co the
    // thieu field bat buoc theo schema hien tai, va muc tieu o day chi la doi trang thai.
    const res = await LichHen.updateOne(
      { _id: r._id, status: { $in: TRANG_THAI_CHIEM_SLOT } },
      {
        $set: {
          status: 'cancelled',
          huy_boi: 'system',
          thoi_diem_huy: new Date(),
          ly_do_huy: `Trung slot voi lich hen ${r.giu_lai_ma || '(khong ma)'} — go trung de ap rang buoc 1 slot = 1 lich hen (rule muc 7)`,
          payment_deadline: null,
        },
      },
    )
    if (res.modifiedCount > 0) daHuy += 1

    await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: null,
      vai_tro: 'system',
      hanh_dong: 'DEDUPE_SLOT_APPOINTMENT',
      loai_doi_tuong: 'appointment',
      doi_tuong_id: r._id,
      ly_do: `Huy lich hen ${r.ma || '(khong ma)'} vi trung slot ${r.slot_id} voi ${r.giu_lai_ma || '(khong ma)'}. Sao luu: ${path.basename(backupPath)}`,
    })
  }

  console.log(`\n✅ Da huy ${daHuy}/${canHuy.length} lich hen trung.`)
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error('❌ Loi:', err.message)
  await mongoose.disconnect()
  process.exit(1)
})
