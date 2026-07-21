import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Chạy tự động trước "npm run dev" (predev) — dọn tiến trình node cũ còn kẹt trên PORT do
// nodemon/terminal cũ chưa tắt sạch (nguyên nhân phổ biến của lỗi EADDRINUSE trên Windows khi
// mở nhiều terminal cùng chạy backend, hoặc nodemon restart không kill hết child process).
// CHỈ kill đúng PID đang LISTEN trên PORT này — không đụng tiến trình khác.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })
const PORT = Number(process.env.PORT || 5000)

function freeWindows(port) {
  let out
  try {
    out = execSync(`netstat -ano -p tcp`, { encoding: 'utf8' })
  } catch {
    return
  }
  const pids = new Set()
  for (const line of out.split('\n')) {
    const m = line.match(/^\s*TCP\s+\S*:(\d+)\s+\S+\s+LISTENING\s+(\d+)/)
    if (m && Number(m[1]) === port) pids.add(m[2])
  }
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
      console.log(`[free-dev-port] Da tat tien trinh cu PID ${pid} dang giu cong ${port}`)
    } catch {
      // Tiến trình có thể đã tự thoát giữa lúc dò và lúc kill — bỏ qua.
    }
  }
}

function freeUnix(port) {
  let out
  try {
    out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' })
  } catch {
    return
  }
  for (const pid of out.split('\n').map((s) => s.trim()).filter(Boolean)) {
    try {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' })
      console.log(`[free-dev-port] Da tat tien trinh cu PID ${pid} dang giu cong ${port}`)
    } catch {
      // đã tự thoát — bỏ qua.
    }
  }
}

if (process.platform === 'win32') freeWindows(PORT)
else freeUnix(PORT)
