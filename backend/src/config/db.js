// ============================================================
// KẾT NỐI CƠ SỞ DỮ LIỆU
// ============================================================
import mongoose from 'mongoose'

export async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI
    if (!uri) throw new Error('Thiếu MONGODB_URI trong file .env')
    
    await mongoose.connect(uri)
    console.log('✅ Đã kết nối MongoDB Cloud (DATN_VITAFAMILY)')
  } catch (error) {
    console.error('❌ Lỗi kết nối MongoDB:', error.message)
    process.exit(1)
  }
}
