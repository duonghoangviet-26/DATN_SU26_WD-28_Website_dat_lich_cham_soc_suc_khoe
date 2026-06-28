import mongoose from 'mongoose'
import dotenv from 'dotenv'

// Lấy config .env
dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/DATN_VITAFAMILY'

async function run() {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('Connected!')

    const db = mongoose.connection.db
    const collection = db.collection('chuyen_khoa')

    // Lấy danh sách các index hiện có
    const indexes = await collection.indexes()
    console.log('Các index hiện tại:', indexes.map(i => i.name))

    // Kiểm tra xem có slug_1 không
    const hasSlugIndex = indexes.some(i => i.name === 'slug_1')
    if (hasSlugIndex) {
      console.log('Đang xóa index slug_1...')
      await collection.dropIndex('slug_1')
      console.log('Đã xóa thành công index cũ!')
    } else {
      console.log('Không tìm thấy index slug_1, có thể đã được xóa.')
    }

    const clinicCollection = db.collection('thong_tin_phong_kham')
    const clinicIndexes = await clinicCollection.indexes()
    console.log('Các index clinic hiện tại:', clinicIndexes.map(i => i.name))
    if (clinicIndexes.some(i => i.name === 'ma_1')) {
      console.log('Đang xóa index ma_1 của thong_tin_phong_kham...')
      await clinicCollection.dropIndex('ma_1')
      console.log('Đã xóa thành công index ma_1!')
    }

  } catch (error) {
    console.error('Lỗi:', error)
  } finally {
    await mongoose.disconnect()
    console.log('Đã đóng kết nối db.')
  }
}

run()
