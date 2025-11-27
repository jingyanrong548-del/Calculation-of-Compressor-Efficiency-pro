// =====================================================================
// sw.js: Service Worker (PWA Core & Offline Caching)
// 版本: v8.34 (Cache-First Strategy for WASM)
// =====================================================================

// 定义缓存名称 (每次发布新版本时，请修改此版本号以强制更新客户端缓存)
const CACHE_NAME = 'comp-calc-pro-v8.34';

// 定义必须立即缓存的核心文件
// 注意: Vite 打包后的 JS/CSS 文件名带哈希，无法在此硬编码。
// 它们将在第一次加载时被动态缓存 (Runtime Caching)。
const PRECACHE_URLS = [
    './',
    './index.html',
    './coolprop.wasm',  // 核心：约 2MB，必须离线缓存
    './manifest.json'
];

// 1. 安装事件 (Install): 初始化缓存
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    // 跳过等待，立即接管页面
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching core assets');
            return cache.addAll(PRECACHE_URLS);
        })
    );
});

// 2. 激活事件 (Activate): 清理旧缓存
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // 如果缓存名不是当前版本，则删除
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // 立即接管所有客户端
            return self.clients.claim();
        })
    );
});

// 3. 拦截请求 (Fetch): 缓存优先策略 + 动态缓存
self.addEventListener('fetch', (event) => {
    // 只处理 HTTP/HTTPS 请求 (忽略 chrome-extension:// 等)
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // A. 缓存命中: 直接返回本地文件 (极速/离线)
            if (cachedResponse) {
                return cachedResponse;
            }

            // B. 缓存未命中: 发起网络请求
            return fetch(event.request).then((networkResponse) => {
                // 检查响应有效性
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // 克隆响应 (流只能读取一次)
                const responseToCache = networkResponse.clone();

                // 将新资源动态存入缓存 (如下次访问即可离线)
                caches.open(CACHE_NAME).then((cache) => {
                    // 排除 Vite 的热更新文件 (HMR)
                    if (!event.request.url.includes('@vite') && !event.request.url.includes('node_modules')) {
                        cache.put(event.request, responseToCache);
                    }
                });

                return networkResponse;
            }).catch(() => {
                // C. 断网且无缓存: 可以返回一个自定义的 "Offline" 页面 (此处暂略)
                console.log('[Service Worker] Network failed & no cache for:', event.request.url);
            });
        })
    );
});