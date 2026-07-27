const CACHE_NAME = "movievault-collector-3.5.2-mobile-visual-final";
const ASSETS = [
  "./movievault-design-icon-512.png?v=3.5.2-mobile-visual-final",
  "./movievault-design-icon-192.png?v=3.5.2-mobile-visual-final",
  "./movievault-design-apple-touch.png?v=3.5.2-mobile-visual-final",
  "./manifest.webmanifest?v=3.5.2-mobile-visual-final","./", "./index.html", "./styles.css?v=3.5.2-mobile-visual-final", "./app.js?v=3.5.2-mobile-visual-final", "./manifest.webmanifest", "./movievault-design-logo.png"];

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
