// SPDX-License-Identifier: GPL-3.0-or-later
// The only door from the start chunk into the key names (R41, keyboard/keyNames.ts). They load after the first paint, so the
// start chunk carries neither the table nor the code; until they are in, a button is named by its face, as before.
type KeyNames = typeof import("./keyNames.ts");

let loading: Promise<void> | undefined;
let names = $state.raw<KeyNames | undefined>(undefined);

/** The names, once they are loaded (reactive), else undefined. */
export const keyNames = (): KeyNames | undefined => names;

/** Start loading the names (once), when the browser is idle. */
export function loadKeyNames(): void {
  if (loading) return;
  loading = new Promise<void>((done) => {
    const go = (): void => {
      void import("./keyNames.ts").then((m) => {
        names = m;
        done();
      });
    };
    if (typeof requestIdleCallback === "function") requestIdleCallback(go, { timeout: 1500 });
    else setTimeout(go, 200);
  });
}
