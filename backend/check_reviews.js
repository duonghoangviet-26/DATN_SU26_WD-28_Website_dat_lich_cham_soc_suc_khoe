import 'dotenv/config'
import mongoose from 'mongoose'
import { BacSi, DanhGia, NguoiDung } from './src/models/index.js'

async function debug() {
  await mongoose.connect(process.env.MONGODB_URI)
  const users = await NguoiDung.find({ ho_ten: { $regex: /Lê Quốc Bảo/i } })
  if (users.length === 0) {
    console.log("Not found user")
    process.exit(0)
  }
  const doctor = await BacSi.findOne({ user_id: users[0]._id })
  console.log("Doctor ID:", doctor._id)

  const augReviews = await DanhGia.find({ 
    doctor_id: doctor._id,
    ngay_tao: { $gte: new Date('2026-08-01') } 
  })
  console.log("August reviews for this doctor:", augReviews.length)

  const allReviews = await DanhGia.find({ 
    doctor_id: doctor._id
  })
  console.log("All reviews for this doctor:", allReviews.length)

  process.exit(0)
}
debug()
