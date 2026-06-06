import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 純前端 SPA，資料保存在瀏覽器 localStorage，無需後端
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
  },
})
