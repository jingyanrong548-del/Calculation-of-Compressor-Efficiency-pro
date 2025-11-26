import { defineConfig } from 'vite';

export default defineConfig({
  base: './',

  plugins: [
    {
      name: 'coolprop-auto-export',
      transform(code, id) {
        // 1. 拦截 coolprop.js
        if (id.includes('coolprop.js')) {
          console.log('✅ [Vite Plugin] 已捕获 coolprop.js，正在注入 export 语句...');
          
          // 2. 核心修改：在代码末尾强行加上 export default Module;
          // 这样浏览器就能正常 import 它了，且无需修改源文件
          return code + ';\nexport default Module;';
        }
      }
    }
  ],

  optimizeDeps: {
    // 3. 关键：必须排除 coolprop.js，强迫 Vite 每次都通过我们的插件处理它
    exclude: ['./src/js/libs/coolprop.js'],
  },

  build: {
    assetsInlineLimit: 0,
    target: 'esnext'
  },

  esbuild: {
    loader: 'js',     
    jsxInject: ``,    
  }
});