import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { BacSi } from '../models/index.js'

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
  const doctors = await BacSi.find().populate('user_id', 'ho_ten email').lean()
  console.log('Doctors from DB:', JSON.stringify(doctors, null, 2))
  await mongoose.disconnect()
}

run()
