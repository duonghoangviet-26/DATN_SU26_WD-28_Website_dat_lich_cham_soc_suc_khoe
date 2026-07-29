// ============================================================
// KẾT NỐI CƠ SỞ DỮ LIỆU
// ============================================================
import mongoose from 'mongoose'

export async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI
    if (!uri) throw new Error('Thiếu MONGODB_URI trong file .env')
    
    await mongoose.connect(uri)
    // In tên DB THẬT đang kết nối, không hardcode: trước đây log luôn ghi "DATN_VITAFAMILY"
    // kể cả khi chạy trên DB test, khiến không thể biết mình đang ghi vào đâu.
    console.log(`✅ Đã kết nối MongoDB Cloud (${mongoose.connection.db.databaseName})`)
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error.message)
    process.exit(1)
  }
}
