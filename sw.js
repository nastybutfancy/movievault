const CACHE_NAME = "movievault-collector-3.5.3-ios-stability1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=3.5.3-ios-stability1",
  "./app.js?v=3.5.3-ios-stability1",
  "./manifest.webmanifest",
  "./manifest.webmanifest?v=3.5.3-ios-stability1",
  "./movievault-design-logo.png",
  "./movievault-design-logo.png?v=3.5.3-ios-stability1",
  "./movievault-design-icon-192.png",
  "./movievault-design-icon-512.png",
  "./movievault-design-apple-touch.png",
  "./apple-splash-1320x2868.png?v=3.5.3-ios-stability1",
  "./apple-splash-1290x2796.png?v=3.5.3-ios-stability1",
  "./apple-splash-1179x2556.png?v=3.5.3-ios-stability1",
  "./apple-splash-1284x2778.png?v=3.5.3-ios-stability1",
  "./apple-splash-1125x2436.png?v=3.5.3-ios-stability1",
  "./apple-splash-1242x2688.png?v=3.5.3-ios-stability1",
  "./apple-splash-828x1792.png?v=3.5.3-ios-stability1",
  "./apple-splash-750x1334.png?v=3.5.3-ios-stability1"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("movievault-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Najważniejsza poprawka iOS: nie przechwytujemy i nie zapisujemy w Cache
  // żadnych zasobów zewnętrznych. Starsza wersja cache'owała m.in. wszystkie
  // plakaty i unikalne zapytania JSONP do Apps Script, przez co cache rósł
  // bez końca i potrafił ubić kartę Safari przy otwieraniu dużej kolekcji.
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
