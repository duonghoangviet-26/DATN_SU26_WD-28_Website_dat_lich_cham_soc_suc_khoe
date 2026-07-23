import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

import { ChuyenKhoa } from '../models/index.js'
import { buildDefaultScheduleSlots, phanBoOnlineTheoKhung } from '../services/scheduleGenerator.service.js'

// Script xac minh (khong phai unit test) — khop convention da co trong backend/src/scripts/
// (vd verify-khang-nurse-live-flow.js). Chay: node src/scripts/verify-khung-slot-generation.js

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

let failCount = 0

function assertEqual(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`)
  if (!ok) failCount += 1
}

async function run() {
  // 1) Kiem tra thuat toan thuan, khong can DB — khop vi du dac ta muc 4.3.
  assertEqual(phanBoOnlineTheoKhung(7, 2, 70), [1, 2, 1, 2, 1, 2, 1], 'phanBoOnlineTheoKhung ca sang TMH (7 khung, 2 slot/khung, 70%)')
  assertEqual(phanBoOnlineTheoKhung(8, 2, 70), [1, 2, 1, 2, 1, 2, 1, 1], 'phanBoOnlineTheoKhung ca chieu TMH (8 khung, 2 slot/khung, 70%)')

  // 2) Kiem tra buildDefaultScheduleSlots tren du lieu that (can ChuyenKhoa "Tai Mui Hong" da seed).
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.log('SKIP - phan 2 (khong co MONGODB_URI, chi chay duoc phan 1 thuat toan thuan)')
    process.exit(failCount > 0 ? 1 : 0)
  }

  await mongoose.connect(uri)
  const tmh = await ChuyenKhoa.findOne({ ten: 'Tai Mũi Họng' }).lean()
  if (!tmh) {
    console.log('SKIP - khong tim thay chuyen khoa "Tai Mũi Họng", hay chay npm run db:seed truoc')
    await mongoose.disconnect()
    process.exit(failCount > 0 ? 1 : 0)
  }

  const slots = await buildDefaultScheduleSlots({ specialtyId: tmh._id, phongKham: 'Test' })

  assertEqual(slots.length, 15 * tmh.so_slot_moi_khung, `tong so slot sinh ra (so_slot_moi_khung=${tmh.so_slot_moi_khung})`)

  const dem = new Map()
  for (const s of slots) {
    dem.set(s.khung_index, (dem.get(s.khung_index) ?? 0) + 1)
  }
  const tatCaKhungDuSlot = [...dem.values()].every((n) => n === tmh.so_slot_moi_khung)
  console.log(`${tatCaKhungDuSlot ? 'PASS' : 'FAIL'} - moi khung_index (0..14) co dung ${tmh.so_slot_moi_khung} slot`)
  if (!tatCaKhungDuSlot) failCount += 1

  const tongOnline = slots.filter((s) => s.loai_slot === 'online').length
  const tongWalkin = slots.filter((s) => s.loai_slot === 'walk_in').length
  console.log(`INFO - tong slot online=${tongOnline}, walk_in=${tongWalkin}, tong=${slots.length}`)

  await mongoose.disconnect()

  console.log(failCount === 0 ? '\n=== TAT CA PASS ===' : `\n=== CO ${failCount} FAIL ===`)
  process.exit(failCount > 0 ? 1 : 0)
}

run().catch(async (error) => {
  console.error(error)
  try { await mongoose.disconnect() } catch {}
  process.exit(1)
})
