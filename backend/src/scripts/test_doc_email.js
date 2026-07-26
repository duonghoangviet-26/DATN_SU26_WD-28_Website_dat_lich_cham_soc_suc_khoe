import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { BacSi, NguoiDung } from '../models/index.js'

dotenv.config()

async function testDocName() {
  await mongoose.connect(process.env.MONGODB_URI)

  const doc = await BacSi.findOne().populate('user_id', 'ho_ten').populate('specialties', 'ten').lean()
  if (doc) {
    const rawName = doc.user_id?.ho_ten || doc.ho_ten
    const docName = rawName ? (/^BS\.?\s*/i.test(rawName) ? rawName : `BS. ${rawName}`) : 'Bác sĩ chuyên khoa'
    console.log('Fetched Doctor Name:', docName)
    console.log('Fetched Specialty Name:', doc.specialties?.[0]?.ten || 'Đa khoa')
  } else {
    console.log('No doctors in database to test.')
  }

  await mongoose.disconnect()
}

testDocName().catch(console.error)
