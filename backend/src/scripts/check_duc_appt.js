import 'dotenv/config'
import mongoose from 'mongoose'

async function checkDucAppointment() {
  await mongoose.connect(process.env.MONGODB_URI)
  const db = mongoose.connection.db

  const appt = await db.collection('lich_hen').findOne({ ma_lich_hen: 'LH-260902-0025' })
  console.log('Appointment LH-260902-0025:', JSON.stringify(appt, null, 2))

  if (appt) {
    const queue = await db.collection('hang_doi').findOne({ appointment_id: appt._id })
    console.log('Queue item for LH-260902-0025:', JSON.stringify(queue, null, 2))

    const examResult = await db.collection('ket_qua_kham').findOne({
      $or: [{ appointment_id: appt._id }, ...(queue ? [{ hang_doi_id: queue._id }] : [])]
    })
    console.log('Exam result for LH-260902-0025:', JSON.stringify(examResult, null, 2))
  }

  await mongoose.disconnect()
}

checkDucAppointment()
