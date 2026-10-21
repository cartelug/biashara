// Offline shell. Pages: network first, falling back to cache. Assets: cache first.
// The form endpoint and any non-GET request are never cached.
const VERSION = 'btc-__VERSION__';
const PRECACHE = __PRECACHE__;
const ENDPOINT = __ENDPOINT__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (ENDPOINT && req.url.startsWith(ENDPOINT)) return;
  if (url.pathname.startsWith('/apply/submit')) return;
  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html') || req.headers.get('X-Requested-With') === 'router';
  if (isPage) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(url.pathname, copy)); }
        return res;
      }).catch(() => caches.match(url.pathname).then((r) => r || caches.match('/404.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && /\/assets\//.test(url.pathname)) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
