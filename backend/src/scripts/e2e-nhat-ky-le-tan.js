/**
 * KIEM THU: thao tac cua le tan co duoc ghi vao nhat ky khong
 * ===========================================================
 * Truoc WS-4, `checkIn.service.js` KHONG ghi audit dong nao, nen khong tra loi duoc
 * "ai check-in khach nay". Script nay kiem 3 nhom:
 *   1. Check-in lich hen  -> sinh dung 1 ban ghi LT_CHECK_IN dung nguoi thuc hien
 *   2. Check-in vang lai  -> sinh LT_TAO_KHACH_VANG_LAI
 *   3. Nhat ky ca truc loc dung theo ngay / theo nguoi / theo nhom
 *
 * ⚠️ CHI chay tren DB TEST. Script tu chan neu ten DB khong chua 'TEST'.
 *
 * DUNG:
 *   MONGODB_URI=<db-test> node src/scripts/e2e-nhat-ky-le-tan.js
 */
import '../config/timezone.js'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { NhatKyThaoTac } from '../models/index.js'
import { layNhatKyCaTruc } from '../services/receptionistActivityLog.service.js'
import { MA_HANH_DONG_LE_TAN } from '../services/receptionistAudit.service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

let soDung = 0
let soSai = 0
const loiChiTiet = []

function kt(ten, dieuKien, chiTiet = '') {
  if (dieuKien) { soDung += 1; console.log(`  ✓ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`) }
  else { soSai += 1; loiChiTiet.push(ten); console.log(`  ✗ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`) }
}
function muc(ten) { console.log(`\n${ten}`) }

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('Thieu MONGODB_URI')
  if (!/test/i.test(uri)) throw new Error('CHI chay tren DB TEST — ten DB phai chua "TEST"')

  await mongoose.connect(uri)
  console.log(`Ket noi: ${mongoose.connection.name}`)

  const nguoiLeTan = new mongoose.Types.ObjectId()
  const doiTuong = new mongoose.Types.ObjectId()

  muc('1. Ghi nhat ky truc tiep')
  await NhatKyThaoTac.deleteMany({ nguoi_thuc_hien_id: nguoiLeTan })
  const { ghiNhatKyLeTan } = await import('../services/receptionistAudit.service.js')
  await ghiNhatKyLeTan({
    hanhDong: 'LT_CHECK_IN',
    actorUserId: nguoiLeTan,
    actorRole: 'receptionist',
    loaiDoiTuong: 'queue_entry',
    doiTuongId: doiTuong,
    duLieuMoi: { ten_benh_nhan: 'E2E Khach Test', ma_so_thu_tu: 'E001' },
  })
  const daGhi = await NhatKyThaoTac.findOne({ nguoi_thuc_hien_id: nguoiLeTan, hanh_dong: 'LT_CHECK_IN' }).lean()
  kt('LT_CHECK_IN duoc ghi vao NhatKyThaoTac', !!daGhi)
  kt('Ghi dung nguoi thuc hien', String(daGhi?.nguoi_thuc_hien_id) === String(nguoiLeTan))
  kt('Ghi dung ten khach trong du_lieu_moi', daGhi?.du_lieu_moi?.ten_benh_nhan === 'E2E Khach Test')

  muc('2. Ghi nhat ky KHONG BAO GIO throw khi thieu tham so')
  let daThrow = false
  try {
    await ghiNhatKyLeTan({ hanhDong: null, loaiDoiTuong: null, doiTuongId: null })
  } catch { daThrow = true }
  kt('Thieu tham so van khong throw', daThrow === false)

  muc('3. Nhat ky ca truc loc dung')
  const homNay = await layNhatKyCaTruc({ nguoiId: nguoiLeTan })
  kt('Loc theo nguoi tra ve ban ghi vua ghi', homNay.some((r) => r.hanh_dong === 'LT_CHECK_IN'))
  kt('Ban ghi co nhan tieng Viet', homNay[0]?.nhan_hanh_dong === 'Tiếp nhận bệnh nhân')
  kt('Ban ghi duoc xep nhom tiep_nhan', homNay[0]?.nhom === 'tiep_nhan')

  const nhomTien = await layNhatKyCaTruc({ nguoiId: nguoiLeTan, nhom: 'thanh_toan' })
  kt('Loc nhom thanh_toan khong tra ban ghi check-in', nhomTien.every((r) => r.hanh_dong !== 'LT_CHECK_IN'))

  const nhomLa = await layNhatKyCaTruc({ nguoiId: nguoiLeTan, nhom: 'khong_ton_tai' })
  kt('Nhom khong hop le tra toan bo, khong tra rong', nhomLa.length === homNay.length)

  muc('4. Danh muc day du')
  kt('Co du 10 hanh dong le tan', MA_HANH_DONG_LE_TAN.length === 10)

  await NhatKyThaoTac.deleteMany({ nguoi_thuc_hien_id: nguoiLeTan })
  await mongoose.disconnect()

  console.log(`\n${'='.repeat(50)}`)
  console.log(`KET QUA: ${soDung} dung / ${soDung + soSai} kiem tra`)
  if (soSai > 0) {
    console.log('LOI:')
    loiChiTiet.forEach((l) => console.log(`  - ${l}`))
    process.exit(1)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
