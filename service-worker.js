"use strict";
// Increment this version whenever any cached file changes.
const CACHE = "elowen-static-v2";
const FILES = [
  "./",
  "index.html",
  "calculator.html",
  "data.html",
  "privacy.html",
  "terms.html",
  "404.html",
  "elowen.PNG",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "manifest.webmanifest",
  "css/styles.css",
  "css/calculator.css",
  "js/app.js",
  "js/storage.js",
  "js/theme.js",
  "js/tools.js",
  "js/engine.js",
  "js/calculator.js",
  "js/backup.js",
];
const urls = new Set(
  FILES.map((path) => new URL(path, self.registration.scope).href),
);
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  // Activate on the next visit after existing tabs close, avoiding mixed live versions.
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("elowen-static-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || !urls.has(event.request.url)) return;
  // Network first: online visits receive current files, offline visits use the last copy.
  event.respondWith(
    fetch(event.request)
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response.clone());
        }
        return response;
      })
      .catch(() =>
        caches
          .match(event.request)
          .then((cached) => cached || Response.error()),
      ),
  );
});
