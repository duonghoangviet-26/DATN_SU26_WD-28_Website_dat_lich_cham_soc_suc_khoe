import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { LichHen, NguoiDung } from '../models/index.js'
import * as billing from '../controllers/receptionist/billing.controller.js'

// ============================================================
// Data repair MOT LAN (2026-08-21) — 6 ca online da_thanh_toan_du nhung
// da_xac_nhan_thu_ngan chua duoc le tan xac nhan (xem
// "docs/Phan tich lo hong xac nhan thanh toan quay le tan (2026-08-21).md").
//
// Dung LAI controller that (`billing.createBillingInvoice`) qua req/res gia
// lap — giong ky thuat e2e-lien-ket-bacsi-letan.js — de khong tu viet lai
// logic nghiep vu (tinh lai tong tien, trang thai hoa don, ghi audit...).
//
// 4 ca KHONG co dich vu phat sinh (con_phai_thu = 0d): goi createBillingInvoice
// KHONG kem phuong_thuc -> chi xac nhan doi chieu 0d, khong tao thanh toan moi.
// 2 ca CO dich vu phat sinh bac si da chi dinh nhung hoa don chua cap nhat:
// goi createBillingInvoice KHONG kem phuong_thuc -> CHI cap nhat lai
// tong_tien_phat_sinh/tong_thanh_toan cho dung thuc te, KHONG tu danh dau da
// thu tien (tien do that su CHUA duoc thu) — le tan van phai vao UI de thu
// va xac nhan phan phat sinh nay.
//
// Chay: node src/scripts/fix-stale-billing-cases-2026-08-21.js
// ============================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const MA_LICH_HEN = [
  'LH-260713-0006',
  'LH-260724-0003',
  'LH-260804-0009',
  'LH-260814-0001',
  'LH-260815-0001',
  'LH-260819-0001',
]

function mockReqRes({ params = {}, query = {}, body = {}, user = {} } = {}) {
  const res = { statusCode: 200, body: null }
  res.status = function status(code) { res.statusCode = code; return res }
  res.json = function json(payload) { res.body = payload; return res }
  const req = { params, query, body, user }
  return { req, res }
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('Thieu MONGODB_URI')
  await mongoose.connect(uri)
  console.log(`DB: ${mongoose.connection.db.databaseName}`)

  const receptionistUser = await NguoiDung.findOne({ role: 'receptionist', status: 'active' }).select('_id ho_ten').lean()
  if (!receptionistUser) throw new Error('Khong tim thay tai khoan le tan active de dung lam actor')
  console.log(`Actor: ${receptionistUser.ho_ten} (${receptionistUser._id})`)
  const user = { id: receptionistUser._id, role: 'receptionist' }

  for (const code of MA_LICH_HEN) {
    const appt = await LichHen.findOne({ ma_lich_hen: code }).select('_id').lean()
    if (!appt) { console.log(`\n[${code}] KHONG TIM THAY lich hen — bo qua`); continue }

    const { req, res } = mockReqRes({
      params: { referenceId: String(appt._id) },
      query: { source: 'online' },
      body: {},
      user,
    })
    await billing.createBillingInvoice(req, res)
    const data = res.body?.data
    if (res.statusCode !== 201) {
      console.log(`\n[${code}] LOI status=${res.statusCode} message=${res.body?.message}`)
      continue
    }
    console.log(`\n[${code}] OK — trang_thai_hoa_don=${data.billing_summary.trang_thai_hoa_don} | tong_thanh_toan=${data.billing_summary.tong_thanh_toan} | tong_da_thu=${data.billing_summary.tong_da_thu} | con_phai_thu=${data.billing_summary.con_phai_thu} | da_xac_nhan_thu_ngan=${data.da_xac_nhan_thu_ngan}`)
  }

  await mongoose.disconnect()
  console.log('\nHoan tat.')
}

main().catch((err) => { console.error('Loi:', err); process.exit(1) })
