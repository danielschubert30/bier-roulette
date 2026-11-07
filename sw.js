// Service Worker: macht die App offline-fähig (schlechtes Netz im Stadion).
// Bei jeder Veröffentlichung VERSION hochzählen, damit Handys die neue Fassung laden.
const VERSION = "v1.1.0";
const CACHE = "bier-roulette-" + VERSION;
const SHELL = [
  "./",
  "index.html",
  "css/style.css",
  "js/app.js",
  "js/wheel.js",
  "js/shootout.js",
  "js/store.js",
  "js/content.js",
  "manifest.webmanifest",
  "assets/fca-logo.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("bier-roulette-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Seitenaufruf: erst Netz (für Updates), sonst gespeicherte Fassung
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => { caches.open(CACHE).then((c) => c.put("index.html", res.clone())); return res; })
        .catch(() => caches.match("index.html"))
    );
    return;
  }

  // Schriften von Google: einmal laden, dann aus dem Speicher
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
    return;
  }

  // Eigene Dateien: sofort aus dem Speicher, im Hintergrund auffrischen
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
