/**
 * KIEM THU DAU-CUOI: hang doi trung tam khach vang lai (mo hinh MOI)
 * ===================================================================
 * Khac voi `e2e-offline-intake.js` (mo hinh walk-in CU — claim slot ngay), script nay
 * kiem dung luong UI THAT dang dung (`PatientIntake.tsx` -> `POST
 * /receptionist/offline-queue/intake`): khach vao HangDoi.trang_thai='cho_dieu_phoi'
 * CHUA gan bac si, le tan dieu phoi thu cong/ban tu dong khi bac si co khoang trong an toan.
 *
 * Kiem 3 nhom:
 *   1. Luong binh thuong: tao ho so -> tiep nhan trung tam -> goi y dieu phoi -> dieu phoi
 *      -> bac si thay trong "Ho so cho kham" -> goi/vao phong/ket thuc -> nhap+xac nhan ho so
 *      -> le tan lap hoa don + thu tien mat thanh cong.
 *   2. Tinh huong loi: trung luot trong ngay (409), thieu truong bat buoc (400), huy luot
 *      dang cho dieu phoi, tiep nhan lai sau khi huy.
 *   3. Bac si goi nhung khach vang mat -> nut "Bo luot": xac nhan trang_thai chuyen thanh
 *      'skipped' (KHONG phai 'no_show' — rule muc 8: da co HangDoi thi khong bao gio
 *      thanh no_show, du tre bao lau).
 *
 * ⚠️ CHI chay tren DB TEST. Script tu chan neu ten DB khong chua 'TEST'.
 *
 * DUNG:
 *   MONGODB_URI=<db-test> TEST_API_BASE_URL=http://localhost:5199/api \
 *     node src/scripts/e2e-hang-doi-vang-lai-trung-tam.js
 */
import '../config/timezone.js'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  BacSi, ChuyenKhoa, HangDoi, HoSoBenhNhan, HoaDon, KetQuaKham, NguoiDung, ThanhToan,
} from '../models/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const BASE = process.env.TEST_API_BASE_URL || 'http://localhost:5199/api'
const TAG = 'E2E-OFFCENTRAL'

let soDung = 0
let soSai = 0
const loiChiTiet = []
function kt(ten, dieuKien, chiTiet = '') {
  if (dieuKien) { soDung += 1; console.log(`  OK ${ten}${chiTiet ? ` -- ${chiTiet}` : ''}`) }
  else { soSai += 1; loiChiTiet.push(`${ten}${chiTiet ? ` -- ${chiTiet}` : ''}`); console.log(`  FAIL ${ten}${chiTiet ? ` -- ${chiTiet}` : ''}`) }
}
function muc(ten) { console.log(`\n${ten}`) }

