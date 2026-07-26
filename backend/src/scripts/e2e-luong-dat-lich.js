/**
 * KIEM THU DAU-CUOI: khach dat lich -> thanh toan -> bac si nhan va thao tac
 * =========================================================================
 * Chay nhu MOT KHACH THAT: goi API that qua HTTP, khong goi ham noi bo.
 * Muc tieu: tra loi duoc "bac si da nhan DU du lieu chua" va "cac thao tac
 * voi lich hen (huy / doi / check-in / kham) co dung nghiep vu khong".
 *
 * ⚠️ CHI chay tren DB TEST. Script tu chan neu ten DB khong chua 'TEST'.
 *
 * DUNG:
 *   MONGODB_URI=<db-test> TEST_API_BASE_URL=http://localhost:5199/api \
 *     node src/scripts/e2e-luong-dat-lich.js
 */
import '../config/timezone.js'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  BacSi, ChuyenKhoa, HangDoi, HoaDon, KetQuaKham, LichHen, LichLamViec,
  NguoiDung, ThanhToan,
} from '../models/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const BASE = process.env.TEST_API_BASE_URL || 'http://localhost:5199/api'
const TAG = 'E2E'

let soDung = 0
let soSai = 0
const loiChiTiet = []

function kt(ten, dieuKien, chiTiet = '') {
  if (dieuKien) {
    soDung += 1
    console.log(`  ✓ ${ten}`)
  } else {
    soSai += 1
    loiChiTiet.push(`${ten}${chiTiet ? ` — ${chiTiet}` : ''}`)
    console.log(`  ✗ ${ten}${chiTiet ? ` — ${chiTiet}` : ''}`)
  }
}

function muc(ten) {
  console.log(`\n${'─'.repeat(70)}\n${ten}\n${'─'.repeat(70)}`)
}

// Tai khoan seed dung nhieu mat khau khac nhau (seed-all: '123456',
// seed-doctor-test-data: 'Test123456') — thu lan luot thay vi doan.
const MAT_KHAU_THU = ['Test123456', '123456']

async function dangNhap(email) {
  for (const mk of MAT_KHAU_THU) {
    const r = await api('/auth/login', { method: 'POST', body: { email, mat_khau: mk } })
    if (r.status === 200) return r.body?.data?.token ?? null
  }
  return null
}

