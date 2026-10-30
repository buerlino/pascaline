# pwa/

`sw.js` is the offline worker's template (`vite-plugin-pwa-lite.ts` fills it in and writes `dist/sw.js`). `kill/sw.js` is the kill switch: if a deployed worker misbehaves, copy it over `sw.js` on the server (same URL, same path: `cp app/pwa/kill/sw.js <webroot>/sw.js`); every browser that checks for an update then drops our caches and unregisters, and the next load comes from the network. Put the real `dist/sw.js` back once the cause is fixed.
