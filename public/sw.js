// AniLove Android Service Worker
const CACHE_NAME = 'anilove-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Exclude external cross-origin requests, Google, Firebase, trace.moe, API from SW fetch interception
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('google') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('trace.moe') ||
    url.hostname.includes('anilist.co') ||
    url.pathname.endsWith('.m3u8') ||
    url.pathname.endsWith('.ts')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
    })
  );
});
