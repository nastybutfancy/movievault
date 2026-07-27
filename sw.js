const CACHE_NAME = "movievault-collector-3.5.2-mobile-intro-standalone-v4";
const ASSETS = ["./", "./index.html", "./styles.css?v=3.5.2-mobile-intro-standalone-v4", "./app.js?v=3.5.2-mobile-intro-standalone-v4", "./manifest.webmanifest", "./manifest.webmanifest?v=3.5.2-mobile-intro-standalone-v4", "./movievault-design-logo.png", "./movievault-design-logo.png?v=3.5.2-mobile-intro-standalone-v4", "./movievault-design-icon-192.png", "./movievault-design-icon-512.png", "./movievault-design-apple-touch.png", "./apple-splash-1320x2868.png?v=3.5.2-mobile-intro-standalone-v4", "./apple-splash-1290x2796.png?v=3.5.2-mobile-intro-standalone-v4", "./apple-splash-1179x2556.png?v=3.5.2-mobile-intro-standalone-v4", "./apple-splash-1284x2778.png?v=3.5.2-mobile-intro-standalone-v4", "./apple-splash-1125x2436.png?v=3.5.2-mobile-intro-standalone-v4", "./apple-splash-1242x2688.png?v=3.5.2-mobile-intro-standalone-v4", "./apple-splash-828x1792.png?v=3.5.2-mobile-intro-standalone-v4", "./apple-splash-750x1334.png?v=3.5.2-mobile-intro-standalone-v4"];

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
