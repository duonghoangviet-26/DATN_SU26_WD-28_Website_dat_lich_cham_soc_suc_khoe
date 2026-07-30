/**
 * HOAN TAC cac lich hen bi cron danh dau `no_show` tu dong
 * ========================================================
 * `no_show` dong nghia MAT 100% TIEN cua khach (rule muc 5), va cron dat trang thai do
 * MOT CACH TU DONG (rule muc 8). Bat ky hanh dong tu dong lam mat tien deu phai co duong
 * lui — day la duong lui do.
 *
 * Da dung that 2026-07-26: cron chay tren DB dung chung cua nhom va danh dau 5 lich hen
 * demo da thanh toan. Sau su co nay mac dinh cua cron doi thanh "chi bat khi
 * NODE_ENV=production" (xem `services/noShowSweep.service.js`).
 *
 * ⚠️ CHI hoan tac ban ghi CO nhat ky `AUTO_MARK_NO_SHOW` — tuc do cron dat. Du lieu `no_show`
 * co san tu truoc (vd seed) KHONG bi dung toi. Trang thai cu lay tu `du_lieu_cu` trong nhat
 * ky, KHONG doan.
 *
 * DUNG:
 *   node src/scripts/hoan-tac-no-show.js            # chay thu + luu sao luu
 *   node src/scripts/hoan-tac-no-show.js --apply    # ghi that
 */
import '../config/timezone.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { LichHen, NhatKyThaoTac, ThongBao } from '../models/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const APPLY = process.argv.includes('--apply')
const THU_MUC_SAO_LUU = path.join(__dirname, '../../backups')
const TIEU_DE_THONG_BAO = 'Lịch hẹn được ghi nhận không đến'

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log(`DB: ${mongoose.connection.db.databaseName} | che do: ${APPLY ? 'GHI THAT' : 'chay thu'}`)

  const logs = await NhatKyThaoTac.find({ hanh_dong: 'AUTO_MARK_NO_SHOW' }).lean()
  if (logs.length === 0) {
    console.log('Khong co ban ghi nao do cron danh dau. Khong co gi de hoan tac.')
    await mongoose.disconnect()
    return
  }

  const ids = logs.map((l) => l.doi_tuong_id)

  // Sao luu TRUOC khi ghi — day la du lieu tien, khong duoc mat duong ve.
  fs.mkdirSync(THU_MUC_SAO_LUU, { recursive: true })
  const fileSaoLuu = path.join(THU_MUC_SAO_LUU, `no-show-truoc-hoan-tac-${Date.now()}.json`)
  fs.writeFileSync(fileSaoLuu, JSON.stringify(await LichHen.find({ _id: { $in: ids } }).lean(), null, 2))
  console.log(`Sao luu: ${fileSaoLuu}`)

  let daHoanTac = 0
  const boQua = []

  for (const log of logs) {
    const appt = await LichHen.findById(log.doi_tuong_id)
    if (!appt) { boQua.push(`${log.doi_tuong_id}: khong con lich hen`); continue }
    if (appt.status !== 'no_show') { boQua.push(`${appt.ma_lich_hen}: dang '${appt.status}' — bo qua`); continue }

    const statusCu = log.du_lieu_cu?.status
    if (!statusCu) { boQua.push(`${appt.ma_lich_hen}: nhat ky khong luu status cu — bo qua`); continue }

    console.log(`  ${appt.ma_lich_hen}: no_show -> ${statusCu}`)
    if (APPLY) {
      // `updateOne` chu khong `save()`: `pre('validate')` cua LichHen kiem ca field khong lien
      // quan, mot ban ghi cu thieu field se lam khong hoan tac duoc (xem checkIn.service.js).
      await LichHen.updateOne({ _id: appt._id }, { $set: { status: statusCu, no_show_confirmed_at: null } })
      await ThongBao.deleteMany({ related_id: appt._id, tieu_de: TIEU_DE_THONG_BAO })
      await NhatKyThaoTac.create({
        nguoi_thuc_hien_id: null,
        vai_tro: 'system',
        hanh_dong: 'UNDO_AUTO_MARK_NO_SHOW',
        loai_doi_tuong: 'appointment',
        doi_tuong_id: appt._id,
        ly_do: 'Hoan tac danh dau no_show tu dong (du lieu demo, khong phai khach that khong den)',
        du_lieu_cu: { status: 'no_show' },
        du_lieu_moi: { status: statusCu },
      })
    }
    daHoanTac += 1
  }

  console.log(`\n${APPLY ? 'Da hoan tac' : 'Se hoan tac'}: ${daHoanTac} lich hen`)
  for (const b of boQua) console.log(`  - ${b}`)
  if (!APPLY) console.log('\nChay lai voi --apply de ghi that.')

  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error('Loi:', err.message)
  try { await mongoose.disconnect() } catch { /* da ngat */ }
  process.exit(1)
})
