/**
 * KIEM THU DAU-CUOI: khach da dat lich -> TIEP NHAN tai quay -> bac si kham
 * =========================================================================
 * Bo sung cho `e2e-luong-dat-lich.js` (dat lich + thanh toan). Script nay kiem
 * MAT XICH GIUA HAI DAU: lam sao mot lich hen da thanh toan di vao hang doi cua
 * bac si, va lich khong ai den thi ket thuc the nao.
 *
 * Truoc 2026-07-26 mat xich nay DUT: `PATCH /receptionist/appointments/:id/arrived`
 * chi doi `LichHen.status`, khong tao `HangDoi` — benh nhan khong bao gio hien ra
 * cho bac si, va cuoi ca con bi tinh `no_show` (mat 100% tien theo rule muc 5).
 *
 * Kiem 6 nhom:
 *   1. Truoc tiep nhan: khong o hang doi, CO o danh sach cho tiep nhan
 *   2. Le tan tiep nhan  -> sinh HangDoi + status='checked_in' (rule muc 7, 8)
 *   3. Bac si thay benh nhan trong hang doi
 *   4. Rang buoc: 1 lich hen <-> 1 luot; bac si chi tiep nhan benh nhan cua minh
 *   5. Quet `no_show` het ca (rule muc 8) — ke ca cac truong hop KHONG duoc danh dau
 *   6. Bac si goi -> vao phong -> ket thuc; va check-in khach vang lai
 *
 * ⚠️ CHI chay tren DB TEST. Script tu chan neu ten DB khong chua 'TEST'.
 *
 * DUNG:
 *   MONGODB_URI=<db-test> TEST_API_BASE_URL=http://localhost:5199/api \
 *     node src/scripts/e2e-luong-tiep-nhan.js
 */
import '../config/timezone.js'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  BacSi, HangDoi, LichHen, LichLamViec, NguoiDung, NhatKyThaoTac, ThanhVien, ThongBao,
  TrangThaiPhongKham,
} from '../models/index.js'
import { quetNoShowHetCa } from '../services/noShowSweep.service.js'
import { startOfDayUtc } from '../utils/clinicTime.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const BASE = process.env.TEST_API_BASE_URL || 'http://localhost:5199/api'
const TAG = 'E2E-TN'

let soDung = 0
let soSai = 0
const loiChiTiet = []

function kt(ten, dieuKien, chiTiet = '') {
  if (dieuKien) { soDung += 1; console.log(`  ✓ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`) }
  else { soSai += 1; loiChiTiet.push(`${ten}${chiTiet ? ` — ${chiTiet}` : ''}`); console.log(`  ✗ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`) }
}
function muc(ten) { console.log(`\n${ten}`) }

