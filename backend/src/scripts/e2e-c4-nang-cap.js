/**
 * KIEM THU DAU-CUOI: C4 (Benh nhan da kham + dinh chinh ho so)
 * =========================================================================================
 * Tinh nang moi 2026-08-14 CHUA co e2e nao phu:
 *   - C4: GET /doctor/exam-history, GET /doctor/exam-session/:id (field hoa_don moi),
 *     PATCH /doctor/exam-session/:id/amendment
 *
 * (C6 "Bien ban ca khan cuoi ngay" da bi GO BO cung ngay theo yeu cau nguoi dung — phong kham
 * nho khong xu ly cap cuu thuc su, ca kho hiem se duoc chuyen thang len benh vien lon. Muc uu
 * tien 'cap_cuu' trong hang doi van giu de xep kham truoc, nhung khong con bat buoc ly do va
 * khong con man bao cao rieng — xem centralOfflineQueue.service.js + PatientIntake.tsx.)
 *
 * Tao ho so kham TRUC TIEP qua examSession.service.js (giong e2e-phien-kham-4-buoc.js — khong
 * phu thuoc gio phong kham), roi goi qua HTTP that (can server dang chay o TEST_API_BASE_URL)
 * de kiem dung endpoint + auth + serialize response.
 *
 * ⚠️ CHI chay tren DB TEST. Script tu chan neu ten DB khong chua 'TEST'.
 *
 * DUNG:
 *   MONGODB_URI=<db-test> TEST_API_BASE_URL=http://localhost:5199/api \
 *     node src/scripts/e2e-c4-c6-nang-cap.js
 */
import '../config/timezone.js'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  BacSi, DichVu, HangDoi, KetQuaKham, LichHen, NguoiDung, NhatKyThaoTac, SinhHieuKham,
  TrangThaiPhongKham, DonThuoc,
} from '../models/index.js'
import { hoanTatPhienKham, layPhienKham, luuBuoc } from '../services/examSession.service.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const TAG = 'E2E-C4C6'
const BASE_URL = process.env.TEST_API_BASE_URL || 'http://localhost:5199/api'

let soDung = 0
let soSai = 0
const loiChiTiet = []
function kt(ten, dieuKien, chiTiet = '') {
  if (dieuKien) { soDung += 1; console.log(`  ✓ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`) }
  else { soSai += 1; loiChiTiet.push(`${ten}${chiTiet ? ` — ${chiTiet}` : ''}`); console.log(`  ✗ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`) }
}
function muc(ten) { console.log(`\n${ten}`) }

