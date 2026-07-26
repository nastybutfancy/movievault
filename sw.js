const CACHE_NAME = "movievault-collector-3.5.0-db1";
const ASSETS = [
  "./movievault-icon-maskable-512.png?v=3.5.0-db1",
  "./movievault-icon-512.png?v=3.5.0-db1",
  "./movievault-icon-192.png?v=3.5.0-db1",
  "./apple-touch-icon.png?v=3.5.0-db1",
  "./manifest.webmanifest?v=3.5.0-db1","./", "./index.html", "./styles.css?v=3.5.0-db1", "./app.js?v=3.5.0-db1", "./manifest.webmanifest", "./movievault-logo.webp", "./movievault-icon.webp"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
