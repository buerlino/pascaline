// SPDX-License-Identifier: GPL-3.0-or-later
// Registers the offline service worker (pwa/sw.js, written to dist/sw.js by vite-plugin-pwa-lite.ts).
// Loaded lazily from main.ts after the engine is ready, so it never delays the keypad or the first paint.
// Updates (A49): a new worker that installs while an old one controls the page waits; the update line (App.svelte) offers
// Restart, which posts "skipWaiting" to it and reloads on `controllerchange`. Nothing reloads the page by itself.
// The offer is a button in the status line (App.svelte, from updateOffer); this lazy chunk only sets it.

import { updateOffer } from "./state/updateOffer.svelte.ts";

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
  navigator.serviceWorker
    .register(new URL("sw.js", document.baseURI))
    .then(watch)
    .catch(() => {
      /* offline support is a bonus; the app works without it */
    });
}

/** Offer the update when a new worker waits; look for one whenever the page comes back to the front. */
function watch(reg: ServiceWorkerRegistration): void {
  const sw = navigator.serviceWorker;
  let reloaded = false;
  const reload = (): void => {
    if (!reloaded) location.reload();
    reloaded = true;
  };
  const offer = (waiting: ServiceWorker): void => {
    // A later deploy can make this worker redundant while the line is up: the tap acts on the worker that waits then.
    updateOffer.restart = () => {
      const w = reg.waiting ?? waiting;
      // only this tap reloads; another tab's restart leaves this page to its own code until the user chooses.
      // A page the old worker never controlled (it registered it in this visit) gets no controllerchange: the new
      // worker's own activation is the sign too.
      if (w.state === "activated") return reload(); // the browser let it through: nothing used the old one
      sw.addEventListener("controllerchange", reload);
      w.addEventListener("statechange", () => w.state === "activated" && reload());
      w.postMessage("skipWaiting");
    };
  };
  // a worker that waits behind an active one is an update; the first install has none and activates at once
  if (reg.waiting && reg.active) offer(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const next = reg.installing;
    next?.addEventListener("statechange", () => next.state === "installed" && reg.active && offer(next));
  });
  document.addEventListener("visibilitychange", () => !document.hidden && void reg.update().catch(() => {}));
}
