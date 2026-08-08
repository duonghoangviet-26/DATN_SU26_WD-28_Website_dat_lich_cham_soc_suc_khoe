/**
 * KIEM THU DAU-CUOI: phien kham 4 buoc (WS-1) — tiep_nhan -> chan_doan -> dich_vu -> ke_don -> hoan_tat
 * =========================================================================================
 * Kiem toan bo luong bac si nhap ho so kham qua tang SERVICE (`layPhienKham` / `luuBuoc` /
 * `hoanTatPhienKham` trong `examSession.service.js`), goi truc tiep nhu ham async binh
 * thuong tren ket noi Mongo that — cung cach `e2e-luong-tiep-nhan.js` da lam, khong can
 * server Express dang chay.
 *
 * Vi sao can: cac task 1-6 cua ke hoach WS-1 deu duoc review THEO DIFF (tung file rieng le),
 * chua co lan nao chay CA CHUOI 4 buoc that tren DB that. Script nay la mat xich cuoi cung
 * chung minh cac manh ghep hoat dong dung VOI NHAU, khong chi dung rieng le.
 *
 * Kiem 12 nhom (1-11 theo brief task-7; nhom 12 them sau final review — xem C1/I2):
 *   1. Mo phien kham moi -> buoc_hien_tai='tiep_nhan', ho_so=null
 *   2. Buoc 1 thieu trieu chung -> loi 400, con tro KHONG tien
 *   3. Buoc 1 du -> buoc_hien_tai='chan_doan', sinh hieu ghi duoc, bmi tinh dung
 *   4. Nhay coc sang 'ke_don' khi dang o 'chan_doan' -> loi 409
 *   5. Buoc 2 -> buoc_hien_tai='dich_vu', chan_doan ghi dung
 *   6. Buoc 3 tick 1 dich vu -> dich_vu_phat_sinh co 1 dong, thanh_tien > 0,
 *      HangDoi.trang_thai VAN LA 'trong_phong' (quyet dinh Q1: khong roi phong)
 *   7. Buoc 4 ke 2 thuoc -> DonThuoc co 2 items; ke lai 1 thuoc -> con dung 1 (khong cong don)
 *   8. Quay lai buoc 1 sua trieu chung -> buoc_hien_tai VAN LA 'hoan_tat', khong lui
 *   9. Hoan tat -> KetQuaKham.status='da_xac_nhan', HangDoi='hoan_thanh', LichHen='completed',
 *      tra benh_nhan_ke_tiep va co_dich_vu_can_thu=true, VA nha phong (I2):
 *      TrangThaiPhongKham='dang_don_phong', benh_nhan_hien_tai_id=null, trung binh truot
 *   10. Hoan tat lan 2 -> loi (luot da xong) VA khong nha oan phong dang phuc vu nguoi khac
 *   11. Bac si khac goi cung queueId -> loi 403/404
 *   12. Luot DAT ONLINE (nguon='online') chay het 4 buoc + hoan tat (C1); ho so mang ca
 *       appointment_id lan hang_doi_id; getOwnedOfflineQueue VAN chan luot online
 *
 * ⚠️ CHI chay tren DB TEST. Script tu chan neu bien MONGODB_URI khong chua chu "test".
 *
 * DUNG:
 *   MONGODB_URI=<db-test> node src/scripts/e2e-phien-kham-4-buoc.js
 */
import '../config/timezone.js'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  BacSi, DichVu, DonThuoc, HangDoi, KetQuaKham, LichHen, NguoiDung, NhatKyThaoTac, SinhHieuKham,
  TrangThaiPhongKham,
} from '../models/index.js'
import { hoanTatPhienKham, layPhienKham, luuBuoc } from '../services/examSession.service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const TAG = 'E2E-PK4B'

let soDung = 0
let soSai = 0
const loiChiTiet = []

function kt(ten, dieuKien, chiTiet = '') {
  if (dieuKien) { soDung += 1; console.log(`  ✓ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`) }
  else { soSai += 1; loiChiTiet.push(`${ten}${chiTiet ? ` — ${chiTiet}` : ''}`); console.log(`  ✗ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`) }
}
function muc(ten) { console.log(`\n${ten}`) }

