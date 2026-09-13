/* Guardian Authentic — cache check shells only; never seal APIs. */
const CACHE = 'ga-authentic-v1';
const PRECACHE = [
  '/authentic/',
  '/authentic/index.html',
  '/authentic/check.html',
  '/authentic/authentic.css',
  '/authentic/authentic.js',
  '/authentic/check.js',
  '/authentic/manifest.webmanifest',
  '/c7-cobra-256.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) return; // network only — fresh verdicts
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
      const copy = res.clone();
      if (res.ok && url.origin === location.origin) {
        caches.open(CACHE).then((c) => c.put(event.request, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
