const VERSION = '1.0.4';
const CACHE_NAME = `limudim-${VERSION}`;
const CORE_ASSETS = [
  './index.html',
  './manifest.json'
];

// ===== התקנה — בנה קאש חדש =====
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      // רק אחרי שהקאש מוכן לחלוטין — אפשר להמשיך
  );
  // לא קוראים skipWaiting כאן — ממתינים לאישור המשתמש
});

// ===== הפעלה — נקה קאש ישן בלי clients.claim =====
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
    // אין self.clients.claim() — מונע השתלטות על דפים ישנים
  );
});

// ===== הודעות מהאפליקציה =====
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    // לפני skipWaiting — ודא שהקאש החדש מוכן
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then(cache => cache.addAll(CORE_ASSETS))
        .then(() => self.skipWaiting())
    );
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

  // Network First — תמיד נסה רשת קודם, קאש רק כגיבוי
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // אין רשת — השתמש בקאש
        return caches.match(event.request)
          .then(cached => cached || caches.match('./index.html'));
      })
  );
});
