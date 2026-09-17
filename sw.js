const CACHE_NAME = "movievault-collector-3.5.7-new-endpoint";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=3.5.7-new-endpoint",
  "./app.js?v=3.5.7-new-endpoint",
  "./manifest.webmanifest?v=3.5.7-new-endpoint",
  "./movievault-design-icon-512.png?v=3.5.7-new-endpoint",
  "./movievault-design-icon-192.png?v=3.5.7-new-endpoint",
  "./movievault-design-apple-touch.png?v=3.5.7-new-endpoint",
  "./movievault-design-logo.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Bardzo ważne: nie przechwytujemy połączeń JSONP do Google Apps Script
  // ani obrazów/API TMDb. iOS/Safari potrafi źle znosić cache'owanie tych
  // zewnętrznych żądań przez service workera.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") return caches.match("./index.html");
        throw new Error("Brak połączenia z siecią.");
      })
  );
});
