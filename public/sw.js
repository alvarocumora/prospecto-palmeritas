/* Geocapitals service worker
   - NetworkFirst for HTML navigations (always fresh when online)
   - CacheFirst for map tiles (Esri + OSM) so terreno offline funciona en zonas ya vistas
   - Never caches /api/*, /_*, /~oauth, /sw.js, /version.json, JS/CSS assets
*/
const VERSION = "geocap-sw-v3";
const TILE_CACHE = `geocap-tiles-${VERSION}`;
const HTML_CACHE = `geocap-html-${VERSION}`;
const MAX_TILES = 800;
const HTML_TIMEOUT_MS = 3000;

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("geocap-") && !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isTileUrl(url) {
  return (
    url.hostname === "server.arcgisonline.com" || /\.tile\.openstreetmap\.org$/.test(url.hostname)
  );
}

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  const excess = keys.length - max;
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

async function networkFirstHtml(request) {
  const cache = await caches.open(HTML_CACHE);
  try {
    const network = await Promise.race([
      fetch(request),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), HTML_TIMEOUT_MS)),
    ]);
    if (network && network.ok) cache.put(request, network.clone()).catch(() => {});
    return network;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match("/");
    if (fallback) return fallback;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function cacheFirstTile(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const network = await fetch(request, { mode: "cors", credentials: "omit" });
    if (network && (network.status === 200 || network.status === 0)) {
      cache
        .put(request, network.clone())
        .then(() => trimCache(TILE_CACHE, MAX_TILES))
        .catch(() => {});
    }
    return network;
  } catch (e) {
    if (cached) return cached;
    return new Response("", { status: 504 });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }

  // Never intercept these
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_") ||
    url.pathname.startsWith("/~") ||
    url.pathname === "/sw.js" ||
    url.pathname === "/service-worker.js" ||
    url.pathname === "/version.json" ||
    url.pathname === "/manifest.webmanifest"
  )
    return;

  // Private/auth surfaces (cartola, KYC, documentos, admin, auth): never cache HTML
  if (
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/dashboard/investments") ||
    url.pathname.startsWith("/dashboard/documentos") ||
    url.pathname.startsWith("/dashboard/admin") ||
    url.pathname.startsWith("/onboarding")
  )
    return;

  // Map tiles: cache-first
  if (isTileUrl(url)) {
    event.respondWith(cacheFirstTile(req));
    return;
  }

  // Same-origin HTML navigation: network-first with offline fallback
  if (
    url.origin === self.location.origin &&
    (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html"))
  ) {
    event.respondWith(networkFirstHtml(req));
    return;
  }

  // Everything else: passthrough
});

// Allow page to ask for unregistration (kill switch)
self.addEventListener("message", (event) => {
  if (event.data === "UNREGISTER") {
    self.registration.unregister();
  }
});
