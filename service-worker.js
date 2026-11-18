"use strict";

const scope = self.registration.scope;
const prefix = `yolk-maze:${scope}:`;
const cacheName = `${prefix}v1.0.0`;
const assets = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/art.js",
  "./js/game.js",
  "./service-worker.js",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];
const appUrls = new Set(assets.map(path => new URL(path, scope).href));

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(assets.map(path => new Request(new URL(path, scope), { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(prefix) && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  url.search = "";
  if (!appUrls.has(url.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    const saved = await cache.match(url.href);
    return saved || fetch(event.request);
  })());
});