const daTao = { hangDoi: [], lichHen: [], nhatKy: [], phongTuTao: null, phongGoc: null }

async function donDep() {
  if (daTao.hangDoi.length) {
    await SinhHieuKham.deleteMany({ hang_doi_id: { $in: daTao.hangDoi } })
    const hoSos = await KetQuaKham.find({ hang_doi_id: { $in: daTao.hangDoi } }).select('_id').lean()
    const hoSoIds = hoSos.map((h) => h._id)
    if (hoSoIds.length) {
      await DonThuoc.deleteMany({ medical_record_id: { $in: hoSoIds } })
      await NhatKyThaoTac.deleteMany({ loai_doi_tuong: 'examination_result', doi_tuong_id: { $in: hoSoIds } })
    }
    await KetQuaKham.deleteMany({ hang_doi_id: { $in: daTao.hangDoi } })
    await HangDoi.deleteMany({ _id: { $in: daTao.hangDoi } })
  }
  if (daTao.nhatKy.length) await NhatKyThaoTac.deleteMany({ _id: { $in: daTao.nhatKy } })
  if (daTao.lichHen.length) await LichHen.deleteMany({ _id: { $in: daTao.lichHen } })
  // Tra trang thai phong ve nguyen trang: script nay MUON phong, khong duoc de lai rac.
  if (daTao.phongTuTao) {
    await TrangThaiPhongKham.deleteOne({ _id: daTao.phongTuTao })
  } else if (daTao.phongGoc) {
    await TrangThaiPhongKham.updateOne({ _id: daTao.phongGoc._id }, { $set: {
      trang_thai: daTao.phongGoc.trang_thai,
      benh_nhan_hien_tai_id: daTao.phongGoc.benh_nhan_hien_tai_id ?? null,
      thoi_gian_kham_tb_phut: daTao.phongGoc.thoi_gian_kham_tb_phut,
    } })
  }
}

/** Dat phong cua bac si ve dung trang thai "dang kham benh nhan nay" truoc khi hoan tat. */
async function datPhongDangKham(docId, queueId) {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  let room = await TrangThaiPhongKham.findOne({ doctor_id: docId, ngay: start })
  if (!room) {
    room = await TrangThaiPhongKham.create({ doctor_id: docId, ngay: start })
    if (!daTao.phongTuTao) daTao.phongTuTao = room._id
  } else if (!daTao.phongGoc && !daTao.phongTuTao) {
    daTao.phongGoc = room.toObject()
  }
  room.trang_thai = 'dang_kham'
  room.benh_nhan_hien_tai_id = queueId
  await room.save()
  return room
}

