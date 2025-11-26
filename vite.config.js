import { defineConfig } from 'vite';

export default defineConfig({
  // 1. 基础路径 (修复 GitHub Pages 404 问题的关键)
  // 必须设置您的仓库名称，前后都要有斜杠
  base: '/Calculation-of-Compressor-Efficiency-pro/', 

  // 2. 插件配置：自动修补 CoolProp 源码
  plugins: [
    {
      name: 'coolprop-auto-export',
      transform(code, id) {
        // 拦截 coolprop.js
        if (id.includes('coolprop.js')) {
          // 动态注入 export default Module，使官方源码变成标准模块
          return code + ';\nexport default Module;';
        }
      }
    }
  ],

  // 3. 依赖优化：排除 coolprop.js
  // 这样 Vite 每次都会运行上面的插件，而不是使用缓存的预构建版本
  optimizeDeps: {
    exclude: ['./src/js/libs/coolprop.js'],
  },

  build: {
    // 确保 WASM 文件保持独立，不被 Base64 编码
    assetsInlineLimit: 0,
    target: 'esnext'
  },

  // 4. Esbuild 配置：解决 .jsx 报错
  esbuild: {
    loader: 'js',     
    jsxInject: ``,    
  }
});