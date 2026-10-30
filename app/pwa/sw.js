// SPDX-License-Identifier: GPL-3.0-or-later
// Service worker template. vite-plugin-pwa-lite.ts fills in the two placeholders below at build time and writes
// the result to dist/sw.js. Plain JS on purpose: it is served as is.
//
// Offline: everything the build produced (app chunks, lazy chunks, giac.wasm, fonts, icons) is
// stored in one versioned cache when the worker installs, and served from it first. After one online visit the
// app starts, computes with no network.
//
// Updates: no skipWaiting of its own and no clients.claim. A new version installs in the background and waits; the page
// shows an update line (A49), and only its Restart button posts "skipWaiting" (the code is never replaced under a user
// who types). Without a tap it takes effect once every window of the old one is closed. The first install does not take
// over the page that registered it (that page already runs the same code).
//
// The engine files are named by their content hash (giac.<16 hex>.mjs, vite-plugin-pwa-lite.ts). The install fetches each
// one, compares the SHA-256 with its name and fails when a file is missing or differs: a new giac.mjs meeting a stale
// giac.wasm from a CDN cache never gets cached as a pair. A failed install leaves no cache and the old version running.
// A worker that misbehaves is switched off by pwa/kill/sw.js served at this URL.

const CACHE = "__CACHE__";
const PRECACHE = __PRECACHE__;

const ENGINE = /^engine\/giac\.([0-9a-f]{16})\.[a-z]+$/;

async function sha16(bytes) {
  const sum = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(sum.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function precache() {
  const cache = await caches.open(CACHE);
  try {
    // no-cache: revalidate with the server (ETag) instead of trusting the HTTP cache, which may hold an older
    // build of a file; unchanged files cost a 304, not a download.
    const req = (url) => new Request(url, { cache: "no-cache" });
    await cache.addAll(PRECACHE.filter((u) => !ENGINE.test(u)).map(req));
    for (const url of PRECACHE.filter((u) => ENGINE.test(u))) {
      const res = await fetch(req(url));
      if (!res.ok) throw new Error(`${url}: ${res.status}`);
      const copy = res.clone();
      if ((await sha16(await res.arrayBuffer())) !== ENGINE.exec(url)[1]) throw new Error(`${url}: not the file its name says`);
      await cache.put(url, copy);
    }
  } catch (e) {
    await caches.delete(CACHE);
    throw e;
  }
}

self.addEventListener("install", (event) => event.waitUntil(precache()));

// the page's Restart button (src/pwa.ts)
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") void self.skipWaiting();
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
