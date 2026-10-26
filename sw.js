const CACHE = 'collect-v27';

self.addEventListener('install', e => {
  self.skipWaiting();
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

// استراتيجية ذكية: احفظ أي ملف يطلبه التطبيق (JS, CSS, HTML, Images)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cachedRes => {
      // إذا كان الملف موجوداً في الكاش، أعده فوراً (هذا يجعله يفتح بسرعة وبدون إنترنت)
      if (cachedRes) {
        return cachedRes;
      }

      // إذا لم يكن موجوداً، احضره من الشبكة واحفظه للمرة القادمة
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const resClone = res.clone();
          caches.open(CACHE).then(cache => {
            cache.put(e.request, resClone);
          });
        }
        return res;
      }).catch(() => {
        // إذا انقطع الإنترنت وطلب المستخدم صفحة، أعد له الصفحة الرئيسية
        if (e.request.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('./login.html');
        }
      });
    })
  );
});
