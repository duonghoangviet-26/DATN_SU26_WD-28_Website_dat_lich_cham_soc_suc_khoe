import 'dotenv/config'
import mongoose from 'mongoose'

async function checkStatusSync() {
  await mongoose.connect(process.env.MONGODB_URI)
  const db = mongoose.connection.db

  const appt = await db.collection('lich_hen').findOne({ _id: new mongoose.Types.ObjectId('6a97d8a8fded766e0f1c6c03') })
  console.log('LichHen:', {
    _id: appt?._id,
    ma_lich_hen: appt?.ma_lich_hen,
    status: appt?.status,
    ten_khach: appt?.ten_khach,
    payment_status: appt?.payment_status
  })

  if (appt) {
    const queue = await db.collection('hang_doi').findOne({ appointment_id: appt._id })
    console.log('HangDoi:', {
      _id: queue?._id,
      trang_thai: queue?.trang_thai,
      ten_benh_nhan: queue?.ten_benh_nhan,
      doctor_id: queue?.doctor_id,
      phong_kham: queue?.phong_kham
    })
  }

  await mongoose.disconnect()
}

checkStatusSync()
