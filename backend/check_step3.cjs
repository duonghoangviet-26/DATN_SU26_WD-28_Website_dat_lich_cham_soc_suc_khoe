require('dotenv').config()
const mongoose = require('mongoose')
const { HoSoBenhNhan } = require('./src/models/index.js')
const { tiepNhanOfflineVaoHangDoiTrungTam } = require('./src/services/centralOfflineQueue.service.js')

async function run() {
  await mongoose.connect(process.env.MONGODB_URI)
  
  const hoSo = await HoSoBenhNhan.findOne({ trang_thai: 'active', so_dien_thoai: { $ne: null } })
  console.log('Testing with HoSo:', hoSo.ho_ten)
  
  const { entry } = await tiepNhanOfflineVaoHangDoiTrungTam({
    hoSoBenhNhanId: hoSo._id,
    specialtyId: '66a1a1f1b626e27cb1ba0db8', // Nhi
    actorRole: 'receptionist',
  })
  
  console.log('Created Queue Entry:', entry._id, entry.appointment_id)
  
  const appt = await mongoose.model('LichHen').findById(entry.appointment_id)
  console.log('Created LichHen:', appt?.ma_lich_hen, appt?.hinh_thuc_dat_lich, appt?.loai_kham)
  
  process.exit(0)
}
run().catch(console.error)