async function api(duongDan, { method = 'GET', body, auth } = {}) {
  const res = await fetch(BASE + duongDan, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

function ngayLamViecToi(soNgay = 3) {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + soNgay)
  return d
}
const ymd = (d) => d.toISOString().slice(0, 10)

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  const dbName = mongoose.connection.db.databaseName
  if (!dbName.toUpperCase().includes('TEST')) {
    console.error(`❌ TU CHOI CHAY: "${dbName}" khong phai DB test. Script nay tao/xoa du lieu.`)
    process.exit(1)
  }
  console.log(`DB: ${dbName}\nAPI: ${BASE}`)

  // ══ Chuan bi ═════════════════════════════════════════════════════════════
  muc('0. CHUAN BI — dang nhap + xac dinh chuyen khoa, ngay kham')

  const tokenBN = await dangNhap('patient.test@vitafamily.local')
  kt('Benh nhan dang nhap', Boolean(tokenBN))
  if (!tokenBN) throw new Error('Khong dang nhap duoc benh nhan — chay seed-doctor-test-data.js truoc')

  const tokenBS = await dangNhap('doctor.test@vitafamily.local')
  kt('Bac si dang nhap', Boolean(tokenBS))

  // Dọn dấu vết lần chạy trước NGAY TỪ ĐẦU. Nếu không, chính luật "1 lượt/chuyên khoa/
  // ngày" sẽ chặn lần chạy này — và ta sẽ tưởng là code hỏng.
  const benhNhan = await NguoiDung.findOne({ email: 'patient.test@vitafamily.local' }).select('_id').lean()
  const lichCu = await LichHen.find({ user_id: benhNhan._id, ten_khach: { $regex: TAG } }).select('_id schedule_id slot_id').lean()
  for (const lh of lichCu) {
    if (lh.schedule_id && lh.slot_id) {
      await LichLamViec.updateOne(
        { _id: lh.schedule_id, 'slots._id': lh.slot_id },
        { $set: { 'slots.$.status': 'active', 'slots.$.benh_nhan_id': null, 'slots.$.benh_nhan_tam_giu_id': null, 'slots.$.pending_expired_at': null } },
      )
    }
  }
  await HangDoi.deleteMany({ appointment_id: { $in: lichCu.map((l) => l._id) } })
  await KetQuaKham.deleteMany({ appointment_id: { $in: lichCu.map((l) => l._id) } })
  await LichHen.deleteMany({ _id: { $in: lichCu.map((l) => l._id) } })
  if (lichCu.length > 0) console.log(`  Da don ${lichCu.length} lich hen cua lan chay truoc`)

  const userBS = await NguoiDung.findOne({ email: 'doctor.test@vitafamily.local' }).select('_id').lean()
  const bacSi = await BacSi.findOne({ user_id: userBS._id }).select('_id specialties').lean()
  const specialtyId = bacSi.specialties?.[0]
  const chuyenKhoa = await ChuyenKhoa.findById(specialtyId).lean()
  console.log(`  Bac si: ${bacSi._id}  Chuyen khoa: ${chuyenKhoa?.ten} (gia ${chuyenKhoa?.gia_kham})`)

  // Bao dam co lich lam viec o ngay test
  const ngayTest = ngayLamViecToi(3)
  let lichLamViec = await LichLamViec.findOne({ doctor_id: bacSi._id, ngay: ngayTest })
  if (!lichLamViec) {
    const { buildDefaultScheduleSlots } = await import('../services/scheduleGenerator.service.js')
    lichLamViec = await LichLamViec.create({
      doctor_id: bacSi._id, ngay: ngayTest, trang_thai_ngay: 'lam_viec',
      slots: await buildDefaultScheduleSlots({ specialtyId }),
    })
  }
  kt('Co lich lam viec o ngay test', Boolean(lichLamViec), ymd(ngayTest))

  // ══ 1. KHACH XEM KHUNG GIO ═══════════════════════════════════════════════
  muc('1. KHACH XEM KHUNG GIO (luong tu gan bac si — rule muc 12)')

  const khungCK = await api(`/patient/booking/specialties/${specialtyId}/slots?date=${ymd(ngayTest)}`)
  kt('GET khung gio theo chuyen khoa -> 200', khungCK.status === 200, `HTTP ${khungCK.status}: ${JSON.stringify(khungCK.body).slice(0, 120)}`)
  kt('Tra ve GIA truoc khi giu cho (rule muc 12)', khungCK.body?.data?.gia_kham > 0, `gia=${khungCK.body?.data?.gia_kham}`)
  kt('Gia = gia CHUYEN KHOA, khong phai gia bac si', khungCK.body?.data?.gia_kham === chuyenKhoa?.gia_kham)
  const dsKhung = khungCK.body?.data?.khung_gio ?? []
  kt('Co khung gio trong', dsKhung.length > 0, `${dsKhung.length} khung`)
  kt('Moi khung co so cho trong', dsKhung.every((k) => k.so_cho_trong > 0))
  console.log(`  Khung dau: ${dsKhung[0]?.gio_bat_dau} (${dsKhung[0]?.so_cho_trong} cho, ca ${dsKhung[0]?.ca})`)

  // ══ 2. DAT LICH ══════════════════════════════════════════════════════════
  muc('2. DAT LICH — validate dau vao')

  const khungChon = dsKhung[0]
  const donDatCoBan = {
    loai_kham: 'clinic',
    specialty_id: String(specialtyId),
    gio_bat_dau: khungChon.gio_bat_dau,
    ngay_kham: ymd(ngayTest),
    ten_khach: `${TAG} Nguyen Van Test`,
    so_dien_thoai_khach: '0912345678',
    ly_do_kham: 'Dau hong, kho nuot',
  }

  const thieuDieuKhoan = await api('/patient/booking', { method: 'POST', auth: tokenBN, body: donDatCoBan })
  kt('Khong tick dieu khoan -> 400 (rule muc 5)', thieuDieuKhoan.status === 400, `HTTP ${thieuDieuKhoan.status}`)
  console.log(`     "${thieuDieuKhoan.body?.message}"`)

  const thieuNgay = await api('/patient/booking', {
    method: 'POST', auth: tokenBN,
    body: { ...donDatCoBan, dong_y_dieu_khoan: true, ngay_kham: undefined },
  })
  kt('Thieu ngay kham -> 400', thieuNgay.status === 400)

  const ngayQuaKhu = await api('/patient/booking', {
    method: 'POST', auth: tokenBN,
    body: { ...donDatCoBan, dong_y_dieu_khoan: true, ngay_kham: '2020-01-01' },
  })
  kt('Ngay qua khu -> khong dat duoc', ngayQuaKhu.status >= 400, `HTTP ${ngayQuaKhu.status}`)

  const khongToken = await api('/patient/booking', { method: 'POST', body: { ...donDatCoBan, dong_y_dieu_khoan: true } })
  kt('Khong dang nhap -> 401', khongToken.status === 401, `HTTP ${khongToken.status}`)

  muc('3. DAT LICH THANH CONG')
  const datLich = await api('/patient/booking', {
    method: 'POST', auth: tokenBN, body: { ...donDatCoBan, dong_y_dieu_khoan: true },
  })
  kt('Dat lich -> 201', datLich.status === 201, `HTTP ${datLich.status}: ${JSON.stringify(datLich.body).slice(0, 200)}`)
  const apptId = datLich.body?.data?.appointment_id
  const paymentId = datLich.body?.data?.payment_id
  if (!apptId) throw new Error('Khong tao duoc lich hen, dung kiem thu')

  const apptSauDat = await LichHen.findById(apptId).lean()
  console.log(`  Ma lich hen: ${apptSauDat.ma_lich_hen}  Bac si tu gan: ${apptSauDat.doctor_id}`)
  kt('He thong TU GAN bac si', Boolean(apptSauDat.doctor_id))
  kt('Gia = gia chuyen khoa', apptSauDat.gia_kham === chuyenKhoa.gia_kham, `${apptSauDat.gia_kham} vs ${chuyenKhoa.gia_kham}`)
  kt('nguon = online', apptSauDat.nguon === 'online', String(apptSauDat.nguon))
  kt('Luu bang chung dong y dieu khoan', Boolean(apptSauDat.dieu_khoan_version && apptSauDat.dieu_khoan_dong_y_luc))
  kt('status = pending, chua thanh toan', apptSauDat.status === 'pending' && apptSauDat.payment_status === 'unpaid')
  kt('Co han thanh toan (giu cho co gian)', Boolean(apptSauDat.payment_deadline))

  const slotSauDat = (await LichLamViec.findById(apptSauDat.schedule_id).lean())
    .slots.find((s) => String(s._id) === String(apptSauDat.slot_id))
  kt('Slot chuyen pending_payment', slotSauDat.status === 'pending_payment', slotSauDat.status)
  kt('Slot co han giu cho', Boolean(slotSauDat.pending_expired_at))

  const hoaDon = await HoaDon.findOne({ appointment_id: apptId }).lean()
  kt('Sinh hoa don', Boolean(hoaDon) && hoaDon.tong_thanh_toan === chuyenKhoa.gia_kham)

  muc('4. CHAN TRUNG LUOT (rule muc 5)')
  const datTrung = await api('/patient/booking', {
    method: 'POST', auth: tokenBN,
    body: { ...donDatCoBan, dong_y_dieu_khoan: true, gio_bat_dau: dsKhung[1]?.gio_bat_dau ?? khungChon.gio_bat_dau },
  })
  // Giu cho cu chua thanh toan -> bi huy, lich moi duoc tao. Sau khi da thanh toan moi bi chan.
  kt('Dat lai khi CHUA thanh toan -> nha giu cho cu, tao lich moi', datTrung.status === 201, `HTTP ${datTrung.status}`)
  const apptCu = await LichHen.findById(apptId).lean()
  kt('Lich giu cho cu bi huy tu dong', apptCu.status === 'cancelled', apptCu.status)
  const apptId2 = datTrung.body?.data?.appointment_id
  const paymentId2 = datTrung.body?.data?.payment_id

  muc('5. THANH TOAN')
  const xacNhan = await api(`/patient/payments/${paymentId2}/confirm`, { method: 'PATCH', auth: tokenBN })
  kt('Xac nhan thanh toan -> 200', xacNhan.status === 200, `HTTP ${xacNhan.status}: ${JSON.stringify(xacNhan.body).slice(0, 150)}`)

  const apptDaTra = await LichHen.findById(apptId2).lean()
  kt('payment_status = paid', apptDaTra.payment_status === 'paid', apptDaTra.payment_status)
  kt('status = confirmed', apptDaTra.status === 'confirmed', apptDaTra.status)
  kt('Xoa han thanh toan', apptDaTra.payment_deadline === null)

  const slotDaTra = (await LichLamViec.findById(apptDaTra.schedule_id).lean())
    .slots.find((s) => String(s._id) === String(apptDaTra.slot_id))
  kt('Slot chuyen booked', slotDaTra.status === 'booked', slotDaTra.status)
  kt('Slot gan benh nhan', String(slotDaTra.benh_nhan_id) === String(apptDaTra.user_id))

  const tt = await ThanhToan.findById(paymentId2).lean()
  kt('Giao dich thanh toan = paid', tt.status === 'paid', tt.status)
  const hd = await HoaDon.findOne({ appointment_id: apptId2 }).lean()
  kt('Hoa don = da_thanh_toan_du', hd.trang_thai_hoa_don === 'da_thanh_toan_du', hd.trang_thai_hoa_don)

  muc('6. SAU KHI DA THANH TOAN — chan dat trung')
  const datTrung2 = await api('/patient/booking', {
    method: 'POST', auth: tokenBN,
    body: { ...donDatCoBan, dong_y_dieu_khoan: true, gio_bat_dau: dsKhung[2]?.gio_bat_dau ?? khungChon.gio_bat_dau },
  })
  kt('1 luot/chuyen khoa/ngay -> 409', datTrung2.status === 409, `HTTP ${datTrung2.status}`)
  console.log(`     "${datTrung2.body?.message}"`)

  // ══ 7. BAC SI CO NHAN DUOC KHONG ═════════════════════════════════════════
  muc('7. BAC SI — LICH LAM VIEC va LICH HEN')

  // Lich hen roi vao bac si nao thi dang nhap bac si do
  const bacSiNhan = await BacSi.findById(apptDaTra.doctor_id).select('user_id').lean()
  const userBSNhan = await NguoiDung.findById(bacSiNhan.user_id).select('email').lean()
  let tokenBSNhan = tokenBS
  if (String(bacSiNhan._id) !== String(bacSi._id)) {
    // He thong TU GAN nen lich co the roi vao bac si khac — dung hanh vi rule muc 12.
    console.log(`  Lich hen duoc tu gan cho bac si khac: ${userBSNhan.email}`)
    tokenBSNhan = await dangNhap(userBSNhan.email)
  }
  kt('Dang nhap duoc bac si nhan lich', Boolean(tokenBSNhan), userBSNhan.email)

  const lichBS = await api(`/doctor/schedule?tu_ngay=${ymd(ngayTest)}&den_ngay=${ymd(ngayTest)}`, { auth: tokenBSNhan })
  kt('GET /doctor/schedule -> 200', lichBS.status === 200, `HTTP ${lichBS.status}`)
  const dsNgay = Array.isArray(lichBS.body?.data) ? lichBS.body.data : (lichBS.body?.data?.items ?? [])
  const ngayCuaBS = dsNgay.find((x) => String(x.ngay ?? x.date ?? '').slice(0, 10) === ymd(ngayTest))
  kt('Bac si thay ngay lam viec do', Boolean(ngayCuaBS), `tra ve ${dsNgay.length} ngay`)
  if (ngayCuaBS) {
    console.log(`  Ngay ${ymd(ngayTest)}: ${JSON.stringify(ngayCuaBS).slice(0, 220)}`)
  }

  const chiTietCa = await api(`/doctor/schedule/${apptDaTra.schedule_id}`, { auth: tokenBSNhan })
  kt('GET chi tiet ca -> 200', chiTietCa.status === 200, `HTTP ${chiTietCa.status}`)
  const dsLichHenTrongCa = chiTietCa.body?.data?.lich_hen ?? chiTietCa.body?.data?.appointments ?? []
  kt('Chi tiet ca co danh sach lich hen',
    Array.isArray(dsLichHenTrongCa) && dsLichHenTrongCa.some((a) => String(a.id ?? a._id) === String(apptId2)),
    `${dsLichHenTrongCa.length} lich hen`)

  const dsLichHen = await api('/doctor/appointments', { auth: tokenBSNhan })
  kt('GET /doctor/appointments -> 200', dsLichHen.status === 200, `HTTP ${dsLichHen.status}`)

  const chiTiet = await api(`/doctor/appointments/${apptId2}`, { auth: tokenBSNhan })
  kt('GET chi tiet lich hen -> 200', chiTiet.status === 200, `HTTP ${chiTiet.status}`)
  const ct = chiTiet.body?.data ?? {}
  console.log(`  Du lieu bac si nhan duoc: ${Object.keys(ct).join(', ')}`)
  // API doi ten truong khi tra ve: ten_khach -> benh_nhan, so_dien_thoai_khach -> so_dien_thoai.
  for (const truong of ['benh_nhan', 'so_dien_thoai', 'ngay_kham', 'gio_kham', 'ly_do_kham',
                        'gia_kham', 'status', 'payment_status', 'chuyen_khoa', 'phong_kham']) {
    kt(`  co truong "${truong}"`, ct[truong] !== undefined && ct[truong] !== null, `= ${JSON.stringify(ct[truong])}`)
  }
  kt('  ten benh nhan dung voi don dat', ct.benh_nhan === `${TAG} Nguyen Van Test`, `= ${ct.benh_nhan}`)
  kt('  so dien thoai dung voi don dat', ct.so_dien_thoai === '0912345678', `= ${ct.so_dien_thoai}`)

  const bacSiKhac = await BacSi.findOne({ _id: { $ne: apptDaTra.doctor_id } }).select('user_id').lean()
  if (bacSiKhac) {
    const uKhac = await NguoiDung.findById(bacSiKhac.user_id).select('email').lean()
    const tokenKhac = await dangNhap(uKhac.email)
    if (tokenKhac) {
      const xemTrom = await api(`/doctor/appointments/${apptId2}`, { auth: tokenKhac })
      kt('Bac si KHAC khong xem duoc lich hen nay', xemTrom.status === 404 || xemTrom.status === 403, `HTTP ${xemTrom.status}`)
    }
  }

  return { tokenBN, tokenBSNhan, apptId2, paymentId2, ngayTest, specialtyId, dsKhung, chuyenKhoa }
}

