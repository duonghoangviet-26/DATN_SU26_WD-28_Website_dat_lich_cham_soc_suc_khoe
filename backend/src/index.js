import './config/timezone.js' // PHẢI đứng đầu tiên — ép TZ=UTC trước mọi Date (GAP-8)
import 'dotenv/config'
import mongoose from 'mongoose'

import app from './app.js'
import { connectDB } from './config/db.js'
import { startCronJobs } from './cron/index.js'

const PORT = Number(process.env.PORT || 5000)

let server = null
let cronManager = null
let shuttingDown = false

async function closeServer() {
  if (!server) return

  await new Promise((resolve) => {
    server.close(() => resolve())
  })
  server = null
}

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true

  try {
    cronManager?.stop?.()
  } catch {}

  try {
    await closeServer()
  } catch (error) {
    console.error(`[shutdown] Lỗi đóng HTTP server: ${error.message}`)
  }

  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }
  } catch (error) {
    console.error(`[shutdown] Lỗi ngắt MongoDB: ${error.message}`)
  }

  if (signal === 'SIGUSR2') {
    process.kill(process.pid, 'SIGUSR2')
    return
  }

  process.exit(exitCode)
}

async function start() {
  try {
    await connectDB()
    cronManager = startCronJobs()

    server = app.listen(PORT, () => {
      console.log(`✅ Máy chủ chạy tại http://localhost:${PORT}`)
    })

    server.on('error', async (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Cổng ${PORT} đang được tiến trình khác sử dụng. Hãy tắt tiến trình cũ hoặc đổi PORT.`)
      } else {
        console.error('❌ Lỗi HTTP server:', error.message)
      }

      await shutdown('SERVER_ERROR', 1)
    })
  } catch (error) {
    console.error('❌ Khởi động backend thất bại:', error.message)
    await shutdown('STARTUP_ERROR', 1)
  }
}

process.once('SIGINT', () => {
  shutdown('SIGINT', 0)
})

process.once('SIGTERM', () => {
  shutdown('SIGTERM', 0)
})

process.once('SIGUSR2', () => {
  shutdown('SIGUSR2', 0)
})

start()
