const VERSION = '1.0.2';
const CACHE_NAME = `limudim-${VERSION}`;
const CORE_ASSETS = [
  './index.html',
  './manifest.json'
];

// ===== התקנה =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
  // אל תחכה לכל הלקוחות שייסגרו — עבור ל-activate מיד
  // (self.skipWaiting לא נקרא כאן בכוונה — נחכה לאישור המשתמש)
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

// ===== הודעות מהאפליקציה =====
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION', version: VERSION });
  }
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

      return cache.match('./index.html');
    })
  );
});
