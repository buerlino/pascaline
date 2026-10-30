// SPDX-License-Identifier: GPL-3.0-or-later
// The About screen's data (R87), loaded from its own chunk when a level that needs it is first drawn, so the start
// chunk carries none of it (vite-plugin-about.ts builds it from package.json, THIRD_PARTY.md and LICENSES/).
import type about from "virtual:about";

export type AboutData = typeof about;

let data = $state.raw<AboutData | null>(null);
let load: Promise<void> | null = null;

/** The data once the chunk has loaded, else null (and the load starts). Read inside a draw, it redraws on arrival. */
export function aboutData(): AboutData | null {
  load ??= import("virtual:about").then(
    (m) => void (data = m.default),
    () => void (load = null), // offline cache miss: the next look asks again
  );
  return data;
}

/** The load while the data is not in, else null: the keys pressed on a level that shows Loading… wait for it (R8). */
export function aboutLoading(): Promise<void> | null {
  return aboutData() === null ? load : null;
}