const ctx = await main()

// ══ 8. CHECK-IN + HANG DOI ═════════════════════════════════════════════════
muc('8. CHECK-IN va HANG DOI')

const apptHomNay = await (async () => {
  // Lich test o ngay tuong lai -> check-in se bi chan. Tao them 1 lich HOM NAY de thu.
  const homNay = new Date(); homNay.setUTCHours(0, 0, 0, 0)
  const appt = await LichHen.findById(ctx.apptId2)
  const lich = await LichLamViec.findOne({ doctor_id: appt.doctor_id, ngay: homNay })
  if (!lich) return null
  const slot = lich.slots.find((s) => s.status === 'active')
  if (!slot) return null
  const moi = await LichHen.create({
    user_id: appt.user_id, doctor_id: appt.doctor_id, schedule_id: lich._id, slot_id: slot._id,
    specialty_id: appt.specialty_id, loai_kham: 'clinic', ngay_kham: homNay,
    gio_kham: slot.gio_bat_dau, gia_kham: appt.gia_kham, ten_khach: `${TAG} khach hom nay`,
    so_dien_thoai_khach: '0912345679', status: 'confirmed', payment_status: 'paid',
    ma_lich_hen: `${TAG}_TODAY_${Date.now()}`, nguon: 'online',
  })
  await LichLamViec.updateOne({ _id: lich._id, 'slots._id': slot._id },
    { $set: { 'slots.$.status': 'booked', 'slots.$.benh_nhan_id': appt.user_id } })
  return moi
})()

