import 'dotenv/config'
import mongoose from 'mongoose'

async function check() {
  await mongoose.connect(process.env.MONGODB_URI)
  const db = mongoose.connection.db

  const payments = await db.collection('thanh_toan').find({ ma_giao_dich: { $in: ['TXN1287', 'TXN1288'] } }).toArray()
  const invoices = await db.collection('hoa_don').find({ ma_hoa_don: { $in: ['HD-260901-0011', 'HD-260901-0012'] } }).toArray()

  console.log('Payments:', JSON.stringify(payments, null, 2))
  console.log('Invoices:', JSON.stringify(invoices, null, 2))

  await mongoose.disconnect()
}

check()
