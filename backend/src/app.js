import express from 'express'
import cors from 'cors'
import apiRoutes from './routes/index.js'
import { fail } from './utils/response.js'

// Khởi tạo và cấu hình ứng dụng Express (tách khỏi việc lắng nghe cổng ở index.js).
const app = express()

// ----- Middleware nền tảng -----
app.use(cors()) // Cho phép tất cả trong môi trường Dev để tránh lỗi đổi port
app.use(express.json()) // đọc JSON từ body request

// ----- Route kiểm tra sống -----
app.get('/', (req, res) => {
  res.json({ success: true, message: 'VitaFamily API đang chạy 🚀' })
})

// ----- Toàn bộ API gắn dưới /api -----
app.use('/api', apiRoutes)

// ----- Xử lý route không tồn tại -----
app.use((req, res) => {
  fail(res, 404, `Không tìm thấy đường dẫn: ${req.originalUrl}`)
})

// ----- Xử lý lỗi tập trung -----
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('❌ Lỗi:', err.message)
  fail(res, 500, 'Lỗi máy chủ, vui lòng thử lại sau')
})

export default app
