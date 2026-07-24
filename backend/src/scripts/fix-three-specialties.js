import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

import { ChuyenKhoa } from '../models/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '../../.env') })

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing MONGODB_URI')
  }

  await mongoose.connect(process.env.MONGODB_URI)

  const ent = await ChuyenKhoa.findOne({ slug: 'tai-mui-hong', status: 'active' })
    .select('_id ten slug status')
    .lean()

  if (!ent) {
    throw new Error('Khong tim thay chuyen khoa Tai Mui Hong active')
  }

  console.log(JSON.stringify({
    skipped: true,
    reason: 'Script legacy fix-three-specialties da bi vo hieu hoa vi he thong hien chi giu Tai Mui Hong.',
    specialty: { id: String(ent._id), ten: ent.ten, slug: ent.slug, status: ent.status },
  }, null, 2))

  await mongoose.disconnect()
}

run().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
