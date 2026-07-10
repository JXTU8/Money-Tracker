/* ─── Money Record — Service Worker v21 ──────────────────────────────
   Changes from v20:
   ✅ Cache version bumped to v21 — index.html changed again (the
      homework edit modal now shows an "Added <date/time>" line, e.g.
      "Friday 13th June 2026 12:08 pm", so opening any homework item
      tells you exactly when it was created) and the old v20 cache was
      still serving that file cache-first. Nothing else in this worker
      needed to change; bumping CACHE is what makes the activate
      handler below purge the old cache and forces a fresh fetch of
      index.html on next install.
─────────────────────────────────────────────────────────────────── */

const CACHE = 'money-app-v21';

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