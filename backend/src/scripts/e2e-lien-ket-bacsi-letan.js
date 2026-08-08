/**
 * KIEM THU DAU-CUOI: lien ket du lieu Bac si <-> Le tan sau WS-1
 * =========================================================================================
 * Cau hoi can tra loi bang du lieu that (khong doc code suy doan):
 *   (A) Bac si hoan tat ca kham co dich vu phat sinh (buoc 3 cua luong 4 buoc) -> Le tan
 *       co THAY duoc dung dich vu, dung gia, dung tong tien tren man Thu ngan khong?
 *       (chua co e2e nao goi toi receptionist/billing.controller.js voi du lieu do
 *       examSession.service.js sinh ra — day la mat xich CHUA TUNG duoc kiem that)
 *   (B) Le tan lap hoa don + thu tien mat -> trang thai hoa don cap nhat dung, va
 *       danh sach "cho thanh toan" / "da thanh toan" o billing co chuyen dung tab khong?
 *   (C) Chieu nguoc lai (Le tan check-in vang lai -> Bac si thay trong hang doi) da co
 *       e2e-luong-tiep-nhan.js rieng (WS-4) — script nay CHI doi chieu 1 lan nua qua
 *       checkIn.service.js that de xac nhan khong bi WS-1 lam gay, khong lam lai tu dau.
 *
 * Goi truc tiep ham controller cua billing.controller.js voi req/res gia lap (khong can
 * server Express dang chay) — cung ky thuat e2e-phien-kham-4-buoc.js da dung cho service.
 *
 * ⚠️ CHI chay tren DB TEST. Script tu chan neu ten DB khong chua chu "TEST".
 *
 * DUNG:
 *   MONGODB_URI=<db-test> node src/scripts/e2e-lien-ket-bacsi-letan.js
 */
import '../config/timezone.js'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  BacSi, DichVu, HangDoi, KetQuaKham, LichHen, NguoiDung, NhatKyThaoTac, SinhHieuKham,
  ThanhToan, HoaDon, TrangThaiPhongKham,
} from '../models/index.js'
import { hoanTatPhienKham, layPhienKham, luuBuoc } from '../services/examSession.service.js'
import * as billing from '../controllers/receptionist/billing.controller.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const TAG = 'E2E-BSLT'

let soDung = 0
let soSai = 0
const loiChiTiet = []
function kt(ten, dieuKien, chiTiet = '') {
  if (dieuKien) { soDung += 1; console.log(`  ✓ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`) }
  else { soSai += 1; loiChiTiet.push(`${ten}${chiTiet ? ` — ${chiTiet}` : ''}`); console.log(`  ✗ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`) }
}
function muc(ten) { console.log(`\n${ten}`) }

/** req/res gia lap cho controller Express — khong can server that. */
function mockReqRes({ params = {}, query = {}, body = {}, user = {} } = {}) {
  const res = { statusCode: 200, body: null }
  res.status = function status(code) { res.statusCode = code; return res }
  res.json = function json(payload) { res.body = payload; return res }
  const req = { params, query, body, user }
  return { req, res }
}

const daTao = { hangDoi: [], lichHen: [], nhatKy: [], hoaDon: [], thanhToan: [], phongTuTao: null, phongGoc: null }

