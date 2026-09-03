import 'dotenv/config'
import mongoose from 'mongoose'
import { tinhBacUuTienDong, THU_TU_UU_TIEN } from '../models/HangDoi.js'

async function checkTwoPatients() {
  await mongoose.connect(process.env.MONGODB_URI)
  const db = mongoose.connection.db

  const p1 = await db.collection('hang_doi').findOne({ _id: new mongoose.Types.ObjectId('6a993ac5e1bacea5d64fc8d1') })
  const p2 = await db.collection('hang_doi').findOne({ _id: new mongoose.Types.ObjectId('6a9947c825d7fa7e9c76715c') })

  console.log('=== BENH NHAN 1 (Lương Trần) ===')
  console.log('checkin_time:', p1.checkin_time)
  console.log('gio_hen_goc:', p1.gio_hen_goc)
  console.log('nguon:', p1.nguon)
  console.log('trang_thai:', p1.trang_thai)

  console.log('\n=== BENH NHAN 2 (Lường Đình Nam) ===')
  console.log('checkin_time:', p2.checkin_time)
  console.log('gio_hen_goc:', p2.gio_hen_goc)
  console.log('nguon:', p2.nguon)
  console.log('trang_thai:', p2.trang_thai)

  const now = new Date()
  const bac1 = tinhBacUuTienDong(p1, now)
  const bac2 = tinhBacUuTienDong(p2, now)

  console.log('\nBậc ưu tiên Lương Trần:', bac1, '-> Code:', THU_TU_UU_TIEN[bac1])
  console.log('Bậc ưu tiên Lường Đình Nam:', bac2, '-> Code:', THU_TU_UU_TIEN[bac2])

  await mongoose.disconnect()
}

checkTwoPatients()
