/* ─── Money Record Service Worker v4 ───────────────────────────────
   Strategy:
   • App shell (HTML + local assets)  → Cache-first, fallback to network
   • CDN scripts (Supabase, Chart.js) → Cache-first (long-lived)
   • Supabase API calls               → Network-only (can't cache live data)
   All cached assets are served immediately offline so the UI always loads.
─────────────────────────────────────────────────────────────────── */

const CACHE_NAME  = 'money-app-v4';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

/* CDN assets we want to pre-cache so charts & DB work offline */
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
];

/* ── INSTALL: cache shell + CDN assets ─────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Shell assets (must succeed)
      const shellPromise = cache.addAll(SHELL_ASSETS);
      // CDN assets (best-effort — don't fail install if CDN is unreachable)
      const cdnPromise = Promise.allSettled(
        CDN_ASSETS.map(url =>
          fetch(url).then(resp => {
            if (resp.ok) cache.put(url, resp);
          }).catch(() => {/* CDN unavailable on first install — skip */})
        )
      );
      return Promise.all([shellPromise, cdnPromise]);
    })
  );
  self.skipWaiting();
});

/* ── ACTIVATE: clear old caches ────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── FETCH: routing strategy ────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* 1. Supabase API → network only (live data, never cache) */
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ error: 'offline', message: 'No network connection' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  /* 2. CDN scripts → cache-first (they rarely change) */
  if (url.hostname.includes('jsdelivr.net') || url.hostname.includes('cdn.')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return resp;
        });
      })
    );
    return;
  }

  /* 3. App shell & local assets → cache-first, then network */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(resp => {
        /* Cache successful responses for future offline use */
        if (resp.ok && event.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return resp;
      }).catch(() =>
        /* Final fallback: serve the app shell for navigation requests */
        event.request.mode === 'navigate'
          ? caches.match('/index.html')
          : new Response('Offline', { status: 503 })
      );
    })
  );
});