if (!apptHomNay) {
  kt('Tao duoc lich hom nay de thu check-in', false, 'bac si khong co lich lam viec hom nay')
} else {
  const checkinNgayTuongLai = await api('/doctor/queue/checkin', {
    method: 'POST', auth: ctx.tokenBSNhan, body: { appointment_id: ctx.apptId2 },
  })
  kt('Check-in lich NGAY KHAC -> 409', checkinNgayTuongLai.status === 409, `HTTP ${checkinNgayTuongLai.status}`)

  const checkin = await api('/doctor/queue/checkin', {
    method: 'POST', auth: ctx.tokenBSNhan, body: { appointment_id: String(apptHomNay._id) },
  })
  kt('Check-in lich hom nay -> 201', checkin.status === 201, `HTTP ${checkin.status}: ${JSON.stringify(checkin.body).slice(0, 150)}`)
  const entryId = checkin.body?.data?.entry?._id

  const checkinLai = await api('/doctor/queue/checkin', {
    method: 'POST', auth: ctx.tokenBSNhan, body: { appointment_id: String(apptHomNay._id) },
  })
  kt('Check-in 2 lan -> 409', checkinLai.status === 409, `HTTP ${checkinLai.status}`)

  const apptSauCheckin = await LichHen.findById(apptHomNay._id).lean()
  kt('Lich hen danh dau da den', apptSauCheckin.trang_thai_den === 'da_den', String(apptSauCheckin.trang_thai_den))
  kt('Co gio den thuc te', Boolean(apptSauCheckin.gio_den_thuc_te))

  const hangDoi = await api('/doctor/queue-entries', { auth: ctx.tokenBSNhan })
  kt('GET hang doi -> 200', hangDoi.status === 200, `HTTP ${hangDoi.status}`)
  const luot = (hangDoi.body?.data ?? []).find((e) => String(e.id) === String(entryId))
  kt('Luot vua check-in nam trong hang doi', Boolean(luot))
  if (luot) {
    console.log(`  muc_uu_tien=${luot.muc_uu_tien}  luc_checkin=${luot.muc_uu_tien_luc_checkin}  da_toi_khung=${luot.da_toi_khung}`)
    kt('Tra bac uu tien DONG (rule muc 6)', luot.muc_uu_tien !== undefined)
    kt('Tra kem snapshot luc check-in', luot.muc_uu_tien_luc_checkin !== undefined)
    kt('Tra co da_toi_khung', luot.da_toi_khung !== undefined)
  }

  // ══ 9. GOI -> VAO PHONG -> KET QUA ══════════════════════════════════════
  muc('9. THAO TAC KHAM: goi -> vao phong -> ket qua -> hoan thanh')

  // Sau ca kham truoc, phong o trang thai 'dang_don_phong'. Benh nhan tiep theo chi vao
  // duoc khi bac si bam "san sang" — kiem luon chuc nang do o day.
  const phongTruoc = await api('/doctor/room-status', { auth: ctx.tokenBSNhan })
  kt('GET trang thai phong -> 200', phongTruoc.status === 200, `HTTP ${phongTruoc.status}`)
  console.log(`  Trang thai phong hien tai: ${phongTruoc.body?.data?.trang_thai ?? '(chua co)'}`)

  const datSanSang = await api('/doctor/room-status', {
    method: 'PATCH', auth: ctx.tokenBSNhan, body: { trang_thai: 'san_sang' },
  })
  kt('Dat phong ve "san sang" -> 200', datSanSang.status === 200,
    `HTTP ${datSanSang.status}: ${datSanSang.body?.message ?? ''}`)

  const goi = await api(`/doctor/queue/${entryId}/call`, { method: 'PATCH', auth: ctx.tokenBSNhan })
  kt('Goi benh nhan', goi.status === 200 || goi.status === 409,
    `HTTP ${goi.status}: ${goi.body?.message ?? ''}`)
  if (goi.status === 409) console.log(`     (chan dung nghiep vu: "${goi.body?.message}")`)

  if (goi.status === 200) {
    const vaoPhong = await api(`/doctor/queue/${entryId}/into-room`, { method: 'PATCH', auth: ctx.tokenBSNhan })
    kt('Vao phong -> 200', vaoPhong.status === 200, `HTTP ${vaoPhong.status}: ${vaoPhong.body?.message ?? ''}`)

    const taoKQ = await api(`/doctor/appointments/${apptHomNay._id}/result`, {
      method: 'POST', auth: ctx.tokenBSNhan,
      body: { chan_doan: `${TAG} Viem hong cap`, loi_dan: 'Uong nhieu nuoc am' },
    })
    kt('Tao ket qua kham', taoKQ.status === 201 || taoKQ.status === 200, `HTTP ${taoKQ.status}: ${JSON.stringify(taoKQ.body).slice(0, 150)}`)

    const docKQ = await api(`/doctor/appointments/${apptHomNay._id}/result`, { auth: ctx.tokenBSNhan })
    kt('Doc lai ket qua kham -> 200', docKQ.status === 200, `HTTP ${docKQ.status}`)
    kt('Ket qua luu dung chan doan', docKQ.body?.data?.chan_doan === `${TAG} Viem hong cap`)

    const ketThuc = await api(`/doctor/queue/${entryId}/finish`, { method: 'PATCH', auth: ctx.tokenBSNhan })
    kt('Ket thuc kham -> 200', ketThuc.status === 200, `HTTP ${ketThuc.status}: ${ketThuc.body?.message ?? ''}`)

    const phongSau = await api('/doctor/room-status', { auth: ctx.tokenBSNhan })
    kt('Kham xong -> phong chuyen "dang_don_phong"',
      phongSau.body?.data?.trang_thai === 'dang_don_phong',
      `= ${phongSau.body?.data?.trang_thai}`)
    // Tra phong ve san sang de lan chay sau khong bi ket.
    await api('/doctor/room-status', { method: 'PATCH', auth: ctx.tokenBSNhan, body: { trang_thai: 'san_sang' } })
  }
}

