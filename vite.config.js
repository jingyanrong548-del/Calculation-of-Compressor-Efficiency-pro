import { defineConfig } from 'vite';

export default defineConfig({
  // 部署配置：设置为 './' 可以确保在任何路径下（包括 GitHub Pages）都能正常加载
  base: './', 
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000,
  },
  server: {
    open: true // 启动时自动打开浏览器
  }
});