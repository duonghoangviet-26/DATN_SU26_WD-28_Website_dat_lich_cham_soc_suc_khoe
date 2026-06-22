/* eslint-env node */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const alias = { '@': path.resolve(__dirname, './src') }

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  server: {
    port: 5173,
  },
  test: {
    environment: 'node',
    globals: true,
    alias,
    setupFiles: [],
    // Isolate modules giữa các test file để reset module-level state
    isolate: true,
  },
})
