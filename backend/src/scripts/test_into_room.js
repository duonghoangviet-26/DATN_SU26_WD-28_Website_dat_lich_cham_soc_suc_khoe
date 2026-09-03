import 'dotenv/config'
import mongoose from 'mongoose'
import { intoRoom } from '../controllers/doctor/queue.controller.js'

async function testIntoRoom() {
  await mongoose.connect(process.env.MONGODB_URI)
  const db = mongoose.connection.db

  const hangDoiAll = await db.collection('hang_doi').find({ trang_thai: { $in: ['dang_cho', 'da_goi'] } }).toArray()
  console.log('Hàng đợi active hiện tại:', hangDoiAll.map(h => ({ id: h._id, name: h.ten_benh_nhan, docId: h.doctor_id, checkin: h.checkin_time })))

  if (hangDoiAll.length > 0) {
    const docRecord = await db.collection('ho_so_bac_si').findOne({ _id: hangDoiAll[0].doctor_id })
    const docUser = await db.collection('nguoi_dung').findOne({ _id: docRecord.user_id })
    console.log('Bác sĩ:', docUser.ho_ten, 'User ID:', docUser._id)

    const docQueue = await db.collection('hang_doi').find({ doctor_id: docRecord._id, trang_thai: { $in: ['dang_cho', 'da_goi'] } }).toArray()

    if (docQueue.length > 1) {
      const targetEntry = docQueue[1]
      console.log(`\n--- Gọi thử vào phòng bệnh nhân xếp thứ 2: ${targetEntry.ten_benh_nhan} (ID: ${targetEntry._id}) ---`)

      const req = {
        user: { id: docUser._id, role: 'doctor' },
        params: { id: String(targetEntry._id) },
        body: {}
      }
      const res = {
        status: (code) => { console.log('HTTP Status:', code); return res; },
        json: (data) => { console.log('JSON Data:', JSON.stringify(data, null, 2)); return res; }
      }

      await intoRoom(req, res)
    }
  }

  await mongoose.disconnect()
}

testIntoRoom()
