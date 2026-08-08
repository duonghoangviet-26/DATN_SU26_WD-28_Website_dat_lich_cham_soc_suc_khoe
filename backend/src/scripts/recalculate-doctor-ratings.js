import '../config/timezone.js'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { DanhGia, BacSi } from '../models/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

async function recalculateAllDoctorRatings() {
  console.log('⏳ Connecting to MongoDB...')
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✅ Connected.')

  const doctors = await BacSi.find({})
  console.log(`🔍 Found ${doctors.length} doctors. Recalculating ratings based on 'chi_tiet.danh_gia_bac_si'...`)

  for (const doc of doctors) {
    const result = await DanhGia.aggregate([
      {
        $match: {
          doctor_id: doc._id,
          status: 'visible',
          ngay_xoa: null,
        },
      },
      {
        $group: {
          _id: '$doctor_id',
          avg: { $avg: { $ifNull: ['$chi_tiet.danh_gia_bac_si', '$so_sao'] } },
          total: { $sum: 1 },
        },
      },
    ])

    if (result.length > 0) {
      const avg = Math.round(result[0].avg * 10) / 10
      await BacSi.updateOne(
        { _id: doc._id },
        { $set: { diem_danh_gia: avg, tong_danh_gia: result[0].total } }
      )
      console.log(`✅ Updated Doctor ${doc._id} -> Rating: ${avg}⭐ (${result[0].total} reviews)`)
    }
  }

  await mongoose.disconnect()
  console.log('🎉 Done recalculating all doctor ratings.')
}

recalculateAllDoctorRatings().catch((err) => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
