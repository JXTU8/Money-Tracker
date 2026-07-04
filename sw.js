/* ─── Money Record — Service Worker v17 ──────────────────────────────
   Changes from v16:
   ✅ Removed the 'push' and 'notificationclick' handlers — this was
      dead weight: index.html never had a subscribe flow or a listener
      for the 'open-tab' message these sent, so nothing could ever have
      reached them client-side. Removed rather than left unused.
      (If a send-homework-notifications Supabase Edge Function is still
      running server-side, it's now sending pushes nothing will handle —
      worth pausing/removing that too if you're dropping the feature.)
   ✅ Cache version bumped to v17 so installed users pick up this file
      instead of continuing to run whatever version they last cached.
─────────────────────────────────────────────────────────────────── */

const CACHE = 'money-app-v17';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

/* Icons are optional — missing files must not block install */
const ICON_ASSETS = [
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
      // Core assets must succeed
      c.addAll(STATIC_ASSETS).then(() =>
        // Icons and CDN may be absent at first deploy — never block install
        Promise.all([
          c.addAll(ICON_ASSETS).catch(() => {}),
          c.addAll(CDN_ASSETS).catch(() => {})
        ])
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