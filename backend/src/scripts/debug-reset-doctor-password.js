import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { connectDB } from '../config/db.js'
import { NguoiDung } from '../models/index.js'

await connectDB()

const email = 'doctor.bao@vitafamily.vn'
const user = await NguoiDung.findOne({ email })
if (!user) {
  console.log('Khong tim thay user', email)
  process.exit(1)
}
user.mat_khau = await bcrypt.hash('123456', 10)
await user.save()
console.log('Da reset mat khau ve 123456 cho', email)
process.exit(0)
