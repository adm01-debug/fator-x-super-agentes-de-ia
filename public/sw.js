/**
 * Nexus Agents Studio — Service Worker (T15)
 * Strategy:
 *  - Network-first for HTML / API calls (always fresh data)
 *  - Cache-first for static assets (fonts, images, CSS, JS)
 *  - Stale-while-revalidate for the manifest
 *  - Offline fallback to cached index page
 *
 * Cache name versioning: bump CACHE_VERSION to force re-cache on deploy.
 */

const CACHE_VERSION = 'fator-x-v1';
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.ico',
];

// Install: pre-cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch(() => {
        // best-effort
      })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: route by request type
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests entirely
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Skip cross-origin and supabase calls — those should always go fresh
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.includes('supabase')) return;
  if (url.pathname.startsWith('/functions/')) return;

  // Network-first for HTML navigations
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Cache-first for static assets (js/css/fonts/images)
  if (
    /\.(?:js|css|woff2?|png|jpe?g|svg|gif|webp|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Allow page to send SKIP_WAITING to activate immediately
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
