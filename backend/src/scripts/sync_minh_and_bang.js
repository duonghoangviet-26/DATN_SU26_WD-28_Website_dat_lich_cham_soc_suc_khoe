import 'dotenv/config'
import mongoose from 'mongoose'

async function syncMinhAndBang() {
  await mongoose.connect(process.env.MONGODB_URI)
  const db = mongoose.connection.db

  const paidInvoices = await db.collection('hoa_don').find({ trang_thai_hoa_don: 'da_thanh_toan_du' }).toArray()
  console.log(`Found ${paidInvoices.length} paid invoices`)

  let updatedCount = 0
  for (const inv of paidInvoices) {
    let apptId = inv.appointment_id
    if (!apptId && inv.hang_doi_id) {
      const queue = await db.collection('hang_doi').findOne({ _id: inv.hang_doi_id })
      apptId = queue?.appointment_id
    }

    if (apptId) {
      const res = await db.collection('lich_hen').updateOne(
        { _id: apptId, payment_status: { $ne: 'paid' } },
        { $set: { payment_status: 'paid', thoi_diem_thanh_toan: inv.ngay_cap_nhat || new Date() } }
      )
      if (res.modifiedCount > 0) {
        console.log(`Updated LichHen ${apptId} payment_status -> paid (Invoice: ${inv.so_hoa_don})`)
        updatedCount++
      }
    }
  }

  console.log(`Updated ${updatedCount} LichHen records to 'paid'!`)
  await mongoose.disconnect()
}

syncMinhAndBang()
