import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectDB } from '../config/db.js'
import DichVu from '../models/DichVu.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

async function run() {
  await connectDB()

  await DichVu.updateOne({ ten: 'Tai Mũi Họng ca nhan co ban' }, { $set: { ten: 'Tai Mũi Họng cá nhân cơ bản' } })
  await DichVu.updateOne({ ten: 'Tai Mũi Họng gia dinh 4 thanh vien' }, { $set: { ten: 'Tai Mũi Họng gia đình 4 thành viên' } })

  console.log('✅ Cập nhật tên dịch vụ bổ sung thành công')
  process.exit(0)
}

run()
