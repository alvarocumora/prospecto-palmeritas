/* Geocapitals service worker
   - CacheFirst for map tiles (Esri + OSM) so terreno offline funciona en zonas ya vistas
   - HTML cache restricted to an explicit allowlist of public, non-personalized pages
   - Private/auth surfaces (/dashboard, auth, KYC, documentos, contracts, APIs, PDFs):
     network-only, NEVER written to CacheStorage; offline gets a neutral fallback
*/
const VERSION = "geocap-sw-v4";
const TILE_CACHE = `geocap-tiles-${VERSION}`;
const HTML_CACHE = `geocap-html-${VERSION}`;
const MAX_TILES = 800;
const HTML_TIMEOUT_MS = 3000;

/* Explicit allowlist of public pages that may be cached for offline viewing.
   Everything else (any /dashboard route, auth, onboarding, unknown paths) is
   treated as private and is never stored. */
const PUBLIC_HTML_PATHS = ["/", "/proyectos", "/inversionistas", "/inversion-colateral", "/catastro/mapa"];

function isPublicHtmlPath(pathname) {
  const p = pathname.replace(/\/+$/, "") || "/";
  return PUBLIC_HTML_PATHS.includes(p);
}

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
    return offlineResponse();
  }
}

/* Private surfaces: network only. Offline shows a neutral page with no data,
   never a cached copy of a previous authenticated session. */
async function networkOnlyPrivate(request) {
  try {
    return await fetch(request);
  } catch {
    return offlineResponse();
  }
}

function offlineResponse() {
  return new Response(
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title></head><body style="font-family:system-ui,sans-serif;padding:2rem;color:#1a1a2e"><h1>Sin conexión</h1><p>Esta sección requiere conexión para mostrar información actualizada. Los datos de tu cuenta nunca se guardan en este dispositivo.</p></body></html>',
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
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

  // Map tiles: cache-first (public field flow)
  if (isTileUrl(url)) {
    event.respondWith(cacheFirstTile(req));
    return;
  }

  // Same-origin HTML navigation
  if (
    url.origin === self.location.origin &&
    (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html"))
  ) {
    if (isPublicHtmlPath(url.pathname)) {
      event.respondWith(networkFirstHtml(req));
    } else {
      event.respondWith(networkOnlyPrivate(req));
    }
    return;
  }

  // Everything else: passthrough (no cache)
});

// Allow page to ask for unregistration (kill switch)
self.addEventListener("message", (event) => {
  if (event.data === "UNREGISTER") {
    self.registration.unregister();
  }
});
