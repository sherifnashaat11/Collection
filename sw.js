const CACHE = 'collect-v10';
const ASSETS = [
  './',
  './index.html',
  './login.html',
  './Arabic_Gas_Calculator.html',
  './manifest.json',
  './css/base.css',
  './css/components.css',
  './css/collector.css',
  './js/collector/app.js',
  './js/collector/browse.js',
  './js/collector/search.js',
  './js/collector/buttons.js',
  './js/collector/ledger.js',
  './js/collector/lock.js',
  './js/collector/updateCheck.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // نستخدم addAll لتخزين الملفات الأساسية فوراً
      return cache.addAll(ASSETS).catch(err => {
        console.warn('Some assets failed to cache:', err);
      });
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // تحديث الكاش بالنسخة الجديدة إذا كان هناك إنترنت
        if (res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, resClone));
        }
        return res;
      })
      .catch(() => {
        // إذا انقطع الإنترنت، اقرأ من الكاش
        return caches.match(e.request).then(cachedRes => {
          if (cachedRes) return cachedRes;
          // إذا لم يجد الملف، أرجع الصفحة الرئيسية
          return caches.match('./index.html');
        });
      })
  );
});
