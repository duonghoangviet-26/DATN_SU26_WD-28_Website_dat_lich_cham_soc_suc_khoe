import 'dotenv/config'
import mongoose from 'mongoose'

async function fixRecords() {
  await mongoose.connect(process.env.MONGODB_URI)
  const db = mongoose.connection.db

  const appts = await db.collection('lich_hen').find({
    ma_lich_hen: { $in: ['LH-260902-0025', 'LH-260902-0023'] }
  }).toArray()

  for (const a of appts) {
    const queue = await db.collection('hang_doi').findOne({ appointment_id: a._id })
    if (queue) {
      const checkinTime = new Date(queue.checkin_time || a.ngay_kham)
      const vnTime = new Date(checkinTime.getTime() + 7 * 60 * 60 * 1000)
      const correctGioKham = `${String(vnTime.getUTCHours()).padStart(2, '0')}:${String(vnTime.getUTCMinutes()).padStart(2, '0')}`

      await db.collection('lich_hen').updateOne(
        { _id: a._id },
        { $set: { gio_kham: correctGioKham, phong_kham: queue.phong_kham || 'Phòng 103, Tầng 1, Tòa ViteFamily' } }
      )
      console.log('Fixed appointment', a.ma_lich_hen, '-> gio_kham:', correctGioKham, 'phong_kham:', queue.phong_kham)
    }
  }

  await mongoose.disconnect()
}

fixRecords()
