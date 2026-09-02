import 'dotenv/config'
import mongoose from 'mongoose'

async function checkBaoSchedule() {
  await mongoose.connect(process.env.MONGODB_URI)
  const db = mongoose.connection.db

  const docUser = await db.collection('nguoi_dung').findOne({ ho_ten: /Lê Quốc Bảo/i })
  const doc = await db.collection('bac_si').findOne({ user_id: docUser._id })

  console.log('Doctor ID for BS. Lê Quốc Bảo:', doc._id)

  const start = new Date('2026-09-02T00:00:00.000Z')
  const end = new Date('2026-09-03T00:00:00.000Z')

  const schedules = await db.collection('lich_lam_viec').find({
    doctor_id: doc._id,
    ngay: { $gte: start, $lt: end }
  }).toArray()

  console.log('Schedules count:', schedules.length)
  for (const s of schedules) {
    console.log('Schedule:', {
      _id: s._id,
      ngay: s.ngay,
      trang_thai_ngay: s.trang_thai_ngay,
      trang_thai_xac_nhan: s.trang_thai_xac_nhan,
      slots: s.slots?.map(sl => ({
        gio_bat_dau: sl.gio_bat_dau,
        gio_ket_thuc: sl.gio_ket_thuc,
        phong_kham: sl.phong_kham
      }))
    })
  }

  const { bacSiDangTrongCaLamViec } = await import('../services/doctorAvailability.service.js')
  const now = new Date()
  const isWorking = await bacSiDangTrongCaLamViec(doc._id, now)
  console.log('bacSiDangTrongCaLamViec(now):', isWorking, 'at current time:', now.toLocaleTimeString('vi-VN'))

  await mongoose.disconnect()
}

checkBaoSchedule()
