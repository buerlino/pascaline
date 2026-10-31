// SPDX-License-Identifier: GPL-3.0-or-later
// The kill switch (A49). If a deployed service worker misbehaves, serve THIS file at the same URL as sw.js (the Pages workflow's
// input `kill` copies it over dist/sw.js before the upload; app/pwa/README.md). Browsers check the worker's URL for a changed script; this one takes over at once, deletes
// every cache of ours and unregisters itself. The page's next load then comes from the network, with no worker. It does
// not reload open pages (the app registers sw.js on every load, so a reload would repeat this in a loop) and it has no
// fetch handler, so a page it controls is served by the network.
self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("pascaline-")).map((k) => caches.delete(k)));
      await self.registration.unregister();
    })(),
  );
});
