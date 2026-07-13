import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../../src/config/db.js'
import DichVu from '../../src/models/DichVu.js'

async function main() {
  await connectDB()

  const backfillResult = await DichVu.updateMany(
    { la_goi: { $exists: false } },
    { $set: { la_goi: false } }
  )

  const sampleLegacy = await DichVu.findOne({}, { ten: 1, la_goi: 1, doi_tuong_ap_dung: 1 }).sort({ ngay_tao: 1 }).lean()

  const testName = `GOI-TEST-STEP4-${Date.now()}`
  const created = await DichVu.create({
    ten: testName,
    loai: 'related',
    gia: 123000,
    specialty_id: new mongoose.Types.ObjectId('0000000000000000000000c9'),
    la_goi: true,
    doi_tuong_ap_dung: 'gia_dinh',
  })

  const reloaded = await DichVu.findById(created._id)
    .select('ten la_goi doi_tuong_ap_dung loai specialty_id')
    .lean()

  await DichVu.deleteOne({ _id: created._id })

  console.log(JSON.stringify({
    backfill: {
      matchedCount: backfillResult.matchedCount,
      modifiedCount: backfillResult.modifiedCount,
    },
    legacySample: sampleLegacy,
    created: {
      _id: created._id,
      ten: created.ten,
      la_goi: created.la_goi,
      doi_tuong_ap_dung: created.doi_tuong_ap_dung,
    },
    reloaded,
  }, null, 2))

  await mongoose.disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
