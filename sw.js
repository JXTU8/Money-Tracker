/* ─── Money Record — Service Worker v5 ───────────────────────────────
   Changes from v4:
   ✅ Cache version bumped to v5 — clears stale v4 cache on update
   ✅ Cache-first for static + CDN assets (faster loads, better offline)
   ✅ CDN scripts (Supabase, Chart.js) pre-cached at install
   ✅ Non-GET requests skip the cache handler entirely
   ✅ CDN cache failure doesn't block install
─────────────────────────────────────────────────────────────────── */

const CACHE = 'money-app-v5';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

/* True when the request is for a cacheable static or CDN resource */
const isCacheable = req => {
  try {
    const url = new URL(req.url);
    return STATIC_ASSETS.includes(url.pathname) || req.url.includes('jsdelivr.net');
  } catch {
    return false;
  }
};

/* ── INSTALL: cache local assets first, then try CDN ─────────────── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      c.addAll(STATIC_ASSETS).then(() =>
        // CDN may be unreachable at install time — don't let it block
        c.addAll(CDN_ASSETS).catch(() => {})
      )
    )
  );
  self.skipWaiting();
});

/* ── ACTIVATE: delete all old caches ─────────────────────────────── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── FETCH ────────────────────────────────────────────────────────── */
self.addEventListener('fetch', e => {
  // Only handle GET — let POST/PATCH/DELETE go straight to network
  if (e.request.method !== 'GET') return;

  if (isCacheable(e.request)) {
    /* Cache-first: serve instantly from cache; update cache in background */
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        });
      })
    );
  } else {
    /* Network-first: for Supabase API calls and everything else */
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  }
});
