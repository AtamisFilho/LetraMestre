// Service Worker for LetraMestre PWA.
//
// BUMP CACHE_VERSION on every deploy (any string change is enough — the
// activate handler deletes every cache whose name !== CACHE_NAME, so a
// bumped version invalidates all stale entries on next visit).
const CACHE_VERSION = 'v2.1.0';
const CACHE_NAME = `letramestre-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // skipWaiting on install — the client (pwa-register.tsx) is responsible for
  // reloading on controllerchange so we don't end up with mixed JS chunks.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete any cache from a previous version (prevents unbounded growth).
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
      // Take control of all open clients immediately so the new SW handles
      // fetches without waiting for a navigation.
      await self.clients.claim();
      // Notify all clients (including uncontrolled ones) that a new SW took
      // over. The client shows an "Atualizar" toast and posts SKIP_WAITING
      // on user action — but since we already skipWaiting on install, the
      // toast is informational and the reload is what applies the new assets.
      const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
      clients.forEach((c) => c.postMessage({ type: 'SW_UPDATED' }));
    })()
  );
});

self.addEventListener('message', (event) => {
  // Client-driven update: allows a "Apply update" button to force-activate
  // the waiting SW (redundant with install skipWaiting, but kept for the
  // documented client-side flow).
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept API calls, Socket.io, or any URL with "socket" in the
  // path (covers /socket.io/, socket.io queries, etc.). The original
  // includes('/api/') check would also match "/api/" anywhere in the URL
  // (including query strings); parsing the URL avoids false positives.
  const url = new URL(request.url);
  if (
    url.pathname.includes('/api/') ||
    url.pathname.includes('socket.io') ||
    url.pathname.includes('socket')
  ) {
    return;
  }

  // Only handle GET. Cross-origin requests (fonts, CDNs) are left to the
  // browser (caching opaque responses provides no SWR benefit and burns
  // storage quota).
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Stale-while-revalidate for navigations + same-origin static assets.
  // Serve cache instantly, fetch in background to refresh. On navigation
  // network failure, fall back to the app shell (avoids white screen).
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          if (cached) return cached;
          if (request.mode === 'navigate') {
            const shell = await caches.match('/');
            if (shell) return shell;
          }
          throw new Error('offline and not cached');
        });
      return cached || networkFetch;
    })()
  );
});
