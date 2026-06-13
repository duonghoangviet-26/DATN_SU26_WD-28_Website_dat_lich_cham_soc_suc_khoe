/* eslint-env node */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Cấu hình Vite — alias '@' trỏ về thư mục src/ để import gọn (import x from '@/services/...')
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Proxy: sau này khi có backend thật, mọi request /api sẽ được chuyển sang BE
    // Bỏ comment khi backend đã chạy ở cổng 5000
    // proxy: {
    //   '/api': 'http://localhost:5000',
    // },
  },
})
