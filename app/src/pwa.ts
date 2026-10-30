// SPDX-License-Identifier: GPL-3.0-or-later
// Registers the offline service worker (pwa/sw.js, written to dist/sw.js by vite-plugin-pwa-lite.ts).
// Loaded lazily from main.ts after the engine is ready, so it never delays the keypad or the first paint.
// Updates (A49): a new worker that installs while an old one controls the page waits; the update line (App.svelte) offers
// Restart, which posts "skipWaiting" to it and reloads on `controllerchange`. Nothing reloads the page by itself.
// The line is drawn from here (a lazy chunk, with its component) so it costs the start chunk nothing.

import { mount } from "svelte";
import UpdateLine from "./views/UpdateLine.svelte";

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

/** The update line in the stage (App.svelte's `.stage`), under the engine's start note when that is on screen. */
export function showUpdateLine(restart: () => void): void {
  const stage = document.querySelector(".stage");
  if (!stage || stage.querySelector('[data-testid="update-note"]')) return;
  mount(UpdateLine, { target: stage, props: { restart, lower: stage.querySelector('[data-testid="engine-note"]') !== null } });
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
    showUpdateLine(() => {
      // only this tap reloads; another tab's restart leaves this page to its own code until the user chooses.
      // A page the old worker never controlled (it registered it in this visit) gets no controllerchange: the new
      // worker's own activation is the sign too.
      if (waiting.state === "activated") return reload(); // the browser let it through: nothing used the old one
      sw.addEventListener("controllerchange", reload);
      waiting.addEventListener("statechange", () => waiting.state === "activated" && reload());
      waiting.postMessage("skipWaiting");
    });
  };
  // a worker that waits behind an active one is an update; the first install has none and activates at once
  if (reg.waiting && reg.active) offer(reg.waiting);
  reg.addEventListener("updatefound", () => {
    const next = reg.installing;
    next?.addEventListener("statechange", () => next.state === "installed" && reg.active && offer(next));
  });
  document.addEventListener("visibilitychange", () => !document.hidden && void reg.update().catch(() => {}));
}