async function donDep() {
  if (daTao.hangDoi.length) {
    await SinhHieuKham.deleteMany({ hang_doi_id: { $in: daTao.hangDoi } })
    const hoSos = await KetQuaKham.find({ hang_doi_id: { $in: daTao.hangDoi } }).select('_id').lean()
    const hoSoIds = hoSos.map((h) => h._id)
    if (hoSoIds.length) await NhatKyThaoTac.deleteMany({ loai_doi_tuong: 'examination_result', doi_tuong_id: { $in: hoSoIds } })
    await KetQuaKham.deleteMany({ hang_doi_id: { $in: daTao.hangDoi } })
    await HangDoi.deleteMany({ _id: { $in: daTao.hangDoi } })
  }
  if (daTao.thanhToan.length) await ThanhToan.deleteMany({ _id: { $in: daTao.thanhToan } })
  if (daTao.hoaDon.length) {
    await NhatKyThaoTac.deleteMany({ loai_doi_tuong: 'invoice', doi_tuong_id: { $in: daTao.hoaDon } })
    await HoaDon.deleteMany({ _id: { $in: daTao.hoaDon } })
  }
  if (daTao.nhatKy.length) await NhatKyThaoTac.deleteMany({ _id: { $in: daTao.nhatKy } })
  if (daTao.lichHen.length) await LichHen.deleteMany({ _id: { $in: daTao.lichHen } })
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
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('Thieu MONGODB_URI')
  if (!/test/i.test(uri)) throw new Error('CHI chay tren DB TEST — ten DB phai chua "TEST"')
  await mongoose.connect(uri)
  const tenDb = mongoose.connection.db.databaseName
  if (!tenDb.toUpperCase().includes('TEST')) {
    console.error(`[${TAG}] DUNG LAI: "${tenDb}" khong phai DB test.`)
    process.exit(1)
  }
  console.log(`[${TAG}] DB: ${tenDb}`)

  const dichVu = await DichVu.findOne({ loai: 'related', status: 'active', specialty_id: { $ne: null } }).lean()
  if (!dichVu) { console.error(`[${TAG}] Khong tim duoc dich vu related — chay seed truoc.`); process.exit(1) }
  const specialtyId = dichVu.specialty_id
  const bacSiA = await BacSi.findOne({ specialties: specialtyId, trang_thai: 'active', trang_thai_duyet: 'approved' }).lean()
  if (!bacSiA) { console.error(`[${TAG}] Khong tim duoc bac si active khop chuyen khoa.`); process.exit(1) }
  const userA = await NguoiDung.findById(bacSiA.user_id).lean()
  const receptionistUser = { id: new mongoose.Types.ObjectId(), role: 'receptionist' }
  console.log(`[${TAG}] Bac si: ${userA.ho_ten} | Dich vu: ${dichVu.ten} (${dichVu.gia}đ)`)

  let refOffline, refOnline

  // ── A1: ca OFFLINE (khach vang lai) — bac si hoan tat kem dich vu ───────────────────────
  muc('A1. Bac si hoan tat ca vang lai kem dich vu phat sinh')
  {
    const hangDoi = await HangDoi.create({
      nguon: 'offline', ten_benh_nhan: `${TAG} Vang Lai`, so_dien_thoai: '0900001111',
      specialty_id: specialtyId, doctor_id: bacSiA._id, trang_thai: 'trong_phong',
      checkin_time: new Date(), thoi_diem_vao_phong: new Date(), muc_uu_tien: 'offline',
    })
    daTao.hangDoi.push(hangDoi._id)
    refOffline = hangDoi._id
    const queueId = hangDoi._id, docId = bacSiA._id, doctorUserId = userA._id

    await luuBuoc({ queueId, docId, doctorUserId, buoc: 'tiep_nhan', payload: { trieu_chung_ban_dau: 'Ho, dau hong', can_nang: 55, chieu_cao: 160 } })
    await luuBuoc({ queueId, docId, doctorUserId, buoc: 'chan_doan', payload: { chan_doan: 'Viem hong cap' } })
    await luuBuoc({ queueId, docId, doctorUserId, buoc: 'dich_vu', payload: { dich_vu_phat_sinh: [{ service_id: String(dichVu._id), so_luong: 2 }] } })
    await luuBuoc({ queueId, docId, doctorUserId, buoc: 'ke_don', payload: { thuoc: [] } })
    await datPhongDangKham(docId, queueId)
    const ketQua = await hoanTatPhienKham({ queueId, docId, doctorUserId })
    kt('bac si hoan tat khong loi, tra co_dich_vu_can_thu=true', ketQua.co_dich_vu_can_thu === true)
    kt('tong_tien_dich_vu = 2 x gia dich vu', ketQua.tong_tien_dich_vu === dichVu.gia * 2, `${ketQua.tong_tien_dich_vu} vs ${dichVu.gia * 2}`)
  }

  // ── A2: Le tan mo man Thu ngan cho dung ca vua roi — DU LIEU CO SANG DUNG KHONG ─────────
  muc('A2. Le tan xem chi tiet ca vang lai vua bac si hoan tat (billing.controller.js that)')
  {
    const { req, res } = mockReqRes({ params: { referenceId: String(refOffline) }, query: { source: 'offline' }, user: receptionistUser })
    await billing.getBillingCase(req, res)
    kt('HTTP 200 (khong bi 404/409)', res.statusCode === 200, `status=${res.statusCode} body=${JSON.stringify(res.body)}`)
    const data = res.body?.data
    kt('dich_vu_chi_dinh co dung 1 dong (2 don vi cung 1 dich vu)', data?.dich_vu_chi_dinh?.length === 1, `${data?.dich_vu_chi_dinh?.length}`)
    kt('so_luong dich vu = 2', data?.dich_vu_chi_dinh?.[0]?.so_luong === 2, `${data?.dich_vu_chi_dinh?.[0]?.so_luong}`)
    kt('gia dich vu khop DichVu.gia (server tinh lai, khong tin client)', data?.dich_vu_chi_dinh?.[0]?.don_gia === dichVu.gia, `${data?.dich_vu_chi_dinh?.[0]?.don_gia} vs ${dichVu.gia}`)
    kt('billing_summary.tong_tien_phat_sinh = 2 x gia', data?.billing_summary?.tong_tien_phat_sinh === dichVu.gia * 2, `${data?.billing_summary?.tong_tien_phat_sinh}`)
    kt('billing_summary.trang_thai_hoa_don = chua_thanh_toan (chua lap hoa don)', data?.billing_summary?.trang_thai_hoa_don === 'chua_thanh_toan', data?.billing_summary?.trang_thai_hoa_don)
    kt('ten_benh_nhan dung', data?.ten_benh_nhan === `${TAG} Vang Lai`, data?.ten_benh_nhan)
  }

  // ── A3: ca nay co xuat hien trong danh sach "cho thanh toan" cua le tan khong ────────────
  muc('A3. Danh sach listBillingCases (view=pending) co chua ca vua hoan tat khong')
  {
    const { req, res } = mockReqRes({ query: { view: 'pending', scope: 'today' }, user: receptionistUser })
    await billing.listBillingCases(req, res)
    kt('HTTP 200', res.statusCode === 200, `status=${res.statusCode}`)
    const rows = res.body?.data ?? []
    const found = rows.find((r) => r.id === String(refOffline))
    kt('CA VUA BAC SI HOAN TAT XUAT HIEN o tab "cho thanh toan"', !!found, found ? 'co' : `KHONG THAY trong ${rows.length} dong`)
  }

  // ── A4: Le tan lap hoa don + thu tien mat — cap nhat dung khong ─────────────────────────
  muc('A4. Le tan lap hoa don, thu tien mat')
  {
    const { req, res } = mockReqRes({
      params: { referenceId: String(refOffline) }, query: { source: 'offline' },
      body: { phuong_thuc: 'tien_mat' }, user: receptionistUser,
    })
    await billing.createBillingInvoice(req, res)
    kt('HTTP 201', res.statusCode === 201, `status=${res.statusCode} body=${JSON.stringify(res.body)}`)
    const data = res.body?.data
    kt('trang_thai_hoa_don = da_thanh_toan_du sau khi thu tien mat', data?.billing_summary?.trang_thai_hoa_don === 'da_thanh_toan_du', data?.billing_summary?.trang_thai_hoa_don)
    kt('da_xac_nhan_thu_ngan = true', data?.da_xac_nhan_thu_ngan === true)
    kt('tong_da_thu = tong_thanh_toan (thu du)', data?.billing_summary?.tong_da_thu === data?.billing_summary?.tong_thanh_toan)
    if (data?.invoice?.id) daTao.hoaDon.push(new mongoose.Types.ObjectId(data.invoice.id))
    const paymentDoc = await ThanhToan.findOne({ hoa_don_id: data?.invoice?.id }).lean()
    if (paymentDoc) daTao.thanhToan.push(paymentDoc._id)
  }

  // ── A5: sau khi thu tien, ca nay phai CHUYEN sang tab "da thanh toan" ───────────────────
  muc('A5. Sau khi thu tien, ca chuyen tu tab "cho thanh toan" sang "da thanh toan"')
  {
    const pend = mockReqRes({ query: { view: 'pending', scope: 'today' }, user: receptionistUser })
    await billing.listBillingCases(pend.req, pend.res)
    const stillPending = (pend.res.body?.data ?? []).some((r) => r.id === String(refOffline))
    kt('KHONG con trong tab "cho thanh toan"', !stillPending)

    const paid = mockReqRes({ query: { view: 'paid', scope: 'all' }, user: receptionistUser })
    await billing.listBillingCases(paid.req, paid.res)
    const nowPaid = (paid.res.body?.data ?? []).some((r) => r.id === String(refOffline))
    kt('DA xuat hien trong tab "da thanh toan"', nowPaid)
  }

  // ── B1: ca ONLINE — kiem tra LichHen.status sau hoan tat co con duoc billing nhan dien ──
  muc('B1. Ca DAT ONLINE — bac si hoan tat kem dich vu, Le tan co thay duoc khong')
  {
    const lichHen = await LichHen.create({
      doctor_id: bacSiA._id, schedule_id: new mongoose.Types.ObjectId(), slot_id: new mongoose.Types.ObjectId(),
      specialty_id: specialtyId, loai_kham: 'clinic', ngay_kham: new Date(), gio_kham: '10:00',
      status: 'checked_in', gia_kham: 200000, ten_khach: `${TAG} Dat Online`,
      ma_lich_hen: `${TAG}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    })
    daTao.lichHen.push(lichHen._id)
    refOnline = lichHen._id
    const hangDoi = await HangDoi.create({
      nguon: 'online', appointment_id: lichHen._id, ten_benh_nhan: `${TAG} Dat Online`,
      so_dien_thoai: '0900002222', specialty_id: specialtyId, doctor_id: bacSiA._id,
      trang_thai: 'trong_phong', checkin_time: new Date(), thoi_diem_vao_phong: new Date(), muc_uu_tien: 'online_uu_tien',
    })
    daTao.hangDoi.push(hangDoi._id)
    const queueId = hangDoi._id, docId = bacSiA._id, doctorUserId = userA._id
    await luuBuoc({ queueId, docId, doctorUserId, buoc: 'tiep_nhan', payload: { trieu_chung_ban_dau: 'Kham dinh ky' } })
    await luuBuoc({ queueId, docId, doctorUserId, buoc: 'chan_doan', payload: { chan_doan: 'Binh thuong' } })
    await luuBuoc({ queueId, docId, doctorUserId, buoc: 'dich_vu', payload: { dich_vu_phat_sinh: [{ service_id: String(dichVu._id), so_luong: 1 }] } })
    await luuBuoc({ queueId, docId, doctorUserId, buoc: 'ke_don', payload: { thuoc: [] } })
    await datPhongDangKham(docId, queueId)
    await hoanTatPhienKham({ queueId, docId, doctorUserId })

    const lichHenSau = await LichHen.findById(refOnline).lean()
    kt("LichHen.status sau hoan tat = 'completed' (KHONG con 'waiting_record')", lichHenSau.status === 'completed', lichHenSau.status)

    const { req, res } = mockReqRes({ params: { referenceId: String(refOnline) }, query: { source: 'online' }, user: receptionistUser })
    await billing.getBillingCase(req, res)
    kt('Le tan van GET duoc ca online nay qua billing (status=completed van nam trong ONLINE_ELIGIBLE)', res.statusCode === 200, `status=${res.statusCode}`)
    kt('dich_vu_chi_dinh co du lieu', res.body?.data?.dich_vu_chi_dinh?.length === 1)

    const pend = mockReqRes({ query: { view: 'pending', scope: 'today' }, user: receptionistUser })
    await billing.listBillingCases(pend.req, pend.res)
    const foundInPendingList = (pend.res.body?.data ?? []).some((r) => r.id === String(refOnline))
    kt('Ca online nay CO trong danh sach tong "cho thanh toan" cua le tan', foundInPendingList, foundInPendingList ? 'co' : 'KHONG THAY — xem ghi chu B1 trong bao cao')
  }

  // Chieu nguoc lai (le tan check-in -> bac si thay trong hang doi) da co e2e rieng tu WS-4
  // (`e2e-luong-tiep-nhan.js`, that qua HTTP that, khong mock) — chay live trong cung phien
  // kiem thu nay (ket qua doi chieu trong bao cao), khong lam lai bang mock trong script nay.

  console.log(`\n=== ${soDung} dat / ${soSai} khong dat ===`)
  if (loiChiTiet.length) { console.log('\nChi tiet loi:'); loiChiTiet.forEach((l) => console.log(`  - ${l}`)) }
}

main()
  .catch((err) => { console.error(`[${TAG}] LOI:`, err); soSai += 1 })
  .finally(async () => {
    await donDep()
    await mongoose.disconnect()
    process.exit(soSai > 0 ? 1 : 0)
  })
