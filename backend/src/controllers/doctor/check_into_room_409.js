import 'dotenv/config'
import mongoose from 'mongoose'

async function checkWhy409() {
  await mongoose.connect(process.env.MONGODB_URI)

  const { HangDoi } = await import('../../models/index.js')
  const { bacSiDangTrongCaLamViec, lyDoChuaDuocPhucVu } = await import('./queue.controller.js')
  const { resolveAndSyncAppointmentPaymentState } = await import('../../services/bookingPaymentState.service.js')

  const queueItems = await HangDoi.find({}).sort({ ngay_tao: -1 }).limit(5).lean()
  console.log('5 recent queue items:')
  for (const q of queueItems) {
    console.log(`- ID: ${q._id} | Name: ${q.ten_benh_nhan} | DoctorID: ${q.doctor_id} | Status: ${q.trang_thai}`)
  }

  const entry = queueItems[0]
  if (entry) {
    console.log('\n--- Checking first item:', entry.ten_benh_nhan, '---')
    const now = new Date()
    console.log('Current time (now):', now.toISOString())

    const inShift = await bacSiDangTrongCaLamViec(entry.doctor_id, now)
    console.log('1. bacSiDangTrongCaLamViec:', inShift)

    const lyDoChan = await lyDoChuaDuocPhucVu(entry, entry.doctor_id, now)
    console.log('2. lyDoChuaDuocPhucVu:', lyDoChan)

    if (entry.appointment_id) {
      const paymentState = await resolveAndSyncAppointmentPaymentState(entry.appointment_id)
      console.log('3. paymentState:', {
        payment_status: paymentState?.payment_status,
        appointment_id: paymentState?.appointment?._id
      })
    }
  }

  await mongoose.disconnect()
}

checkWhy409()
