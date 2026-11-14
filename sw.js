/* ─── Money Record — Service Worker v39 ──────────────────────────────
   v39 changes
   ✅ All asset URLs are resolved against the registration scope instead of
      hard-coded "/" — the app now installs correctly when served from a
      sub-path (GitHub Pages, /money-tracker/, etc.) instead of failing
      install because /index.html does not exist there.
   ✅ countdown.html is precached so the secondary page works offline.
   ✅ CDN scripts are pinned to exact versions; only cdn.jsdelivr.net is
      treated as a CDN (the old `url.includes('jsdelivr.net')` matched any
      URL containing that string).
   ✅ Only successful basic/CORS responses are cached — no 4xx/5xx, no
      opaque responses, no partial 206 content.
   ✅ Background revalidation failures are swallowed; the old code left a
      rejected promise inside waitUntil whenever the network dropped.
   ✅ Navigation requests fall back to the cached app shell when offline.
   ✅ SKIP_WAITING message support, so "Refresh now" actually activates the
      waiting worker instead of reloading onto the old one.
   ✅ Removes the stale v29–v38 changelog; the file now documents behaviour,
      not a running log of past cache bumps.
─────────────────────────────────────────────────────────────────── */

const CACHE = 'money-app-v39';
const SCOPE = self.registration.scope;
const asset = path => new URL(path, SCOPE).href;

/* Core shell — install fails if any of these cannot be fetched. */
const STATIC_ASSETS = ['./', './index.html', './manifest.json'].map(asset);

/* Nice-to-have: missing files must never block installation. */
const OPTIONAL_ASSETS = [
  './countdown.html',
  './icon-192.png',
  './icon-512.png'
].map(asset);

/* Keep these in sync with the pinned + SRI-tagged URLs in index.html. */
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

const APP_SHELL = new Set([...STATIC_ASSETS, ...OPTIONAL_ASSETS]);
const CDN_HOSTS = new Set(['cdn.jsdelivr.net']);

const isCdn = url => CDN_HOSTS.has(url.hostname);

/* API reads are cached network-first so an already-loaded screen still has
   data when the connection drops. Deliberately narrow: no auth endpoints,
   no arbitrary third-party requests (which would pollute the cache with
   credentials and unrelated data). */
const isApiRead = url =>
  (url.pathname.includes('/rest/v1/transactions') ||
   url.pathname.includes('/rest/v1/homework') ||
   url.pathname.includes('/storage/v1/object/'));

const cacheableResponse = res =>
  !!res && res.ok && res.status !== 206 &&
  (res.type === 'basic' || res.type === 'cors');

/* ── INSTALL ─────────────────────────────────────────────────────── */
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(STATIC_ASSETS);
    await Promise.allSettled(
      [...OPTIONAL_ASSETS, ...CDN_ASSETS].map(url => cache.add(url))
    );
  })());
  self.skipWaiting();
});

/* ── ACTIVATE ────────────────────────────────────────────────────── */
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

/* The app's "Refresh now" button posts this before reloading. */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

/* ── FETCH ───────────────────────────────────────────────────────── */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // POST/PATCH/DELETE go straight to network

  let url;
  try { url = new URL(req.url); } catch { return; }

  const shell = APP_SHELL.has(url.href);
  const cdn   = isCdn(url);
  const api   = isApiRead(url);
  if (!shell && !cdn && !api) return; // let the browser handle everything else

  if (shell || cdn) {
    /* Cache-first with background revalidation (stale-while-revalidate). */
    e.respondWith((async () => {
      const cache   = await caches.open(CACHE);
      const cached  = await cache.match(req);
      const refresh = fetch(req).then(res => {
        if (cacheableResponse(res)) cache.put(req, res.clone()).catch(() => {});
        return res;
      }).catch(() => null); // offline revalidation must not reject

      if (cached) { e.waitUntil(refresh); return cached; }
      const fresh = await refresh;
      if (fresh) return fresh;

      if (req.mode === 'navigate') {
        const shellResponse = (await cache.match(asset('./index.html'))) ||
                              (await cache.match(SCOPE));
        if (shellResponse) return shellResponse;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })());
  } else {
    /* Network-first for Supabase reads, with a cached fallback. */
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (cacheableResponse(res)) cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch {
        const cached = await cache.match(req);
        if (cached) return cached;
        // A 503 makes the Supabase client throw, so the app keeps its
        // in-memory state instead of showing a fake empty list.
        return new Response(JSON.stringify({ message: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    })());
  }
});