async function main() {
  // ── Khuon chan DB that — CHEP NGUYEN VAN tu brief, phai la dieu dau tien lam ──────────
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('Thieu MONGODB_URI')
  if (!/test/i.test(uri)) throw new Error('CHI chay tren DB TEST — ten DB phai chua "TEST"')

  await mongoose.connect(uri)
  const tenDb = mongoose.connection.db.databaseName
  if (!tenDb.toUpperCase().includes('TEST')) {
    console.error(`[${TAG}] DUNG LAI: "${tenDb}" khong phai DB test. Script nay ghi va xoa du lieu.`)
    process.exit(1)
  }
  console.log(`[${TAG}] DB: ${tenDb}`)

  // ── Fixture: tim (khong tao moi) 1 dich vu related dang active gan chuyen khoa, tu do
  // suy ra bac si A (co chuyen khoa do) va bac si B (bat ky bac si active nao khac) ───────
  const dichVu = await DichVu.findOne({ loai: 'related', status: 'active', specialty_id: { $ne: null } }).lean()
  if (!dichVu) {
    console.error(`[${TAG}] Khong tim duoc dich vu 'related' dang active tren DB test — chay seed truoc.`)
    process.exit(1)
  }
  const specialtyId = dichVu.specialty_id

  const bacSiA = await BacSi.findOne({ specialties: specialtyId, trang_thai: 'active', trang_thai_duyet: 'approved' }).lean()
  if (!bacSiA) {
    console.error(`[${TAG}] Khong tim duoc bac si active khop chuyen khoa cua dich vu ${dichVu.ten}.`)
    process.exit(1)
  }
  const bacSiB = await BacSi.findOne({ _id: { $ne: bacSiA._id }, trang_thai: 'active', trang_thai_duyet: 'approved' }).lean()
  if (!bacSiB) {
    console.error(`[${TAG}] Khong tim duoc bac si active thu hai tren DB test (can cho kiem tra 11).`)
    process.exit(1)
  }
  const userA = await NguoiDung.findById(bacSiA.user_id).lean()
  const userB = await NguoiDung.findById(bacSiB.user_id).lean()

  console.log(`[${TAG}] Bac si A: ${userA.ho_ten} | Bac si B: ${userB.ho_ten} | Dich vu: ${dichVu.ten} (${dichVu.gia}đ)`)

  // Lich hen "clinic" gia lap CHI de kiem nhanh LichHen->'completed' o buoc 9 (offline/walk-in
  // that su khong bao gio mang appointment_id — xem checkIn.service.js — nhung code trong
  // hoanTatPhienKham CO nhanh xu ly no nen phai kiem duoc nhanh nay it nhat 1 lan).
  // schedule_id/slot_id chi can la ObjectId hop le cho unique index, KHONG can trung 1 lich
  // lam viec that vi ta tao truc tiep qua Mongoose, khong di qua luong dat lich.
  const lichHenGiaLap = await LichHen.create({
    doctor_id: bacSiA._id,
    schedule_id: new mongoose.Types.ObjectId(),
    slot_id: new mongoose.Types.ObjectId(),
    specialty_id: specialtyId,
    loai_kham: 'clinic',
    ngay_kham: new Date(),
    gio_kham: '09:00',
    status: 'checked_in',
    gia_kham: 200000,
    ten_khach: `${TAG} Benh Nhan`,
    ma_lich_hen: `${TAG}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
  })
  daTao.lichHen.push(lichHenGiaLap._id)

  const hangDoiChinh = await HangDoi.create({
    nguon: 'offline',
    appointment_id: lichHenGiaLap._id,
    ten_benh_nhan: `${TAG} Benh Nhan`,
    so_dien_thoai: '0900000123',
    specialty_id: specialtyId,
    doctor_id: bacSiA._id,
    trang_thai: 'trong_phong',
    checkin_time: new Date(),
    // Co moc vao phong -> kich hoat nhanh cap nhat trung binh truot `thoi_gian_kham_tb_phut`.
    thoi_diem_vao_phong: new Date(Date.now() - 12 * 60000),
    muc_uu_tien: 'offline',
  })
  daTao.hangDoi.push(hangDoiChinh._id)
  const queueId = hangDoiChinh._id
  const docId = bacSiA._id
  const doctorUserId = userA._id

  // Fixture benh nhan ke tiep trong hang doi cua bac si A — de kiem `benh_nhan_ke_tiep` o buoc 9.
  const hangDoiKeTiep = await HangDoi.create({
    nguon: 'offline',
    ten_benh_nhan: `${TAG} Ke Tiep`,
    so_dien_thoai: '0900000456',
    specialty_id: specialtyId,
    doctor_id: bacSiA._id,
    trang_thai: 'dang_cho',
    checkin_time: new Date(),
    muc_uu_tien: 'offline',
  })
  daTao.hangDoi.push(hangDoiKeTiep._id)

  // ── 1 ──────────────────────────────────────────────────────────────────────────────────
  muc('1. Mo phien kham moi')
  {
    const phien = await layPhienKham({ queueId, docId })
    kt("buoc_hien_tai = 'tiep_nhan'", phien.buoc_hien_tai === 'tiep_nhan', phien.buoc_hien_tai)
    kt('ho_so = null (chua nhap gi)', phien.ho_so === null)
  }

  // ── 2 ──────────────────────────────────────────────────────────────────────────────────
  muc('2. Buoc 1 thieu trieu chung')
  {
    let loiBat = null
    try {
      await luuBuoc({ queueId, docId, doctorUserId, buoc: 'tiep_nhan', payload: {} })
    } catch (err) { loiBat = err }
    kt('nem loi', !!loiBat, loiBat?.message)
    kt('httpStatus = 400', loiBat?.httpStatus === 400, `${loiBat?.httpStatus}`)

    const phien = await layPhienKham({ queueId, docId })
    kt("con tro KHONG tien, van 'tiep_nhan'", phien.buoc_hien_tai === 'tiep_nhan', phien.buoc_hien_tai)
  }

  // ── 3 ──────────────────────────────────────────────────────────────────────────────────
  muc('3. Buoc 1 du du lieu')
  {
    const phien = await luuBuoc({
      queueId, docId, doctorUserId, buoc: 'tiep_nhan',
      payload: { trieu_chung_ban_dau: 'Dau hong 3 ngay', can_nang: 60, chieu_cao: 165 },
    })
    kt("buoc_hien_tai = 'chan_doan'", phien.buoc_hien_tai === 'chan_doan', phien.buoc_hien_tai)
    kt('bmi tinh dung (60kg/1.65m ≈ 22.0)', phien.bmi === 22, `bmi=${phien.bmi}`)
    kt('sinh_hieu tra ve dung can_nang/chieu_cao', phien.sinh_hieu?.can_nang === 60 && phien.sinh_hieu?.chieu_cao === 165)

    const sh = await SinhHieuKham.findOne({ hang_doi_id: queueId }).lean()
    kt('SinhHieuKham DA GHI xuong DB', !!sh, sh ? `can_nang=${sh.can_nang} chieu_cao=${sh.chieu_cao}` : 'KHONG CO')
  }

  // ── 4 ──────────────────────────────────────────────────────────────────────────────────
  muc("4. Nhay coc sang 'ke_don' khi dang o 'chan_doan'")
  {
    let loiBat = null
    try {
      await luuBuoc({ queueId, docId, doctorUserId, buoc: 'ke_don', payload: { thuoc: [] } })
    } catch (err) { loiBat = err }
    kt('nem loi', !!loiBat, loiBat?.message)
    kt('httpStatus = 409', loiBat?.httpStatus === 409, `${loiBat?.httpStatus}`)

    const phien = await layPhienKham({ queueId, docId })
    kt("con tro KHONG tien, van 'chan_doan'", phien.buoc_hien_tai === 'chan_doan', phien.buoc_hien_tai)
  }

  // ── 5 ──────────────────────────────────────────────────────────────────────────────────
  muc('5. Buoc 2 — chan doan')
  {
    const phien = await luuBuoc({
      queueId, docId, doctorUserId, buoc: 'chan_doan',
      payload: { chan_doan: 'Viêm họng cấp', huong_dan_dieu_tri: 'Uống thuốc, súc miệng nước muối' },
    })
    kt("buoc_hien_tai = 'dich_vu'", phien.buoc_hien_tai === 'dich_vu', phien.buoc_hien_tai)
    kt('chan_doan ghi dung', phien.ho_so?.chan_doan === 'Viêm họng cấp', phien.ho_so?.chan_doan)
  }

  // ── 6 ──────────────────────────────────────────────────────────────────────────────────
  muc('6. Buoc 3 — tick 1 dich vu phat sinh (Q1: khong roi phong)')
  {
    const phien = await luuBuoc({
      queueId, docId, doctorUserId, buoc: 'dich_vu',
      payload: { dich_vu_phat_sinh: [{ service_id: String(dichVu._id), so_luong: 1 }] },
    })
    kt("buoc_hien_tai = 'ke_don'", phien.buoc_hien_tai === 'ke_don', phien.buoc_hien_tai)
    kt('dich_vu_phat_sinh co dung 1 dong', phien.ho_so?.dich_vu_phat_sinh?.length === 1, `${phien.ho_so?.dich_vu_phat_sinh?.length}`)
    const dong = phien.ho_so?.dich_vu_phat_sinh?.[0]
    kt('thanh_tien > 0', (dong?.thanh_tien ?? 0) > 0, `thanh_tien=${dong?.thanh_tien}`)

    const hd = await HangDoi.findById(queueId).lean()
    kt("HangDoi.trang_thai VAN LA 'trong_phong' (Q1)", hd.trang_thai === 'trong_phong', hd.trang_thai)
  }

  // ── 7 ──────────────────────────────────────────────────────────────────────────────────
  muc('7. Buoc 4 — ke don thuoc (khong cong don)')
  {
    const phien2thuoc = await luuBuoc({
      queueId, docId, doctorUserId, buoc: 'ke_don',
      payload: { thuoc: [
        { ten_thuoc: 'Paracetamol 500mg', so_ngay: 5, lieu_luong: '1 vien', tan_suat: '2 lan/ngay' },
        { ten_thuoc: 'Vitamin C', so_ngay: 5, lieu_luong: '1 vien', tan_suat: '1 lan/ngay' },
      ] },
    })
    kt("buoc_hien_tai da tien sang 'hoan_tat'", phien2thuoc.buoc_hien_tai === 'hoan_tat', phien2thuoc.buoc_hien_tai)
    kt('DonThuoc co dung 2 items (qua response)', phien2thuoc.thuoc?.length === 2, `${phien2thuoc.thuoc?.length}`)

    const hoSo1 = await KetQuaKham.findOne({ hang_doi_id: queueId }).lean()
    const dt1 = await DonThuoc.findOne({ medical_record_id: hoSo1._id }).lean()
    kt('DonThuoc DA GHI xuong DB dung 2 items', dt1?.items?.length === 2, `${dt1?.items?.length}`)

    const phien1thuoc = await luuBuoc({
      queueId, docId, doctorUserId, buoc: 'ke_don',
      payload: { thuoc: [{ ten_thuoc: 'Paracetamol 500mg', so_ngay: 5 }] },
    })
    kt('ke lai 1 thuoc -> con dung 1 (khong cong don)', phien1thuoc.thuoc?.length === 1, `${phien1thuoc.thuoc?.length}`)

    const dt2 = await DonThuoc.countDocuments({ medical_record_id: hoSo1._id })
    kt('van chi co 1 ban ghi DonThuoc (deleteMany truoc khi create)', dt2 === 1, `so ban ghi=${dt2}`)
  }

  // ── 8 ──────────────────────────────────────────────────────────────────────────────────
  muc('8. Quay lai buoc 1 sua trieu chung — con tro KHONG lui')
  {
    const phien = await luuBuoc({
      queueId, docId, doctorUserId, buoc: 'tiep_nhan',
      payload: { trieu_chung_ban_dau: 'Dau hong 3 ngay (da bo sung ho khan)', can_nang: 60, chieu_cao: 165 },
    })
    kt('sua duoc buoc 1 (duoc phep quay lai)', phien.ho_so?.trieu_chung_ban_dau === 'Dau hong 3 ngay (da bo sung ho khan)')
    kt("buoc_hien_tai VAN LA 'hoan_tat', khong lui", phien.buoc_hien_tai === 'hoan_tat', phien.buoc_hien_tai)
  }

  // ── 9 ──────────────────────────────────────────────────────────────────────────────────
  muc('9. Hoan tat phien kham')
  {
    const phongTruoc = await datPhongDangKham(docId, queueId)
    const tbTruoc = phongTruoc.thoi_gian_kham_tb_phut

    const ketQua = await hoanTatPhienKham({ queueId, docId, doctorUserId })
    kt('co_dich_vu_can_thu = true', ketQua.co_dich_vu_can_thu === true, `${ketQua.co_dich_vu_can_thu}`)
    kt('tong_tien_dich_vu > 0 (KHONG phai buoc thu tien — chi so dong bo)', ketQua.tong_tien_dich_vu > 0, `${ketQua.tong_tien_dich_vu}`)
    kt('tra benh_nhan_ke_tiep dung fixture da tao', ketQua.benh_nhan_ke_tiep?.queue_id === String(hangDoiKeTiep._id), JSON.stringify(ketQua.benh_nhan_ke_tiep))

    const hoSoSau = await KetQuaKham.findOne({ hang_doi_id: queueId }).lean()
    kt("KetQuaKham.status = 'da_xac_nhan'", hoSoSau.status === 'da_xac_nhan', hoSoSau.status)

    const hdSau = await HangDoi.findById(queueId).lean()
    kt("HangDoi.trang_thai = 'hoan_thanh'", hdSau.trang_thai === 'hoan_thanh', hdSau.trang_thai)

    const lichHenSau = await LichHen.findById(lichHenGiaLap._id).lean()
    kt("LichHen.status = 'completed'", lichHenSau.status === 'completed', lichHenSau.status)

    // I2 — nha phong khi hoan tat, neu khong benh nhan ke tiep khong vao phong duoc (409).
    const phongSau = await TrangThaiPhongKham.findById(phongTruoc._id).lean()
    kt("TrangThaiPhongKham.trang_thai = 'dang_don_phong'", phongSau.trang_thai === 'dang_don_phong', phongSau.trang_thai)
    kt('benh_nhan_hien_tai_id da duoc xoa', phongSau.benh_nhan_hien_tai_id == null, `${phongSau.benh_nhan_hien_tai_id}`)
    const tbMong = Math.round(0.7 * tbTruoc + 0.3 * 12)
    kt('thoi_gian_kham_tb_phut cap nhat theo trung binh truot', phongSau.thoi_gian_kham_tb_phut === tbMong, `thuc te=${phongSau.thoi_gian_kham_tb_phut} mong doi=${tbMong}`)

    const nhatKyPhong = await NhatKyThaoTac.findOne({
      hanh_dong: 'CHANGE_DOCTOR_STATUS', loai_doi_tuong: 'room_status', doi_tuong_id: docId,
    }).sort({ _id: -1 }).lean()
    kt('co nhat ky CHANGE_DOCTOR_STATUS sau khi hoan tat',
      nhatKyPhong?.du_lieu_moi?.trang_thai === 'dang_don_phong', `${nhatKyPhong?.du_lieu_moi?.trang_thai}`)
    if (nhatKyPhong?._id) daTao.nhatKy.push(nhatKyPhong._id)
  }

  // ── 10 ─────────────────────────────────────────────────────────────────────────────────
  muc('10. Hoan tat lan 2 — luot da xong')
  {
    let loiBat = null
    try {
      await hoanTatPhienKham({ queueId, docId, doctorUserId })
    } catch (err) { loiBat = err }
    kt('nem loi', !!loiBat, loiBat?.message)
    kt('httpStatus la loi nghiep vu (400/409)', [400, 409].includes(loiBat?.httpStatus), `${loiBat?.httpStatus}`)

    // Chan hoan tat lan 2 phai xay ra TRUOC khi cham vao phong. Neu khong, lan goi thu 2 se
    // nha oan phong dang phuc vu benh nhan ke tiep. Dat lai phong ve 'dang_kham' voi mot
    // benh nhan khac roi goi lai — phong phai KHONG doi.
    await datPhongDangKham(docId, hangDoiKeTiep._id)
    try { await hoanTatPhienKham({ queueId, docId, doctorUserId }) } catch { /* van phai loi */ }
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const phongVanGiu = await TrangThaiPhongKham.findOne({ doctor_id: docId, ngay: start }).lean()
    kt("phong VAN 'dang_kham', khong bi nha oan", phongVanGiu.trang_thai === 'dang_kham', phongVanGiu.trang_thai)
    kt('benh_nhan_hien_tai_id van la benh nhan ke tiep',
      String(phongVanGiu.benh_nhan_hien_tai_id) === String(hangDoiKeTiep._id), `${phongVanGiu.benh_nhan_hien_tai_id}`)
  }

  // ── 11 ─────────────────────────────────────────────────────────────────────────────────
  muc('11. Bac si khac goi cung queueId')
  {
    let loiBat = null
    try {
      await layPhienKham({ queueId, docId: bacSiB._id })
    } catch (err) { loiBat = err }
    kt('nem loi', !!loiBat, loiBat?.message)
    kt('httpStatus = 403 hoac 404 (khong so huu luot kham)', [403, 404].includes(loiBat?.httpStatus), `${loiBat?.httpStatus}`)

    let loiBatLuuBuoc = null
    try {
      await luuBuoc({ queueId, docId: bacSiB._id, doctorUserId: userB._id, buoc: 'tiep_nhan', payload: { trieu_chung_ban_dau: 'khong duoc phep' } })
    } catch (err) { loiBatLuuBuoc = err }
    kt('luuBuoc cung bi chan tuong tu', [403, 404].includes(loiBatLuuBuoc?.httpStatus), `${loiBatLuuBuoc?.httpStatus}`)
  }

  // ── 12 ─────────────────────────────────────────────────────────────────────────────────
  // C1 — luot DAT ONLINE (nguon='online') phai chay het 4 buoc. Truoc ban va, ca 3 ham deu
  // loc `nguon:'offline'` nen benh nhan online bam "Vao phong kham" la 404 vinh vien, ma nut
  // "Ket thuc kham" cu da bi go khoi UI -> khong con duong nao hoan tat ca kham.
  muc('12. Luot DAT ONLINE — ca chuoi 4 buoc + nha phong')
  {
    const lichHenOnline = await LichHen.create({
      doctor_id: bacSiA._id,
      schedule_id: new mongoose.Types.ObjectId(),
      slot_id: new mongoose.Types.ObjectId(),
      specialty_id: specialtyId,
      loai_kham: 'clinic',
      ngay_kham: new Date(),
      gio_kham: '10:00',
      status: 'checked_in',
      payment_status: 'paid',
      gia_kham: 200000,
      ten_khach: `${TAG} Online`,
      ma_lich_hen: `${TAG}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    })
    daTao.lichHen.push(lichHenOnline._id)

    const hangDoiOnline = await HangDoi.create({
      nguon: 'online',
      appointment_id: lichHenOnline._id,
      ten_benh_nhan: `${TAG} Online`,
      so_dien_thoai: '0900000789',
      specialty_id: specialtyId,
      doctor_id: bacSiA._id,
      trang_thai: 'trong_phong',
      checkin_time: new Date(),
      thoi_diem_vao_phong: new Date(Date.now() - 8 * 60000),
      muc_uu_tien: 'online_uu_tien',
    })
    daTao.hangDoi.push(hangDoiOnline._id)
    const qOnline = hangDoiOnline._id

    const p0 = await layPhienKham({ queueId: qOnline, docId })
    kt("layPhienKham CHAY DUOC voi nguon='online'", p0.queue.nguon === 'online', p0.queue.nguon)
    kt("buoc_hien_tai = 'tiep_nhan'", p0.buoc_hien_tai === 'tiep_nhan', p0.buoc_hien_tai)

    const p1 = await luuBuoc({ queueId: qOnline, docId, doctorUserId, buoc: 'tiep_nhan',
      payload: { trieu_chung_ban_dau: 'Ngat mui 2 ngay', can_nang: 70, chieu_cao: 170 } })
    kt("buoc 1 luu duoc -> 'chan_doan'", p1.buoc_hien_tai === 'chan_doan', p1.buoc_hien_tai)

    const p2 = await luuBuoc({ queueId: qOnline, docId, doctorUserId, buoc: 'chan_doan',
      payload: { chan_doan: 'Viêm mũi dị ứng' } })
    kt("buoc 2 luu duoc -> 'dich_vu'", p2.buoc_hien_tai === 'dich_vu', p2.buoc_hien_tai)

    const p3 = await luuBuoc({ queueId: qOnline, docId, doctorUserId, buoc: 'dich_vu',
      payload: { dich_vu_phat_sinh: [{ service_id: String(dichVu._id), so_luong: 1 }] } })
    kt("buoc 3 luu duoc -> 'ke_don'", p3.buoc_hien_tai === 'ke_don', p3.buoc_hien_tai)

    const p4 = await luuBuoc({ queueId: qOnline, docId, doctorUserId, buoc: 'ke_don',
      payload: { thuoc: [{ ten_thuoc: 'Loratadin 10mg', so_ngay: 7 }] } })
    kt("buoc 4 luu duoc -> 'hoan_tat'", p4.buoc_hien_tai === 'hoan_tat', p4.buoc_hien_tai)

    // Ho so cua luot online phai mang CA HAI khoa: thieu appointment_id thi benh nhan khong
    // xem duoc ket qua (patient/records tra theo appointment_id) va le tan khong lap duoc hoa
    // don dich vu phat sinh (billing tra { appointment_id, status:'da_xac_nhan' }).
    const hoSoOnline = await KetQuaKham.findOne({ hang_doi_id: qOnline }).lean()
    kt('KetQuaKham gan dung appointment_id',
      String(hoSoOnline.appointment_id) === String(lichHenOnline._id), `${hoSoOnline.appointment_id}`)
    kt('KetQuaKham van gan hang_doi_id', String(hoSoOnline.hang_doi_id) === String(qOnline))
    const shOnline = await SinhHieuKham.findOne({ hang_doi_id: qOnline }).lean()
    kt('SinhHieuKham ghi duoc, mang ca hai khoa',
      !!shOnline && String(shOnline.appointment_id) === String(lichHenOnline._id), shOnline ? 'co' : 'KHONG CO')

    const phongTruocOnline = await datPhongDangKham(docId, qOnline)
    const tbTruocOnline = phongTruocOnline.thoi_gian_kham_tb_phut

    const kqOnline = await hoanTatPhienKham({ queueId: qOnline, docId, doctorUserId })
    kt('hoanTatPhienKham chay duoc cho luot online', !!kqOnline.ho_so_id, kqOnline.ho_so_id)

    const hoSoSauOnline = await KetQuaKham.findById(hoSoOnline._id).lean()
    kt("KetQuaKham.status = 'da_xac_nhan'", hoSoSauOnline.status === 'da_xac_nhan', hoSoSauOnline.status)
    const hdSauOnline = await HangDoi.findById(qOnline).lean()
    kt("HangDoi.trang_thai = 'hoan_thanh'", hdSauOnline.trang_thai === 'hoan_thanh', hdSauOnline.trang_thai)
    const lhSauOnline = await LichHen.findById(lichHenOnline._id).lean()
    kt("LichHen.status = 'completed'", lhSauOnline.status === 'completed', lhSauOnline.status)

    const phongSauOnline = await TrangThaiPhongKham.findById(phongTruocOnline._id).lean()
    kt("phong nha ve 'dang_don_phong'", phongSauOnline.trang_thai === 'dang_don_phong', phongSauOnline.trang_thai)
    kt('benh_nhan_hien_tai_id da xoa', phongSauOnline.benh_nhan_hien_tai_id == null, `${phongSauOnline.benh_nhan_hien_tai_id}`)
    const tbMongOnline = Math.round(0.7 * tbTruocOnline + 0.3 * 8)
    kt('trung binh truot cap nhat', phongSauOnline.thoi_gian_kham_tb_phut === tbMongOnline,
      `thuc te=${phongSauOnline.thoi_gian_kham_tb_phut} mong doi=${tbMongOnline}`)

    // Cac endpoint form phang cu VAN chi nhan offline — khong duoc noi long theo.
    const { getOwnedOfflineQueue } = await import('../services/examSession.service.js')
    let loiOffline = null
    try { await getOwnedOfflineQueue(qOnline, docId) } catch (err) { loiOffline = err }
    kt('getOwnedOfflineQueue VAN chan luot online (404)', loiOffline?.httpStatus === 404, `${loiOffline?.httpStatus}`)
  }

  await donDep()

  console.log(`\n=== ${soDung} dat / ${soSai} khong dat ===`)
  if (loiChiTiet.length) {
    console.log('Chi tiet loi:')
    for (const l of loiChiTiet) console.log(`  - ${l}`)
  }
  await mongoose.disconnect()
  process.exit(soSai > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error(`[${TAG}] Loi:`, err)
  try { await donDep() } catch { /* da mat ket noi */ }
  try { await mongoose.disconnect() } catch { /* da ngat */ }
  process.exit(1)
})
