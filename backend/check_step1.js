import 'dotenv/config'
import mongoose from 'mongoose'
import { validateFollowUpBooking } from './src/services/followupValidation.service.js'
import { LichHen, KetQuaKham, NguoiDung } from './src/models/index.js'

async function runTest() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to DB')

  try {
    // 1. Tao mock data neu can (LichHen, KetQuaKham, BacSi...)
    // Hoac tim mot lich hen co san de test
    const ketQuaList = await KetQuaKham.find({ chi_dinh_tai_kham: true }).limit(5).lean()
    if (ketQuaList.length > 0) {
      console.log('Found some KetQuaKham with chi_dinh_tai_kham = true:', ketQuaList.map(k => k.appointment_id))
    } else {
      console.log('No KetQuaKham with chi_dinh_tai_kham = true found. Please create one manually or test with real data.')
    }

    // Call validateFollowUpBooking logic
    try {
        console.log('Test 1.A: Truyền lich_hen_goc_id sai')
        await validateFollowUpBooking({
            lich_hen_goc_id: 'invalid-id',
            userId: 'some-user',
            ngay_kham: new Date(),
            specialty_id: 'some-spec',
            session: null
        })
    } catch(err) {
        console.log('Pass 1.A.1:', err.message)
    }

    try {
        console.log('Test 1.A: Truyền lich_hen_goc_id ngau nhien (khong ton tai)')
        await validateFollowUpBooking({
            lich_hen_goc_id: new mongoose.Types.ObjectId().toString(),
            userId: 'some-user',
            ngay_kham: new Date(),
            specialty_id: 'some-spec',
            session: null
        })
    } catch(err) {
        console.log('Pass 1.A.2:', err.message)
    }

    console.log('Done tests')
  } catch (err) {
    console.error('Error during test:', err)
  }

  process.exit(0)
}

runTest()
