const CACHE_NAME = 'limudim-2026-05-05';
const CORE_ASSETS = [
  './index.html',
  './manifest.json'
];

// ===== התקנה — שמור קבצים בסיסיים לקאש =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// ===== הפעלה — נקה קאש ישן =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ===== בקשות רשת =====
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase ו-CDN חיצוניים — אל תתערב
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('googleapis.com')
  ) {
    return;
  }

  // קבצי האפליקציה — Cache First עם עדכון ברקע
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);

      const networkPromise = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          cache.put(event.request, response.clone());
        }
        return response;
      }).catch(() => null);

      if (cached) {
        networkPromise; // עדכן ברקע
        return cached;
      }

      const fromNet = await networkPromise;
      if (fromNet) return fromNet;

      // fallback לדף הראשי
      return cache.match('./index.html');
    })
  );
});
