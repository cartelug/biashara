// Offline shell. Pages: network first, falling back to cache. Assets: cache first.
// The form endpoint and any non-GET request are never cached.
const VERSION = 'btc-2FLeHGFIrd';
const PRECACHE = ["/biashara/","/biashara/about/","/biashara/loans/","/biashara/how-we-lend/","/biashara/terms/","/biashara/who-we-serve/","/biashara/team/","/biashara/licence/","/biashara/faq/","/biashara/contact/","/biashara/apply/","/biashara/profile/","/biashara/privacy/","/biashara/404.html","/biashara/assets/css/main.css?v=X8L0oefVR5","/biashara/assets/js/app.js?v=2FLeHGFIrd","/biashara/assets/js/config.js?v=2FLeHGFIrd","/biashara/assets/vendor/gsap.min.js","/biashara/assets/vendor/ScrollTrigger.min.js","/biashara/assets/vendor/lenis.min.js","/biashara/assets/fonts/archivo-wght.woff2","/biashara/assets/fonts/sourceserif4-opsz.woff2","/biashara/assets/fonts/sourceserif4-italic-opsz.woff2","/biashara/assets/img/logo/biashara-logo-320.png","/biashara/assets/img/logo/mark-160.png"];
const ENDPOINT = "";
const BASE = "/biashara";

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
  if (url.pathname.startsWith(BASE + '/apply/submit')) return;
  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html') || req.headers.get('X-Requested-With') === 'router';
  if (isPage) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(url.pathname, copy)); }
        return res;
      }).catch(() => caches.match(url.pathname).then((r) => r || caches.match(BASE + '/404.html')))
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
