/* sw.js — Tu Polla
   Estrategia NETWORK-FIRST para la navegación/HTML: SIEMPRE intenta traer la última
   versión de la red y solo cae al caché si no hay conexión. Esto elimina el problema
   recurrente de usuarios que quedan viendo código viejo cacheado tras cada deploy.
   Los estáticos (js/css/imágenes/fuentes) van cache-first para que la app cargue rápido.

   IMPORTANTE: sube el número de versión (CACHE) en cada deploy. Como el navegador
   revalida sw.js en cada navegación, cambiar este archivo fuerza la actualización. */
const CACHE = "tupolla-v198";
const ASSET_RE = /\.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot)$/i;

self.addEventListener("install", (e) => {
  // Activa la nueva versión de inmediato, sin esperar a que cierren las pestañas.
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // Borra cachés de versiones anteriores.
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Solo gestionamos same-origin. Firebase, la API de partidos y CDNs pasan directo a la red.
  if (url.origin !== self.location.origin) return;

  const isNav =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html");

  // ── NETWORK-FIRST para HTML/navegación: siempre la última versión ──
  if (isNav) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        const cached = await caches.match(req);
        return cached || (await caches.match("/index.html")) || Response.error();
      }
    })());
    return;
  }

  // ── CACHE-FIRST para estáticos ──
  if (ASSET_RE.test(url.pathname)) {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        return cached || Response.error();
      }
    })());
  }
});
