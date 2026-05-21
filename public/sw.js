// Faraway service worker — cache-first for game assets, network-only for GitHub API
const CACHE = 'faraway-v1';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll([
        '/faraway/',
        '/faraway/index.html',
      ]).catch(() => {}) // don't block install on precache failure
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Always network for GitHub API (save/load) and Google Fonts
  if (url.includes('api.github.com') || url.includes('fonts.googleapis') || url.includes('fonts.gstatic')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached ?? new Response('Offline', { status: 503 }));
    })
  );
});
