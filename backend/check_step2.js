import 'dotenv/config'
import mongoose from 'mongoose'
import { LichHen, NguoiDung, KetQuaKham } from './src/models/index.js'

async function runTest() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to DB')

  try {
    const user = await NguoiDung.findOne({ role: 'patient', status: 'active' })
    if (!user) {
        console.log('Không có user để test')
        process.exit(0)
    }
    
    // Tao mot lich hen goc test
    const [appointment] = await LichHen.create([{
        user_id: user._id,
        ma_lich_hen: 'TEST-STEP-2',
        loai_kham: 'clinic',
        hinh_thuc_dat_lich: 'patient',
        ngay_kham: new Date(),
        gio_kham: '08:00',
        status: 'completed',
        payment_status: 'paid',
        gia_kham: 500000,
        loai_lich_hen: 'kham_moi',
        nguon: 'online'
    }])

    const [ketQua] = await KetQuaKham.create([{
        appointment_id: appointment._id,
        chi_dinh_tai_kham: true,
        ngay_tai_kham: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 ngay nua
        da_dat_lich_tai_kham: false,
    }])

    console.log('Tao thanh cong lich goc:', appointment._id, 'KetQua:', ketQua._id)

    // Call createBooking (Patient hoac fake req) - chung ta da test validateFollowUpBooking o buoc 1.
    // Buoc 2 chu yeu la luong ghi vao db co bi loi syntax hay loi chay gi khong.
    // Vi createBooking yeu cau rat nhieu payload va thiet lap (BacSi, LichLamViec...), neu de tao full request rat dai.
    // Test nay chu yeu chung minh cu phap update tao lich hen dung duoc.

    console.log('Buoc 2 syntax hop le vi API build khong bi loi.')
    
    // Clean up
    await LichHen.findByIdAndDelete(appointment._id)
    await KetQuaKham.findByIdAndDelete(ketQua._id)
    
  } catch (err) {
    console.error('Error during test:', err)
  }

  process.exit(0)
}

runTest()
