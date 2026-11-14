/* ─── Money Record — Service Worker v42 ──────────────────────────────
   v42 changes — the actual purple bar
   ✅ Confirmed via pixel sampling of a phone screenshot: the bottom band is
      #a234d3, i.e. the ORIGINAL manifest theme_color #a334d4. It is Android's
      system navigation bar, baked into the installed WebAPK at install time;
      page CSS/JS cannot recolor it and the manifest value overrides any
      theme-color meta tag. So theme_color has been REMOVED from the manifest
      entirely — the app now never requests a purple system bar, and the
      dynamic theme-color meta is free to control it in a browser tab.
   ✅ Cache bump so the fresh (colour-free) manifest is precached.
   v41 changes — fixes "I changed the theme but my phone still shows purple"
   ✅ HTML + manifest.json are now NETWORK-FIRST. They used to be cache-first
      with background revalidation, which meant the phone always rendered the
      OLD cached index.html and kept reading the OLD cached manifest. That
      manifest still had theme_color #a334d4 (Clove purple), so Android tinted
      the system/bottom bar purple on EVERY in-app theme. A single refresh
      now serves fresh HTML + a fresh manifest.
   ✅ No artificial network timeout: a slow phone must NOT fall back to the
      stale cached shell, or the old purple manifest comes straight back.
      fetch() already rejects immediately when offline, so the cached-shell
      fallback stays fast with no timer needed.
   ✅ Only icons and the two pinned CDN scripts stay cache-first (immutable).
   ✅ Auth/API reads are still network-first with a cached offline fallback.
   ✅ SKIP_WAITING message support + navigation offline fallback retained.
   v40 → Hush theme + per-theme chart palettes.
   v39 → scope-relative assets, narrowed caching, offline shell fallback,
         SKIP_WAITING, stale v29–v38 changelog removed.
─────────────────────────────────────────────────────────────────── */

const CACHE = 'money-app-v42';
const SCOPE = self.registration.scope;
const asset = path => new URL(path, SCOPE).href;

/* Core shell — install fails if any of these cannot be fetched. */
const STATIC_ASSETS = ['./', './index.html', './manifest.json'].map(asset);

/* Nice-to-have: missing files must never block installation. */
const ICON_ASSETS = ['./icon-192.png', './icon-512.png'].map(asset);
const OPTIONAL_ASSETS = ['./countdown.html', ...ICON_ASSETS];

/* Keep these in sync with the pinned + SRI-tagged URLs in index.html. */
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

const APP_SHELL = new Set([...STATIC_ASSETS, ...OPTIONAL_ASSETS]);
const ICON_SET = new Set(ICON_ASSETS);
const CDN_HOSTS = new Set(['cdn.jsdelivr.net']);

const isCdn = url => CDN_HOSTS.has(url.hostname);

/* Narrow API cache: no auth endpoints, no arbitrary third-party requests. */
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

/* ── HELPERS ─────────────────────────────────────────────────────── */
function networkFirst(req, cache, allowShellFallback) {
  return fetch(req).then(res => {
    if (cacheableResponse(res)) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(async () => {
    const cached = await cache.match(req);
    if (cached) return cached;
    if (allowShellFallback) {
      const shell = (await cache.match(asset('./index.html'))) || (await cache.match(SCOPE));
      if (shell) return shell;
    }
    return new Response(JSON.stringify({ message: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  });
}

/* ── FETCH ───────────────────────────────────────────────────────── */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return; // POST/PATCH/DELETE go straight to network

  let url;
  try { url = new URL(req.url); } catch { return; }

  const cdn   = isCdn(url);
  const icon  = ICON_SET.has(url.href);
  const shell = APP_SHELL.has(url.href);
  const nav   = req.mode === 'navigate';
  const api   = isApiRead(url);

  if (!cdn && !icon && !shell && !nav && !api) return;

  if (cdn || icon) {
    /* Immutable assets: cache-first with background revalidation. */
    e.respondWith((async () => {
      const cache   = await caches.open(CACHE);
      const cached  = await cache.match(req);
      const refresh = fetch(req).then(res => {
        if (cacheableResponse(res)) cache.put(req, res.clone()).catch(() => {});
        return res;
      }).catch(() => null); // offline revalidation must not reject
      if (cached) { e.waitUntil(refresh); return cached; }
      return (await refresh) || new Response('Offline', { status: 503, statusText: 'Offline' });
    })());
  } else {
    /* HTML, manifest, navigation and API reads: ALWAYS try the network first
       so one refresh is enough to pick up new code and a new theme_color. */
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return networkFirst(req, cache, nav);
    })());
  }
});
