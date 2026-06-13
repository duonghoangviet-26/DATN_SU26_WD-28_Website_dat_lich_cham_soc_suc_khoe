import 'dotenv/config'
import app from './app.js'
import { connectDB } from './config/db.js'

// Điểm khởi chạy máy chủ.
const PORT = process.env.PORT || 5000

async function start() {
  await connectDB() // hiện chỉ in thông báo, chưa kết nối DB thật
  app.listen(PORT, () => {
    console.log(`✅ Máy chủ chạy tại http://localhost:${PORT}`)
  })
}

start()
