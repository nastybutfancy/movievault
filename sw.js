const CACHE_NAME = "movievault-v301";
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css?v=301",
  "./app.js?v=301",
  "./home.js",
  "./api.js",
  "./state.js",
  "./utils.js",
  "./collection.js",
  "./tmdb.js",
  "./scanner.js",
  "./manifest.webmanifest",
  "./assets/movievault-icon.webp",
  "./assets/movievault-logo.webp"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
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
