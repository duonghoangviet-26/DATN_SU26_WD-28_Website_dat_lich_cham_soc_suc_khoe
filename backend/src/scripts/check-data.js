import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { BacSi, NguoiDung } from '../models/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

const uri = process.env.MONGODB_URI
if (!uri) {
  console.error('No MONGODB_URI found!')
  process.exit(1)
}

async function run() {
  await mongoose.connect(uri)
  console.log('Connected to DB')
  
  const doctorsCount = await BacSi.countDocuments()
  const usersCount = await NguoiDung.countDocuments()
  console.log(`BacSi count: ${doctorsCount}`)
  console.log(`NguoiDung count: ${usersCount}`)
  
  const docs = await BacSi.find().populate('user_id').lean()
  console.log('Doctors data (first 5):')
  docs.slice(0, 5).forEach((d, index) => {
    console.log(`[${index}] id: ${d._id}, user_id populated: ${d.user_id ? 'YES' : 'NO'}`)
    if (d.user_id) {
      console.log(`    user: id=${d.user_id._id}, name=${d.user_id.ho_ten}, email=${d.user_id.email}, role=${d.user_id.role}`)
    } else {
      console.log(`    user_id raw: ${d.user_id}`)
    }
  })
  
  await mongoose.disconnect()
}

run()
