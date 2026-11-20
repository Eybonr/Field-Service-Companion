/* Service worker: caches the app shell so Ministry Companion works offline.
   Bump CACHE_VERSION whenever vendored assets change. index.html is always
   fetched from the network first when online, so app updates arrive automatically. */
const CACHE_VERSION = 'v5-direct-jw-library';
const CACHE_NAME = `ministry-companion-${CACHE_VERSION}`;
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/reminders.js',
  '/research-topics.js',
  '/research.js',
  '/vendor/tailwind-3.4.17.js',
  '/vendor/fonts/inter.css',
  '/vendor/fonts/inter-latin.woff2',
  '/vendor/fonts/inter-latin-ext.woff2',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('ministry-companion-') && k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/.netlify/")) return;

  // Page navigations: network first (fresh app when online), cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/', { ignoreSearch: true }))
    );
    return;
  }

  // Static assets: cache first, falling back to the network (and caching the result).
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

self.addEventListener('push', event => {
  const data = event.data?.json() || {};
  const kinds = data.kinds || [];
  const what = kinds.length > 1 ? 'A return visit and a Bible study are due.' :
    kinds.includes('study') ? 'You have a Bible study due.' : 'You have a return visit due.';
  event.waitUntil(self.registration.showNotification('Ministry Companion', {
    body:what, icon:'/icons/icon-192.png', tag:'ministry-'+kinds.join('-')+'-'+data.at
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL('/#reminders', self.location.origin).href;
    const windows = await self.clients.matchAll({type:'window'});
    if (!windows.length) return self.clients.openWindow(url);
    const client = await windows[0].navigate(url);
    return client?.focus();
  })());
});
