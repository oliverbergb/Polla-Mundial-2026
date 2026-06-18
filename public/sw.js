// Tu Polla — Service Worker
const CACHE = "tupolla-v4";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];
// Instalar: precachear el app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});
// Activar: limpiar caches viejos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});
// Fetch:
// - Rutas de login de Google (/__/) -> NUNCA tocar, dejar pasar directo
// - Firebase / APIs / tiempo real -> siempre red (nunca cache)
// - Navegación (HTML) -> red primero, cache de respaldo si no hay conexión
// - Resto (estáticos) -> cache primero, luego red
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // No interceptar el handler de autenticación de Firebase/Google.
  if (url.pathname.startsWith("/__/")) return;
  const isDynamic =
    /firebaseio|firebase|googleapis|gstatic|recaptcha|accounts\.google|vercel\/insights/.test(url.hostname + url.pathname);
  if (isDynamic) {
    return; // dejar pasar a la red sin tocar
  }
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy));
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
