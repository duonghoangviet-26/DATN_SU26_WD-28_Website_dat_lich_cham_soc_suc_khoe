// ============================================================
// KẾT NỐI CƠ SỞ DỮ LIỆU
// ============================================================
// GIAI ĐOẠN HIỆN TẠI: chưa kết nối DB (nhóm đang làm giao diện với dữ liệu fix cứng).
// Khi sẵn sàng dùng MongoDB:
//   1. npm install mongoose
//   2. Bỏ comment phần dưới + điền MONGODB_URI trong file .env
//   3. Gọi connectDB() trong src/index.js
// ============================================================

// import mongoose from 'mongoose'

export async function connectDB() {
  // const uri = process.env.MONGODB_URI
  // if (!uri) throw new Error('Thiếu MONGODB_URI trong file .env')
  // await mongoose.connect(uri)
  // console.log('✅ Đã kết nối MongoDB')

  console.log('ℹ️  Chưa kết nối database — đang chạy ở chế độ khung (skeleton).')
}
