// SPDX-License-Identifier: GPL-3.0-or-later
// Service worker template. vite-plugin-pwa-lite.ts fills in the two placeholders below at build time and writes
// the result to dist/sw.js. Plain JS on purpose: it is served as is.
//
// Offline: everything the build produced (app chunks, lazy chunks, giac.wasm, micropython.wasm, fonts, icons) is
// stored in one versioned cache when the worker installs, and served from it first. After one online visit the
// app starts, computes and runs Python with no network.
//
// Updates: no skipWaiting and no clients.claim. A new version installs in the background and waits until every
// window of the old one is closed, so it takes effect on the next start and never replaces code mid-calculation.
// The first install does not take over the page that registered it (that page already runs the same code).

const CACHE = "__CACHE__";
const PRECACHE = __PRECACHE__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // no-cache: revalidate with the server (ETag) instead of trusting the HTTP cache, which may hold an older
      // build of the unhashed engine files; unchanged files cost a 304, not a download.
      cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "no-cache" }))),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith("pascaline-")).map((k) => caches.delete(k)))));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // ignoreSearch: "/?x=1" is the same page as "/". ignoreVary: servers send "Vary: Origin" and module scripts
      // are fetched with an Origin header, which the install-time requests did not have; the files are the same.
      const hit = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
      if (hit) return hit;
      if (req.mode === "navigate") {
        const index = await cache.match("index.html", { ignoreVary: true });
        if (index) return index;
      }
      return fetch(req);
    }),
  );
});