async function api(pathName, { method = 'GET', body, auth } = {}) {
  const res = await fetch(`${BASE_URL}${pathName}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  return { status: res.status, body: json }
}

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
  console.log(`[${TAG}] DB: ${tenDb} | API: ${BASE_URL}`)

  const dichVu = await DichVu.findOne({ loai: 'related', status: 'active', specialty_id: { $ne: null } }).lean()
  if (!dichVu) { console.error(`[${TAG}] Khong tim duoc dich vu related — chay seed truoc.`); process.exit(1) }
  const specialtyId = dichVu.specialty_id

  const bacSiA = await BacSi.findOne({ specialties: specialtyId, trang_thai: 'active', trang_thai_duyet: 'approved' }).lean()
  const bacSiB = await BacSi.findOne({ _id: { $ne: bacSiA?._id }, trang_thai: 'active', trang_thai_duyet: 'approved' }).lean()
  if (!bacSiA || !bacSiB) { console.error(`[${TAG}] Can 2 bac si active tren DB test.`); process.exit(1) }
  const userA = await NguoiDung.findById(bacSiA.user_id).lean()
  const userB = await NguoiDung.findById(bacSiB.user_id).lean()
  console.log(`[${TAG}] Bac si A: ${userA.ho_ten} (${userA.email}) | Bac si B: ${userB.ho_ten} (${userB.email})`)

  // ── Fixture: 1 luot vang lai hoan tat day du qua service (khong qua HTTP, khong phu thuoc
  // gio phong kham) — giong ky thuat e2e-phien-kham-4-buoc.js.
  const tenBenhNhan = `${TAG} Nguyen Van Test`
  const hangDoi = await HangDoi.create({
    nguon: 'offline',
    ten_benh_nhan: tenBenhNhan,
    so_dien_thoai: '0900009999',
    specialty_id: specialtyId,
    doctor_id: bacSiA._id,
    trang_thai: 'trong_phong',
    checkin_time: new Date(),
    thoi_diem_vao_phong: new Date(Date.now() - 10 * 60000),
    muc_uu_tien: 'offline',
  })
  daTao.hangDoi.push(hangDoi._id)
  const queueId = hangDoi._id
  const docId = bacSiA._id
  const doctorUserId = userA._id

  await luuBuoc({ queueId, docId, doctorUserId, buoc: 'tiep_nhan', payload: { trieu_chung_ban_dau: 'Ho, sot nhe 2 ngay', can_nang: 55, chieu_cao: 160 } })
  await luuBuoc({ queueId, docId, doctorUserId, buoc: 'chan_doan', payload: { chan_doan: 'Viem hong cap (E2E)', huong_dan_dieu_tri: 'Uong nhieu nuoc, nghi ngoi' } })
  await luuBuoc({ queueId, docId, doctorUserId, buoc: 'dich_vu', payload: { dich_vu_phat_sinh: [{ service_id: String(dichVu._id), so_luong: 1 }] } })
  await luuBuoc({ queueId, docId, doctorUserId, buoc: 'ke_don', payload: { thuoc: [{ ten_thuoc: 'Paracetamol', so_ngay: 3 }] } })
  await hoanTatPhienKham({ queueId, docId, doctorUserId })

  // ── C4.1 — GET /doctor/exam-history ─────────────────────────────────────────────────────
  muc('C4.1 — GET /doctor/exam-history')
  const loginA = await api('/auth/login', { method: 'POST', body: { email: userA.email, mat_khau: '123456' } })
  kt('Bac si A dang nhap duoc', loginA.status === 200, `status=${loginA.status}`)
  const tokA = loginA.body?.data?.token

  const loginB = await api('/auth/login', { method: 'POST', body: { email: userB.email, mat_khau: '123456' } })
  const tokB = loginB.body?.data?.token

  const todayISO = new Date().toISOString().slice(0, 10)
  const history = await api(`/doctor/exam-history?date=${todayISO}`, { auth: tokA })
  kt('HTTP 200', history.status === 200, `status=${history.status}`)
  const row = (history.body?.data ?? []).find((r) => r.queue_id === String(queueId))
  kt('Ca vua hoan tat XUAT HIEN trong danh sach hom nay', !!row)
  kt('chan_doan dung', row?.chan_doan === 'Viem hong cap (E2E)', row?.chan_doan)
  kt('so_dich_vu_phat_sinh = 1', row?.so_dich_vu_phat_sinh === 1, `${row?.so_dich_vu_phat_sinh}`)
  kt('ket_cuc mac dinh = dieu_tri_thuong', row?.ket_cuc === 'dieu_tri_thuong', row?.ket_cuc)

  const bySearch = await api(`/doctor/exam-history?q=${encodeURIComponent('Nguyen Van Test')}`, { auth: tokA })
  kt('Tim theo ten (khong truyen ngay) tra ve 200', bySearch.status === 200, `status=${bySearch.status}`)
  kt('Tim theo ten tim thay dung ca', (bySearch.body?.data ?? []).some((r) => r.queue_id === String(queueId)))

  const byPhone = await api(`/doctor/exam-history?q=0900009999`, { auth: tokA })
  kt('Tim theo SDT tim thay dung ca', (byPhone.body?.data ?? []).some((r) => r.queue_id === String(queueId)))

  const historyB = await api(`/doctor/exam-history?date=${todayISO}`, { auth: tokB })
  kt('Bac si KHAC KHONG thay ca nay trong danh sach cua ho', !(historyB.body?.data ?? []).some((r) => r.queue_id === String(queueId)))

  // ── C4.2 — GET chi tiet co field hoa_don + lich_su_sua ──────────────────────────────────
  muc('C4.2 — GET /doctor/exam-session/:id (field moi)')
  const detail = await api(`/doctor/exam-session/${queueId}`, { auth: tokA })
  kt('HTTP 200', detail.status === 200, `status=${detail.status}`)
  kt("field 'hoa_don' co mat (null vi chua lap hoa don)", detail.body?.data && 'hoa_don' in detail.body.data, JSON.stringify(detail.body?.data?.hoa_don))
  kt("field 'lich_su_sua' co mat, la mang", Array.isArray(detail.body?.data?.ho_so?.lich_su_sua))
  const soLichSuTruoc = detail.body?.data?.ho_so?.lich_su_sua?.length ?? 0

  // ── C4.3 — PATCH amendment ──────────────────────────────────────────────────────────────
  muc('C4.3 — PATCH .../amendment')
  const thieuLyDo = await api(`/doctor/exam-session/${queueId}/amendment`, {
    method: 'PATCH', auth: tokA, body: { thay_doi: { chan_doan: 'Viem hong cap - da sua' } },
  })
  kt('Thieu ly_do -> 400', thieuLyDo.status === 400, `status=${thieuLyDo.status}`)

  const bacSiKhacSua = await api(`/doctor/exam-session/${queueId}/amendment`, {
    method: 'PATCH', auth: tokB, body: { thay_doi: { chan_doan: 'Hack' }, ly_do: 'thu quyen' },
  })
  kt('Bac si KHAC dinh chinh -> 404 (khong so huu)', bacSiKhacSua.status === 404, `status=${bacSiKhacSua.status}`)

  const dinhChinh = await api(`/doctor/exam-session/${queueId}/amendment`, {
    method: 'PATCH', auth: tokA,
    body: { thay_doi: { chan_doan: 'Viem hong cap (E2E) - da dinh chinh', ket_cuc: 'chuyen_chuyen_khoa' }, ly_do: 'Nhap nhamr — kiem thu dinh chinh' },
  })
  kt('Dinh chinh hop le -> 200', dinhChinh.status === 200, `status=${dinhChinh.status}`)
  kt('chan_doan da doi', dinhChinh.body?.data?.ho_so?.chan_doan === 'Viem hong cap (E2E) - da dinh chinh', dinhChinh.body?.data?.ho_so?.chan_doan)
  kt('ket_cuc da doi', dinhChinh.body?.data?.ho_so?.ket_cuc === 'chuyen_chuyen_khoa', dinhChinh.body?.data?.ho_so?.ket_cuc)
  const soLichSuSau = dinhChinh.body?.data?.ho_so?.lich_su_sua?.length ?? 0
  kt('lich_su_sua CONG THEM 1 dong (khong sua de)', soLichSuSau === soLichSuTruoc + 1, `truoc=${soLichSuTruoc} sau=${soLichSuSau}`)
  const dongMoiNhat = dinhChinh.body?.data?.ho_so?.lich_su_sua?.[soLichSuSau - 1]
  kt('dong moi la_dinh_chinh = true', dongMoiNhat?.la_dinh_chinh === true, JSON.stringify(dongMoiNhat))

  // Doi lai HangDoi.trang_thai != 'hoan_thanh' -> amendment phai bi chan (chi sua khi da_xac_nhan)
  const truocKhiHoanThanh = await HangDoi.findById(queueId).select('trang_thai').lean()
  kt('HangDoi.trang_thai VAN la hoan_thanh sau dinh chinh (khong bi mo khoa nham)', truocKhiHoanThanh?.trang_thai === 'hoan_thanh', truocKhiHoanThanh?.trang_thai)

  console.log(`\n=== ${soDung} dat / ${soSai} khong dat ===`)
  if (loiChiTiet.length) {
    console.log('Chi tiet loi:')
    loiChiTiet.forEach((l) => console.log(`  - ${l}`))
  }

  await donDep()
  await mongoose.disconnect()
  process.exit(soSai > 0 ? 1 : 0)
}

main().catch(async (err) => {
  console.error(`[${TAG}] Loi khong bat duoc:`, err)
  try { await donDep() } catch {}
  try { await mongoose.disconnect() } catch {}
  process.exit(1)
})