// ══ 10. HUY LICH ═══════════════════════════════════════════════════════════
muc('10. HUY LICH HEN — da thanh toan thi KHONG hoan tien (rule muc 5)')

const huyDaTra = await api(`/patient/booking/${ctx.apptId2}/cancel`, {
  method: 'PATCH', auth: ctx.tokenBN, body: { ly_do: 'Ban dot xuat' },
})
kt('Khach tu huy lich DA THANH TOAN -> bi chan', huyDaTra.status >= 400, `HTTP ${huyDaTra.status}`)
console.log(`     "${huyDaTra.body?.message}"`)

// ══ 11. DOI LICH ═══════════════════════════════════════════════════════════
muc('11. DOI LICH — khach tu xin doi (rule muc 5: 1 lan, truoc T-30\')')

const xemPhuongAn = await api(`/patient/appointments/${ctx.apptId2}/reschedule`, { auth: ctx.tokenBN })
kt('GET phuong an doi -> 200', xemPhuongAn.status === 200, `HTTP ${xemPhuongAn.status}: ${JSON.stringify(xemPhuongAn.body).slice(0, 200)}`)
const pa = xemPhuongAn.body?.data
if (pa) {
  kt('Bao ro KHONG mat tien', pa.khong_mat_tien === true)
  kt('Cho biet con bao nhieu lan doi', pa.con_lai !== undefined, `con_lai=${pa.con_lai}`)
  kt('Co phuong an de chon', (pa.phuong_an ?? []).length > 0, `${(pa.phuong_an ?? []).length} phuong an`)
  console.log(`     ${(pa.phuong_an ?? []).slice(0, 3).map((p) => p.mo_ta).join(' | ')}`)
  kt('Khach tu doi KHONG duoc lan slot walk-in', !(pa.phuong_an ?? []).some((p) => p.lan_walk_in))
}

