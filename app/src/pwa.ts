// SPDX-License-Identifier: GPL-3.0-or-later
// Registers the offline service worker (pwa/sw.js, written to dist/sw.js by vite-plugin-pwa-lite.ts).
// Loaded lazily from main.ts after the engine is ready, so it never delays the keypad or the first paint.

export interface PwaEnv {
  prod: boolean;
  hasServiceWorker: boolean;
  native: boolean;
  search: string;
}

/**
 * Only the plain web build registers: not the dev server, not inside the Capacitor shell (the APK already holds
 * every file), and not for ?bench= / ?engine= runs, which must measure and test the real network path.
 */
export function shouldRegister(env: PwaEnv): boolean {
  if (!env.prod || !env.hasServiceWorker || env.native) return false;
  const q = new URLSearchParams(env.search);
  return !q.has("bench") && !q.has("engine");
}

export function registerServiceWorker(): void {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  const ok = shouldRegister({
    prod: import.meta.env.PROD,
    hasServiceWorker: "serviceWorker" in navigator,
    native: cap?.isNativePlatform?.() === true,
    search: location.search,
  });
  if (!ok) return;
  // sw.js sits next to index.html; base is "./" so this resolves against the page URL.
  navigator.serviceWorker.register(new URL("sw.js", document.baseURI)).catch(() => {
    /* offline support is a bonus; the app works without it */
  });
}
