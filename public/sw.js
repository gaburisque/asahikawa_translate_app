// Enhanced Network-first Service Worker with offline fallback
const CACHE_NAME = 'avt-v3';
const STATIC_CACHE = [
  '/',
  '/manifest.webmanifest',
  '/icon.png',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_CACHE)).catch((e) => console.error('SW cache addAll', e))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : undefined))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // API routes: Network-only with offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => new Response(
          JSON.stringify({ error: 'オフライン状態です。ネットワーク接続を確認してください。' }), 
          { 
            status: 503, 
            headers: { 'Content-Type': 'application/json' } 
          }
        ))
    );
    return;
  }

  // Static assets and pages: Network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful responses
        if (response && response.ok && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(request).then((cached) => {
          if (cached) {
            return cached;
          }
          
          // Fallback for HTML pages when offline
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/').then((indexPage) => indexPage || new Response(
              '<html><body><h1>オフライン</h1><p>ネットワーク接続を確認してください。</p></body></html>',
              { status: 503, headers: { 'Content-Type': 'text/html' } }
            ));
          }
          
          return new Response('オフライン', { status: 503 });
        });
      })
  );
});


