import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../../src/config/db.js'
import ChuyenKhoa from '../../src/models/ChuyenKhoa.js'

async function main() {
  await connectDB()

  const ent = await ChuyenKhoa.findOne({ slug: 'tai-mui-hong', status: 'active' })
    .select('_id ten slug')
    .lean()

  if (!ent) {
    throw new Error('Khong tim thay chuyen khoa Tai Mui Hong active')
  }

  console.log(JSON.stringify({
    skipped: true,
    reason: 'Khong seed goi dich vu legacy. He thong hien chi giu dich vu Tai Mui Hong da co trong DB.',
    specialty: { id: String(ent._id), ten: ent.ten, slug: ent.slug },
  }, null, 2))

  await mongoose.disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