if (pa?.phuong_an?.length) {
  const gioTruoc = (await LichHen.findById(ctx.apptId2).lean()).gio_kham
  const doi = await api(`/patient/appointments/${ctx.apptId2}/reschedule`, {
    method: 'POST', auth: ctx.tokenBN, body: { phuong_an_index: 0 },
  })
  kt('Doi lich lan 1 -> 200', doi.status === 200, `HTTP ${doi.status}: ${JSON.stringify(doi.body).slice(0, 150)}`)

  const sauDoi = await LichHen.findById(ctx.apptId2).lean()
  kt('Gio/bac si da doi', sauDoi.gio_kham !== gioTruoc || String(sauDoi.doctor_id) !== String(pa.phuong_an[0].doctor_id ?? ''),
    `${gioTruoc} -> ${sauDoi.gio_kham}`)
  kt('Dem dung 1 lan doi cua khach', sauDoi.so_lan_doi_khach_yeu_cau === 1, String(sauDoi.so_lan_doi_khach_yeu_cau))
  kt('ly_do_doi = khach_yeu_cau', sauDoi.ly_do_doi === 'khach_yeu_cau', String(sauDoi.ly_do_doi))
  kt('Gia KHONG doi sau khi dai lich', sauDoi.gia_kham === ctx.chuyenKhoa.gia_kham)
  kt('Van la lich da thanh toan', sauDoi.payment_status === 'paid')

  const doiLan2 = await api(`/patient/appointments/${ctx.apptId2}/reschedule`, { auth: ctx.tokenBN })
  kt('Doi lan 2 -> bi chan (tran 1 lan)', doiLan2.status === 409, `HTTP ${doiLan2.status}`)
  console.log(`     "${doiLan2.body?.message}"`)
}

// ══ 12. TONG KET ═══════════════════════════════════════════════════════════
muc('TONG KET')
console.log(`  Dung : ${soDung}`)
console.log(`  Sai  : ${soSai}`)
if (loiChiTiet.length > 0) {
  console.log('\n  Cac diem KHONG dat:')
  loiChiTiet.forEach((m, i) => console.log(`   ${i + 1}. ${m}`))
}

// Don du lieu test
await KetQuaKham.deleteMany({ chan_doan: { $regex: TAG } })
await HangDoi.deleteMany({ ten_benh_nhan: { $regex: TAG } })
await LichHen.deleteMany({ ten_khach: { $regex: TAG } })
console.log('\n  Da don du lieu kiem thu.')

await mongoose.disconnect()
process.exit(soSai === 0 ? 0 : 1)