function taoToken(user) {
  return jwt.sign(
    { id: String(user._id), role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1h' },
  )
}

async function api(method, duongDan, { tok, body } = {}) {
  const res = await fetch(BASE + duongDan, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try { json = await res.json() } catch { /* body rong */ }
  return { status: res.status, body: json }
}

const daTao = { lichHen: [], hangDoi: [] }

async function donDep() {
  if (daTao.lichHen.length) {
    await HangDoi.deleteMany({ appointment_id: { $in: daTao.lichHen } })
    await NhatKyThaoTac.deleteMany({ doi_tuong_id: { $in: daTao.lichHen } })
    await ThongBao.deleteMany({ related_id: { $in: daTao.lichHen } })
    await LichHen.deleteMany({ _id: { $in: daTao.lichHen } })
  }
  if (daTao.hangDoi.length) await HangDoi.deleteMany({ _id: { $in: daTao.hangDoi } })
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  const tenDb = mongoose.connection.db.databaseName
  if (!tenDb.toUpperCase().includes('TEST')) {
    console.error(`[${TAG}] DUNG LAI: "${tenDb}" khong phai DB test. Script nay ghi va xoa du lieu.`)
    process.exit(1)
  }
  console.log(`[${TAG}] DB: ${tenDb} | API: ${BASE}`)

  const homNay = startOfDayUtc(new Date())
  const schedules = await LichLamViec.find({ ngay: homNay }).lean()
  if (schedules.length === 0) {
    console.error(`[${TAG}] Khong co lich lam viec hom nay — chay seed truoc.`)
    process.exit(1)
  }

  // Chon slot CHUA co lich hen nao tro toi (rang buoc unique schedule_id + slot_id).
  // KHONG loc theo `loai_slot`: cuoi gio chieu moi slot online qua cutoff T-30' da tu chuyen
  // thanh walk-in (rule muc 11) — nhung tiep nhan khong quan tam loai slot, chi can dung ngay.
  const slotDaDung = new Set(
    (await LichHen.find({ ngay_kham: homNay, status: { $ne: 'cancelled' } }).select('slot_id').lean())
      .filter((a) => a.slot_id).map((a) => String(a.slot_id)),
  )
  let schedule = null
  let slotRanh = []
  for (const s of schedules) {
    const free = (s.slots || []).filter((x) => !x.benh_nhan_id && !x.bi_khoa_boi_nghi_phep && !slotDaDung.has(String(x._id)))
    if (free.length >= 4) { schedule = s; slotRanh = free; break }
  }
  if (!schedule) {
    console.error(`[${TAG}] Khong tim duoc lich lam viec hom nay con >= 4 slot ranh.`)
    process.exit(1)
  }

  const bacSi = await BacSi.findById(schedule.doctor_id).lean()
  const bacSiUser = await NguoiDung.findById(bacSi.user_id).lean()
  const benhNhan = await NguoiDung.findOne({ role: { $in: ['user', 'patient'] } }).lean()
  const thanhVien = await ThanhVien.findOne({ user_id: benhNhan._id }).lean()
  const tokBacSi = taoToken(bacSiUser)

  console.log(`[${TAG}] Bac si: ${bacSiUser.ho_ten} | benh nhan: ${benhNhan.ho_ten} | ${slotRanh.length} slot ranh`)

  // `pre('validate')` cua LichHen: thieu member_id thi BAT BUOC co ten_khach.
  async function taoLichHen(slotObj, sched = schedule, ghiDe = {}) {
    const a = await LichHen.create({
      user_id: benhNhan._id,
      member_id: thanhVien?._id ?? null,
      ten_khach: thanhVien ? null : benhNhan.ho_ten,
      doctor_id: sched.doctor_id,
      schedule_id: sched._id,
      slot_id: slotObj._id,
      specialty_id: slotObj.specialty_id ?? sched.slots[0].specialty_id,
      loai_kham: 'clinic',
      ngay_kham: homNay,
      gio_kham: slotObj.gio_bat_dau,
      status: 'confirmed',
      payment_status: 'paid',
      gia_kham: 200000,
      nguon: 'online',
      ma_lich_hen: `${TAG}${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      dieu_khoan_version: '2026-07-26.v1',
      dieu_khoan_dong_y_luc: new Date(),
      ...ghiDe,
    })
    daTao.lichHen.push(a._id)
    return a._id
  }

  const apptId = await taoLichHen(slotRanh[0])

  // ── 1 ────────────────────────────────────────────────────────────────────
  muc('1. Truoc khi tiep nhan')
  {
    const q = await api('GET', '/doctor/queue', { tok: tokBacSi })
    kt('lich chua tiep nhan KHONG nam trong hang doi',
      !(q.body?.data ?? []).some((r) => String(r.appointment_id) === String(apptId)))

    const p = await api('GET', '/doctor/queue/pending-checkin', { tok: tokBacSi })
    kt('GET /doctor/queue/pending-checkin tra 200', p.status === 200, `status=${p.status}`)
    const row = (p.body?.data ?? []).find((r) => String(r.appointment_id) === String(apptId))
    kt('lich xuat hien o danh sach cho tiep nhan', !!row, row ? `${row.ten_benh_nhan} ${row.gio_kham}` : '')
    kt('co co moc thoi gian (rule muc 11)', row ? 'da_toi_khung' in row && 'tre_qua_grace' in row : false)
    kt('ten benh nhan khong phai "Khong ro"', row?.ten_benh_nhan !== 'Không rõ', row?.ten_benh_nhan)
  }

  // ── 2 ────────────────────────────────────────────────────────────────────
  muc('2. Le tan tiep nhan (PATCH /receptionist/appointments/:id/arrived)')
  {
    const r = await api('PATCH', `/receptionist/appointments/${apptId}/arrived`)
    kt('tra 200', r.status === 200, r.body?.message)
    kt('tra kem thong tin hang doi', !!r.body?.hang_doi?.id)

    const hd = await HangDoi.findOne({ appointment_id: apptId }).lean()
    kt('DA TAO ban ghi hang_doi', !!hd, hd ? `nguon=${hd.nguon} trang_thai=${hd.trang_thai}` : 'KHONG CO')
    kt('vai_tro_tiep_nhan = receptionist', hd?.vai_tro_tiep_nhan === 'receptionist', hd?.vai_tro_tiep_nhan)
    kt('gio_hen_goc duoc dung', !!hd?.gio_hen_goc)

    const appt = await LichHen.findById(apptId).lean()
    kt("status = 'checked_in' (rule muc 8)", appt.status === 'checked_in', appt.status)
    kt("trang_thai_den = 'da_den'", appt.trang_thai_den === 'da_den', appt.trang_thai_den)
    kt('gio_den_thuc_te duoc ghi', !!appt.gio_den_thuc_te)
  }

  // ── 3 ────────────────────────────────────────────────────────────────────
  muc('3. Bac si nhan duoc du lieu')
  {
    const q = await api('GET', '/doctor/queue', { tok: tokBacSi })
    const row = (q.body?.data ?? []).find((r) => String(r.appointment_id) === String(apptId))
    kt('benh nhan XUAT HIEN trong hang doi bac si', !!row)
    kt("trang thai tong hop = 'dang_cho'", row?.trang_thai_tong_hop === 'dang_cho', row?.trang_thai_tong_hop)
    kt('co bac uu tien dong', !!row?.muc_uu_tien, row?.muc_uu_tien)

    const p = await api('GET', '/doctor/queue/pending-checkin', { tok: tokBacSi })
    kt('da roi khoi danh sach cho tiep nhan',
      !(p.body?.data ?? []).some((r) => String(r.appointment_id) === String(apptId)))
  }

  // ── 4 ────────────────────────────────────────────────────────────────────
  muc('4. Rang buoc tiep nhan (rule muc 7)')
  {
    const r = await api('PATCH', `/receptionist/appointments/${apptId}/arrived`)
    kt('tiep nhan lan 2 bi chan 409', r.status === 409, `${r.status} ${r.body?.message}`)
    kt('van chi co 1 ban ghi hang doi', (await HangDoi.countDocuments({ appointment_id: apptId })) === 1)

    const schedKhac = schedules.find((s) => String(s.doctor_id) !== String(bacSi._id))
    const slotKhac = schedKhac?.slots?.find((x) => !x.benh_nhan_id && !x.bi_khoa_boi_nghi_phep && !slotDaDung.has(String(x._id)))
    if (slotKhac) {
      const id2 = await taoLichHen(slotKhac, schedKhac)
      const rr = await api('POST', '/doctor/queue/checkin', { tok: tokBacSi, body: { appointment_id: String(id2) } })
      kt('bac si A tiep nhan benh nhan cua bac si B -> 403', rr.status === 403, `${rr.status} ${rr.body?.message}`)
    } else {
      console.log('  (bo qua: khong tim duoc bac si thu hai co slot ranh hom nay)')
    }

    // Kham tai nha khong co phong, khong co hang doi.
    const home = await LichHen.create({
      user_id: benhNhan._id,
      member_id: thanhVien?._id ?? null,
      ten_khach: thanhVien ? null : benhNhan.ho_ten,
      doctor_id: bacSi._id, schedule_id: schedule._id, slot_id: slotRanh[3]._id,
      service_id: (await mongoose.connection.db.collection('dich_vu').findOne({}))?._id ?? null,
      loai_kham: 'home', ngay_kham: homNay, gio_kham: '09:00', status: 'confirmed',
      payment_status: 'paid', gia_kham: 300000, dia_chi_kham: 'So 1 Kiem Thu',
      ma_lich_hen: `${TAG}H${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    })
    daTao.lichHen.push(home._id)
    const rh = await api('PATCH', `/receptionist/appointments/${home._id}/arrived`)
    kt('lich kham tai nha bi chan 400', rh.status === 400, `${rh.status} ${rh.body?.message}`)
  }

  // ── 5 ────────────────────────────────────────────────────────────────────
  muc('5. Quet no_show het ca (rule muc 8)')
  {
    // 23:00 gio phong kham hom nay -> ca sang va ca chieu deu da ket thuc.
    const nowMuon = new Date(homNay); nowMuon.setUTCHours(16, 0, 0, 0)

    const idKhongDen = await taoLichHen(slotRanh[1])
    await quetNoShowHetCa({ now: nowMuon, apply: true })

    const khongDen = await LichHen.findById(idKhongDen).lean()
    kt('lich khong toi quay -> no_show', khongDen.status === 'no_show', khongDen.status)
    kt('ghi no_show_confirmed_at', !!khongDen.no_show_confirmed_at)
    kt('co nhat ky AUTO_MARK_NO_SHOW',
      !!(await NhatKyThaoTac.findOne({ hanh_dong: 'AUTO_MARK_NO_SHOW', doi_tuong_id: idKhongDen }).lean()))
    kt('co thong bao cho khach', !!(await ThongBao.findOne({ related_id: idKhongDen }).lean()))

    // Rule muc 8: da buoc chan toi quay thi KHONG BAO GIO no_show.
    kt('nguoi DA toi quay KHONG bi no_show',
      (await LichHen.findById(apptId).lean()).status !== 'no_show')

    // Chua het ca thi khong danh dau.
    const idChuaHet = await taoLichHen(slotRanh[2])
    const sangSom = new Date(homNay); sangSom.setUTCHours(1, 0, 0, 0) // 08:00 gio phong kham
    const kq = await quetNoShowHetCa({ now: sangSom, apply: true })
    kt('chua het ca -> KHONG danh dau',
      (await LichHen.findById(idChuaHet).lean()).status !== 'no_show',
      `bo qua=${JSON.stringify(kq.boQua)}`)

    // Ca bi nghi -> KHONG BAO GIO no_show.
    await LichLamViec.updateOne({ _id: schedule._id, 'slots._id': slotRanh[2]._id },
      { $set: { 'slots.$.bi_khoa_boi_nghi_phep': true } })
    await quetNoShowHetCa({ now: nowMuon, apply: true })
    kt('slot bi khoa boi nghi phep -> KHONG no_show',
      (await LichHen.findById(idChuaHet).lean()).status !== 'no_show')
    await LichLamViec.updateOne({ _id: schedule._id, 'slots._id': slotRanh[2]._id },
      { $set: { 'slots.$.bi_khoa_boi_nghi_phep': false } })
  }

  // ── 6 ────────────────────────────────────────────────────────────────────
  muc('6. Bac si goi -> vao phong -> ket thuc')
  {
    const hd = await HangDoi.findOne({ appointment_id: apptId }).lean()
    kt('goi benh nhan',
      (await api('PATCH', `/doctor/queue/${hd._id}/call`, { tok: tokBacSi })).status === 200)

    await TrangThaiPhongKham.updateOne({ doctor_id: bacSi._id },
      { $set: { trang_thai: 'san_sang', benh_nhan_hien_tai_id: null } })
    const rVao = await api('PATCH', `/doctor/queue/${hd._id}/into-room`, { tok: tokBacSi })
    kt('vao phong', rVao.status === 200, `${rVao.status} ${rVao.body?.message}`)
    kt("lich hen -> 'in_progress'", (await LichHen.findById(apptId).lean()).status === 'in_progress')

    const rXong = await api('PATCH', `/doctor/queue/${hd._id}/finish`, { tok: tokBacSi })
    kt('ket thuc kham', rXong.status === 200, `${rXong.status} ${rXong.body?.message}`)
    kt("lich hen -> 'waiting_record'", (await LichHen.findById(apptId).lean()).status === 'waiting_record')
  }

  muc('7. Check-in khach vang lai (khong hoi quy)')
  {
    const r = await api('POST', '/doctor/queue/checkin', {
      tok: tokBacSi,
      body: { ten_benh_nhan: `${TAG} Khach Vang Lai`, so_dien_thoai: '0900000111' },
    })
    kt('tao luot vang lai', r.status === 201, `${r.status} ${r.body?.message}`)
    if (r.body?.data?.entry?._id) daTao.hangDoi.push(r.body.data.entry._id)
    kt('nguon = offline', r.body?.data?.entry?.nguon === 'offline')
    kt('tra ve mang canh bao', Array.isArray(r.body?.data?.canh_bao))
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
