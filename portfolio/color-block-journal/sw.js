// sw.js — Service Worker for offline-first PWA.
// Cache-first for static assets, network-first for API calls.
//
// Docs: templates/pwa/README.md (customization), docs/cup-core.md (components)

const CACHE_NAME = 'color-block-journal-v3';

// Static assets to pre-cache on install.
// Update this list when you add new files.
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/filters/wire_journal.js',
  './js/filters/wire_theme.js',
  './js/filters/check_offline.js',
  './cup-ui/cup.css',
  './cup-ui/cup.js',
  './cup-ui/cup-element.js',
  './cup-ui/tokens.css',
  './cup-ui/reset.css',
  './cup-ui/a11y.css',
  './cup-ui/css/nano.css',
  './cup-ui/css/micro.css',
  './cup-ui/css/components.css',
  './cup-ui/css/responsive.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── Install: pre-cache static shell ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for static, network-first for API ──
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Network-first for API calls or non-GET requests
  if (request.method !== 'GET' || request.url.includes('/api/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for everything else (static assets)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Don't cache opaque or error responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
});
