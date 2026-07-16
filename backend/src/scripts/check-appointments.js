import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import LichHen from '../models/LichHen.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../../.env') })

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('No MONGODB_URI found')
    process.exit(1)
  }

  await mongoose.connect(uri)
  console.log('Connected to MongoDB')

  const appointments = await LichHen.find({}).sort({ ngay_tao: -1 }).limit(10).lean()
  console.log('--- Last 10 appointments ---')
  appointments.forEach((a) => {
    console.log(`ID: ${a._id} | Code: ${a.ma_lich_hen} | Status: ${a.status} | Payment: ${a.payment_status} | Date: ${a.ngay_kham?.toISOString().slice(0,10)} | User: ${a.user_id}`)
  })

  await mongoose.disconnect()
}

run().catch(console.error)
