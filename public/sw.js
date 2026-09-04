/* Gestock 3B — service worker
   - app shell en cache (offline)
   - /api/* : toujours réseau (jamais mis en cache : auth & données)
   - navigations : réseau d'abord, repli sur le cache
   - assets statiques : cache d'abord, mise à jour en arrière-plan
*/
const VERSION = 'v3';
const SHELL_CACHE = `gestock-shell-${VERSION}`;
const RUNTIME_CACHE = `gestock-runtime-${VERSION}`;
const SHELL = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API : jamais de cache
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Navigations : réseau d'abord, repli sur l'app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, res.clone()));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/index.html')))
    );
    return;
  }

  // Assets : cache d'abord + revalidation en arrière-plan
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, res.clone()));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