function taoToken(user) {
  return jwt.sign({ id: String(user._id), role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' })
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

const daTao = { hoSo: [] }
async function donDep() {
  if (!daTao.hoSo.length) return
  const hangDoiRows = await HangDoi.find({ ho_so_benh_nhan_id: { $in: daTao.hoSo } }).select('_id').lean()
  const hangDoiIds = hangDoiRows.map((r) => r._id)
  if (hangDoiIds.length) {
    await KetQuaKham.deleteMany({ hang_doi_id: { $in: hangDoiIds } })
    await ThanhToan.deleteMany({ hang_doi_id: { $in: hangDoiIds } })
    await HoaDon.deleteMany({ hang_doi_id: { $in: hangDoiIds } })
    await HangDoi.deleteMany({ _id: { $in: hangDoiIds } })
  }
  await HoSoBenhNhan.deleteMany({ _id: { $in: daTao.hoSo } })
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI)
  const tenDb = mongoose.connection.db.databaseName
  if (!tenDb.toUpperCase().includes('TEST')) {
    console.error(`[${TAG}] DUNG LAI: "${tenDb}" khong phai DB test. Script nay ghi va xoa du lieu.`)
    process.exit(1)
  }
  console.log(`[${TAG}] DB: ${tenDb} | API: ${BASE}`)

  const leTan = await NguoiDung.findOne({ role: 'receptionist' }).lean()
  const bacSiUsers = await NguoiDung.find({ role: 'doctor' }).lean()
  const bacSisAll = await BacSi.find({ trang_thai: 'active' }).lean()
  if (!leTan) { console.error(`[${TAG}] khong co tai khoan le tan`); process.exit(1) }
  if (bacSisAll.length < 2) { console.error(`[${TAG}] can >=2 bac si active`); process.exit(1) }

  // Chon chuyen khoa co >=2 bac si de kiem tra dieu phoi co lua chon that su.
  const bySpecialty = new Map()
  for (const b of bacSisAll) {
    for (const s of b.specialties || []) {
      const key = String(s)
      if (!bySpecialty.has(key)) bySpecialty.set(key, [])
      bySpecialty.get(key).push(b)
    }
  }
  const bestSpecialtyId = [...bySpecialty.entries()].sort((a, b) => b[1].length - a[1].length)[0]?.[0]
  const specialty = bestSpecialtyId ? await ChuyenKhoa.findById(bestSpecialtyId).lean() : null
  const bacSis = bestSpecialtyId ? bySpecialty.get(bestSpecialtyId) : bacSisAll
  if (!specialty) { console.error(`[${TAG}] khong co chuyen khoa co bac si hop le`); process.exit(1) }

  const tokLeTan = taoToken(leTan)
  const bacSiUserById = new Map(bacSiUsers.map((u) => [String(u._id), u]))
  const doctorTok = (bacSi) => taoToken(bacSiUserById.get(String(bacSi.user_id)))

  console.log(`[${TAG}] le tan: ${leTan.ho_ten} | chuyen khoa: ${specialty.ten} | so bac si: ${bacSis.length}`)

  const runTag = Date.now().toString(36)
  async function taoHoSo(suffix) {
    const phone = `09${String(Math.floor(10000000 + Math.random() * 89999999))}`
    const r = await api('POST', '/receptionist/patient-intake/profiles', {
      tok: tokLeTan,
      body: { ho_ten: `${TAG} ${runTag} Khach ${suffix}`, so_dien_thoai: phone, gioi_tinh: 'nam', dia_chi: 'So 1 Kiem Thu' },
    })
    if (r.status !== 201 && r.status !== 200) throw new Error(`tao ho so that bai: ${r.status} ${JSON.stringify(r.body)}`)
    const profileId = r.body?.data?.profile?.id ?? r.body?.data?.profile?._id ?? r.body?.data?.id
    if (!profileId) throw new Error(`khong lay duoc profileId tu response: ${JSON.stringify(r.body)}`)
    daTao.hoSo.push(profileId)
    return profileId
  }

  try {
    // ─── NHOM 1: Luong binh thuong — tiep nhan -> dieu phoi -> bac si -> ket thuc -> hoa don ──
    muc('NHOM 1: Luong vang lai binh thuong (tu quay den bac si den hoa don)')
    let queueId, assignedDoctorId
    {
      const hoSoId = await taoHoSo('A-binhthuong')
      kt('tao ho so benh nhan vang lai', !!hoSoId)

      const cap = await api('GET', `/receptionist/offline-queue/capacity?specialty_id=${specialty._id}`, { tok: tokLeTan })
      kt('lay suc chua hang doi trung tam OK', cap.status === 200, `co_the_nhan=${cap.body?.data?.co_the_nhan}`)

      const intake = await api('POST', '/receptionist/offline-queue/intake', {
        tok: tokLeTan,
        body: { ho_so_benh_nhan_id: hoSoId, specialty_id: specialty._id },
      })
      kt('tiep nhan vao hang doi trung tam thanh cong (201)', intake.status === 201, `${intake.status} ${JSON.stringify(intake.body?.message)}`)
      queueId = intake.body?.data?.entry?._id
      kt('entry co trang_thai cho_dieu_phoi', intake.body?.data?.entry?.trang_thai === 'cho_dieu_phoi')

      const list = await api('GET', `/receptionist/offline-queue?specialty_id=${specialty._id}`, { tok: tokLeTan })
      kt('danh sach hang doi trung tam co entry vua tao', list.body?.data?.some((e) => e.id === String(queueId)))

      const goiY = await api('GET', `/receptionist/offline-queue/dispatch-suggestions?specialty_id=${specialty._id}`, { tok: tokLeTan })
      kt('lay goi y dieu phoi OK', goiY.status === 200)
      const suggestion = goiY.body?.data?.suggestions?.find((s) => s.queue_id === String(queueId))
      kt('co goi y cho entry vua tao', !!suggestion, JSON.stringify(suggestion?.de_xuat_tot_nhat))
      const bestCandidate = suggestion?.de_xuat_tot_nhat
      kt('co it nhat 1 bac si hop le duoc de xuat', !!bestCandidate)
      assignedDoctorId = bestCandidate?.doctor_id

      if (assignedDoctorId) {
        const assign = await api('POST', `/receptionist/offline-queue/${queueId}/assign`, {
          tok: tokLeTan, body: { doctor_id: assignedDoctorId },
        })
        kt('dieu phoi cho bac si thanh cong', assign.status === 200, `${assign.status} ${JSON.stringify(assign.body?.message)}`)
        kt('entry chuyen trang_thai dang_cho sau dieu phoi', assign.body?.data?.entry?.trang_thai === 'dang_cho')
      }
    }

    if (queueId && assignedDoctorId) {
      const bacSi = bacSis.find((b) => String(b._id) === String(assignedDoctorId))
      const tokBacSi = doctorTok(bacSi)

      const queueBacSi = await api('GET', '/doctor/queue', { tok: tokBacSi })
      const rowInQueue = queueBacSi.body?.data?.find((r) => String(r.id) === String(queueId))
      kt('bac si thay khach vang lai trong Ho so cho kham', !!rowInQueue, `nguon=${rowInQueue?.nguon} trang_thai_tong_hop=${rowInQueue?.trang_thai_tong_hop}`)
      kt('nguon danh dau offline', rowInQueue?.nguon === 'offline')
      kt('trang_thai_tong_hop la dang_cho', rowInQueue?.trang_thai_tong_hop === 'dang_cho')

      const call = await api('PATCH', `/doctor/queue/${queueId}/call`, { tok: tokBacSi })
      kt('bac si goi benh nhan thanh cong', call.status === 200, `${call.status} ${JSON.stringify(call.body?.message)}`)

      const intoRoom = await api('PATCH', `/doctor/queue/${queueId}/into-room`, { tok: tokBacSi })
      kt('cho benh nhan vao phong thanh cong (offline khong bi chan boi payment gate)', intoRoom.status === 200, `${intoRoom.status} ${JSON.stringify(intoRoom.body?.message)}`)

      const finish = await api('PATCH', `/doctor/queue/${queueId}/finish`, { tok: tokBacSi })
      kt('ket thuc kham thanh cong', finish.status === 200, `${finish.status} ${JSON.stringify(finish.body?.message)}`)

      const queueSauFinish = await api('GET', '/doctor/queue', { tok: tokBacSi })
      const rowSauFinish = queueSauFinish.body?.data?.find((r) => String(r.id) === String(queueId))
      kt('sau finish trang_thai_tong_hop la cho_nhap_ho_so', rowSauFinish?.trang_thai_tong_hop === 'cho_nhap_ho_so', rowSauFinish?.trang_thai_tong_hop)

      const nhapHoSo = await api('POST', `/doctor/appointments/records/${queueId}/result`, {
        tok: tokBacSi, body: { chan_doan: 'Viem hong nhe (E2E test)', huong_dan_dieu_tri: 'Nghi ngoi, uong nhieu nuoc' },
      })
      kt('bac si nhap + tu xac nhan ho so offline thanh cong', nhapHoSo.status === 200 || nhapHoSo.status === 201, `${nhapHoSo.status} ${JSON.stringify(nhapHoSo.body?.message)}`)

      const queueSauNhap = await api('GET', '/doctor/queue', { tok: tokBacSi })
      const rowSauNhap = queueSauNhap.body?.data?.find((r) => String(r.id) === String(queueId))
      kt('sau nhap ho so trang_thai_tong_hop la da_xong (offline tu xac nhan luon)', rowSauNhap?.trang_thai_tong_hop === 'da_xong', rowSauNhap?.trang_thai_tong_hop)

      // ─── Thanh toan ───
      const billingCase = await api('GET', `/receptionist/payments/cases/${queueId}?source=offline`, { tok: tokLeTan })
      kt('le tan xem duoc ca cho thu tien', billingCase.status === 200, `${billingCase.status} ${JSON.stringify(billingCase.body?.message)}`)

      const invoice = await api('POST', `/receptionist/payments/cases/${queueId}/invoice?source=offline`, {
        tok: tokLeTan, body: { phuong_thuc: 'tien_mat' },
      })
      kt('lap hoa don + thu tien mat thanh cong', invoice.status === 200 || invoice.status === 201, `${invoice.status} ${JSON.stringify(invoice.body?.message)}`)
      kt('hoa don o trang thai da thanh toan du', invoice.body?.data?.invoice?.trang_thai_hoa_don === 'da_thanh_toan_du',
        invoice.body?.data?.invoice?.trang_thai_hoa_don)
    }

    // ─── NHOM 2: Loi — tao trung ho so trong ngay ─────────────────────────────
    muc('NHOM 2: Tinh huong loi')
    {
      const hoSoId = await taoHoSo('B-trunglot')
      const i1 = await api('POST', '/receptionist/offline-queue/intake', { tok: tokLeTan, body: { ho_so_benh_nhan_id: hoSoId, specialty_id: specialty._id } })
      kt('lan tiep nhan dau thanh cong', i1.status === 201, `${i1.status} ${JSON.stringify(i1.body?.message)}`)
      const i2 = await api('POST', '/receptionist/offline-queue/intake', { tok: tokLeTan, body: { ho_so_benh_nhan_id: hoSoId, specialty_id: specialty._id } })
      kt('tiep nhan lan 2 cung ho so cung ngay bi tu choi (409)', i2.status === 409, `${i2.status} ${i2.body?.message}`)

      const qid = i1.body?.data?.entry?._id
      const cancel = await api('PATCH', `/receptionist/offline-queue/${qid}/cancel`, { tok: tokLeTan, body: { ly_do: 'E2E test cleanup' } })
      kt('huy luot dang cho_dieu_phoi thanh cong', cancel.status === 200, `${cancel.status} ${cancel.body?.message}`)
      kt('sau huy trang_thai la cancelled', cancel.body?.data?.entry?.trang_thai === 'cancelled')

      const i3 = await api('POST', '/receptionist/offline-queue/intake', { tok: tokLeTan, body: { ho_so_benh_nhan_id: hoSoId, specialty_id: specialty._id } })
      kt('sau khi huy, tiep nhan lai duoc trong ngay', i3.status === 201, `${i3.status} ${i3.body?.message}`)
    }

    {
      const missingProfile = await api('POST', '/receptionist/offline-queue/intake', { tok: tokLeTan, body: { specialty_id: specialty._id } })
      kt('thieu ho_so_benh_nhan_id bi tu choi (400)', missingProfile.status === 400, `${missingProfile.status} ${missingProfile.body?.message}`)

      const missingSpecialty = await api('POST', '/receptionist/offline-queue/intake', { tok: tokLeTan, body: { ho_so_benh_nhan_id: daTao.hoSo[0] } })
      kt('thieu specialty_id bi tu choi (400)', missingSpecialty.status === 400, `${missingSpecialty.status} ${missingSpecialty.body?.message}`)
    }

    // ─── NHOM 3: Bac si goi nhung khach khong den -> "Bo luot" ─────────────
    muc('NHOM 3: Bac si goi nhung khach vang mat -- nut Bo luot')
    {
      // Sau khi Nhom 1 finish() thi phong chuyen 'dang_don_phong' -- phai bam "San sang"
      // truoc khi duoc dieu phoi tiep, giong hanh vi le tan/bac si that ngoai doi.
      for (const b of bacSis) {
        await api('PATCH', '/doctor/room-status', { tok: doctorTok(b), body: { trang_thai: 'san_sang' } })
      }
      const hoSoId = await taoHoSo('C-bovang')
      const intake = await api('POST', '/receptionist/offline-queue/intake', { tok: tokLeTan, body: { ho_so_benh_nhan_id: hoSoId, specialty_id: specialty._id } })
      const qid = intake.body?.data?.entry?._id
      kt('tiep nhan thanh cong (chuan bi kich ban vang mat)', intake.status === 201, `${intake.status} ${JSON.stringify(intake.body?.message)}`)

      const goiY = await api('GET', `/receptionist/offline-queue/dispatch-suggestions?specialty_id=${specialty._id}&queue_id=${qid}`, { tok: tokLeTan })
      const best = goiY.body?.data?.suggestions?.[0]?.de_xuat_tot_nhat
      if (best) {
        await api('POST', `/receptionist/offline-queue/${qid}/assign`, { tok: tokLeTan, body: { doctor_id: best.doctor_id } })
        const bacSi = bacSis.find((b) => String(b._id) === String(best.doctor_id))
        const tokBacSi = doctorTok(bacSi)

        const call = await api('PATCH', `/doctor/queue/${qid}/call`, { tok: tokBacSi })
        kt('bac si goi khach (nhung khach khong co mat)', call.status === 200)

        const skip = await api('PATCH', `/doctor/queue/${qid}/skip`, { tok: tokBacSi })
        kt('bac si bam Bo luot thanh cong', skip.status === 200, `${skip.status} ${skip.body?.message}`)
        kt('entry chuyen trang_thai skipped (KHONG phai no_show)', skip.body?.data?.trang_thai === 'skipped', skip.body?.data?.trang_thai)

        // rule muc 8: da co HangDoi thi khong bao gio thanh no_show du tre bao lau.
        const entryDb = await HangDoi.findById(qid).lean()
        kt('DB xac nhan trang_thai=skipped, khong phai no_show', entryDb?.trang_thai === 'skipped', entryDb?.trang_thai)
      } else {
        console.log('  (bo qua nhom 3: khong co bac si hop le de dieu phoi luc nay)')
      }
    }

    console.log(`\n[${TAG}] KET QUA: ${soDung} dat / ${soSai} khong dat`)
    if (loiChiTiet.length) {
      console.log('Chi tiet loi:')
      loiChiTiet.forEach((l) => console.log('  -', l))
    }
  } finally {
    await donDep()
    await mongoose.disconnect()
  }

  process.exit(soSai > 0 ? 1 : 0)
}

main().catch((err) => { console.error(err); process.exit(1) })
