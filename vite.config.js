import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 純前端 SPA，資料保存在瀏覽器 localStorage，無需後端
export default defineConfig({
  plugins: [
    react(),
    // 離線支援：訪談現場沒網路也能開（app shell 全部預快取）
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // 沿用 public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024, // antd/reactflow chunk 較大
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  base: './',
  build: {
    outDir: 'dist',
  },
})
