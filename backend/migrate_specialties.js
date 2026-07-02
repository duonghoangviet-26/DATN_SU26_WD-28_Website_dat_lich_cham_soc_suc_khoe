import mongoose from 'mongoose'
import dotenv from 'dotenv'
import ThongTinPhongKham from './src/models/ThongTinPhongKham.js'
import ChuyenKhoa from './src/models/ChuyenKhoa.js'

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

async function migrate() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB')

    // Lấy hoặc tạo phòng khám 1
    let clinic1 = await ThongTinPhongKham.findOne({ ten: 'VitaFamily Clinic' })
    if (!clinic1) {
      clinic1 = await ThongTinPhongKham.create({
        ten: 'VitaFamily Clinic',
        dia_chi: '123 Đường ABC, Quận XYZ, TP.HCM',
        so_dien_thoai: '0901234567',
        trang_thai: 'active'
      })
      console.log('Tạo mới phòng khám 1:', clinic1.ten)
    }

    // Lấy hoặc tạo phòng khám 2
    let clinic2 = await ThongTinPhongKham.findOne({ ten: 'Phòng khám Test' })
    if (!clinic2) {
      clinic2 = await ThongTinPhongKham.create({
        ten: 'Phòng khám Test',
        dia_chi: 'Hà Nội',
        so_dien_thoai: '0123456789',
        trang_thai: 'active'
      })
      console.log('Tạo mới phòng khám 2:', clinic2.ten)
    }

    // Lấy tất cả chuyên khoa hiện tại
    const specialties = await ChuyenKhoa.find()
    console.log(`Tìm thấy ${specialties.length} chuyên khoa`)

    let updateCount = 0
    for (const spec of specialties) {
      if (!spec.phong_kham_id) {
        spec.phong_kham_id = clinic1._id
        await spec.save()
        updateCount++
      }
    }

    console.log(`Đã cập nhật phong_kham_id cho ${updateCount} chuyên khoa vào phòng khám 1`)

  } catch (err) {
    console.error('Migration failed:', err)
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  }
}

migrate()
