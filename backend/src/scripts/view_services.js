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
  
  const services = await DichVu.find({}, 'ten status ma_dich_vu loai')
  console.log(services)

  process.exit(0)
}

run()
