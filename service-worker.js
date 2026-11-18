"use strict";

const scope = self.registration.scope;
const prefix = `yolk-maze:${scope}:`;
const cacheName = `${prefix}v1.1.0`;
const assets = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/art.js",
  "./js/game.js",
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
    const fresh = await fetch(event.request, { cache: "reload" }).catch(() => undefined);
    const cache = await caches.open(cacheName).catch(() => undefined);
    if (fresh?.ok) {
      await cache?.put(url.href, fresh.clone()).catch(() => {});
      return fresh;
    }
    return (await cache?.match(url.href)) || fresh || Response.error();
  })());
});
