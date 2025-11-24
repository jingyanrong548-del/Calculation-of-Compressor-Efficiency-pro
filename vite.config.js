import { defineConfig } from 'vite'

export default defineConfig({
  // 这里填你的仓库名，注意前后都要有斜杠
  base: '/Calculation-of-Compressor-Efficiency-pro/', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000,
  },
  server: {
    open: true // 启动时自动打开浏览器
  }
});