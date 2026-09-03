import 'dotenv/config'
import mongoose from 'mongoose'

async function checkPatientPayment() {
  await mongoose.connect(process.env.MONGODB_URI)
  const db = mongoose.connection.db

  const hangDoiEntries = await db.collection('hang_doi').find({}).toArray()
  console.log('=== BENH NHAN TRONG HANG DOI ===')
  
  for (const entry of hangDoiEntries) {
    console.log(`\nHàng đợi ID: ${entry._id}`)
    console.log(`- Tên bệnh nhân: ${entry.ten_benh_nhan}`)
    console.log(`- Trạng thái hàng đợi: ${entry.trang_thai}`)
    console.log(`- Nguồn: ${entry.nguon}, loại đối tượng: ${entry.loai_doi_tuong}`)
    console.log(`- Appointment ID: ${entry.appointment_id}`)

    if (entry.appointment_id) {
      const appt = await db.collection('lich_hen').findOne({ _id: entry.appointment_id })
      if (appt) {
        console.log(`  [Lịch Hẹn] Mã: ${appt.ma_lich_hen}`)
        console.log(`  [Lịch Hẹn] status: ${appt.status}`)
        console.log(`  [Lịch Hẹn] payment_status: ${appt.payment_status}`)
        console.log(`  [Lịch Hẹn] hinh_thuc_dat_lich: ${appt.hinh_thuc_dat_lich}`)
        console.log(`  [Lịch Hẹn] nguon: ${appt.nguon}`)
        console.log(`  [Lịch Hẹn] dat_ho: ${appt.dat_ho}`)

        const invoices = await db.collection('hoa_don').find({
          $or: [
            { appointment_id: appt._id },
            { hang_doi_id: entry._id },
            { ma_lich_hen: appt.ma_lich_hen }
          ]
        }).toArray()
        console.log(`  [Hóa Đơn liên quan]: ${invoices.length} hóa đơn`)
        for (const inv of invoices) {
          console.log(`    -> Mã HĐ: ${inv.ma_hoa_don}, trang_thai: ${inv.trang_thai}, tong_tien: ${inv.tong_tien}, da_thanh_toan: ${inv.da_thanh_toan}`)
        }
      } else {
        console.log(`  [Lịch Hẹn]: Không tìm thấy bản ghi LichHen cho appointment_id ${entry.appointment_id}`)
      }
    }
  }

  await mongoose.disconnect()
}

checkPatientPayment()
