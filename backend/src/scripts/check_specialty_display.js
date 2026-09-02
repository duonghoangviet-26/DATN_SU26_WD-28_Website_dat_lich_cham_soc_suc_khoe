import 'dotenv/config'
import mongoose from 'mongoose'

async function checkSpecialty() {
  await mongoose.connect(process.env.MONGODB_URI)
  const db = mongoose.connection.db

  const appts = await db.collection('lich_hen').find({
    ma_lich_hen: { $in: ['LH-260902-0025', 'LH-260902-0023', 'LH-260902-0003'] }
  }).toArray()

  for (const a of appts) {
    console.log(a.ma_lich_hen, 'specialty_id:', a.specialty_id, 'ten_dich_vu:', a.ten_dich_vu)
    if (a.specialty_id) {
      const spec = await db.collection('chuyen_khoa').findOne({ _id: a.specialty_id })
      console.log('  -> Specialty name:', spec?.ten)
    }
  }

  await mongoose.disconnect()
}

checkSpecialty()
