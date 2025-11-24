import { defineConfig } from 'vite';

export default defineConfig({
  // 这里的名字要和您的 GitHub 仓库名完全一致
  base: '/Calculation-of-Compressor-Efficiency-pro/', 
  build: {
    // 下面这个配置可以消除那个 1000kB 的黄色警告（通过分包）
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts'], // 把 echarts 单独打包
          xlsx: ['xlsx']        // 把 xlsx 单独打包
        }
      }
    }
  }
});