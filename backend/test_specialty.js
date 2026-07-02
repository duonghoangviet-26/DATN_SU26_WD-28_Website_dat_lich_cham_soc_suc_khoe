import mongoose from 'mongoose'
import dotenv from 'dotenv'
import ThongTinPhongKham from './src/models/ThongTinPhongKham.js'
import ChuyenKhoa from './src/models/ChuyenKhoa.js'
import { copySpecialty } from './src/controllers/clinic-info.controller.js'

dotenv.config()

async function testFlow() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/DATN_VITAFAMILY')
    console.log('--- BẮT ĐẦU TEST LUỒNG CHUYÊN KHOA ---')

    // 1. Tạo 2 phòng khám test
    const clinicA = await ThongTinPhongKham.create({ ten: 'Test Clinic A', ma: 'TEST-A', trang_thai: 'active' })
    const clinicB = await ThongTinPhongKham.create({ ten: 'Test Clinic B', ma: 'TEST-B', trang_thai: 'active' })
    console.log('✅ Đã tạo 2 phòng khám test (A và B)')

    // 2. Tạo chuyên khoa cho phòng khám A
    const specA = await ChuyenKhoa.create({
      phong_kham_id: clinicA._id,
      ten: 'Khoa Test Copy',
      mo_ta: 'Mo ta test',
      thu_tu: 1
    })
    console.log('✅ Đã tạo chuyên khoa mới cho Clinic A. Slug sinh ra:', specA.slug)

    // 3. Test hàm copySpecialty (mô phỏng req, res)
    const req = {
      params: { specialtyId: specA._id },
      body: { targetClinicIds: [clinicB._id.toString()] }
    }
    
    let responseData = null
    const res = {
      status: (code) => ({
        json: (data) => { responseData = { code, data } }
      })
    }

    await copySpecialty(req, res)

    if (responseData.code === 200) {
      console.log('✅ API Copy trả về thành công:', responseData.data.message)
    } else {
      console.error('❌ API Copy thất bại:', responseData)
    }

    // 4. Kiểm tra lại DB xem Clinic B có chuyên khoa này chưa
    const specB = await ChuyenKhoa.findOne({ phong_kham_id: clinicB._id, slug: specA.slug })
    if (specB) {
      console.log('✅ Clinic B đã nhận được bản sao chuyên khoa:', specB.ten)
      if (specB._id.toString() !== specA._id.toString()) {
        console.log('✅ ID của 2 bản ghi khác nhau -> Đã nhân bản thành công!')
      }
    } else {
      console.error('❌ Không tìm thấy bản sao trong Clinic B!')
    }

    // 5. Thử copy lại lần 2 để test check trùng lặp
    await copySpecialty(req, res)
    console.log('✅ Thử copy lần 2:', responseData.data.message)

    // Dọn dẹp
    await ChuyenKhoa.deleteMany({ _id: { $in: [specA._id, specB?._id].filter(Boolean) } })
    await ThongTinPhongKham.deleteMany({ _id: { $in: [clinicA._id, clinicB._id] } })
    console.log('✅ Đã dọn dẹp dữ liệu test')

  } catch (error) {
    console.error('❌ Lỗi Test:', error)
  } finally {
    await mongoose.disconnect()
    console.log('--- KẾT THÚC TEST ---')
  }
}

testFlow()
