const CACHE_NAME = 'collect-v1';
const ASSETS = [
  './',
  'index.html',
  'login.html',
  'gas_Calculator.html',
  'manifest.json',
  'css/base.css',
  'css/components.css',
  'css/collector.css',
  'js/collector/app.js',
  'js/collector/browse.js',
  'js/collector/search.js',
  'js/collector/buttons.js',
  'js/collector/ledger.js',
  'js/collector/lock.js',
  'js/collector/updateCheck.js',
  'pages/print.html',
  'pages/reading.html',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// 1. التثبيت: تخزين جميع الملفات
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// 2. التنشيط: حذف الكاش القديم
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. الجلب: استراتيجية Network First (الشبكة أولاً، ثم الكاش)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // إذا نجح الاتصال، قم بتخزين النسخة الجديدة
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(() => {
        // إذا فشل الاتصال (بدون إنترنت)، ابحث في الكاش
        return caches.match(e.request).then((cachedRes) => {
          if (cachedRes) return cachedRes;
          // إذا لم يجد الملف في الكاش، أعد صفحة index.html
          return caches.match('index.html');
        });
      })
  );
});
