// SPDX-License-Identifier: GPL-3.0-or-later
// A lazy chunk that is gone after a deploy (A49): Vite fires `vite:preloadError`; the page reloads once to pick up the
// new index.html and its chunk names. A session flag with the time stops a loop (a chunk that stays missing): a second
// failure within a minute does not reload again. A reload keeps the user's line (main.ts saves it on pagehide).
const KEY = "pascaline.chunk-reload";
const WINDOW_MS = 60_000;

/** True when it asked for the reload: no reload in this session within the last minute. */
export function reloadOnMissingChunk(storage: Pick<Storage, "getItem" | "setItem">, now: number, reload: () => void): boolean {
  try {
    const last = Number(storage.getItem(KEY) ?? "0");
    if (now - last < WINDOW_MS) return false;
    storage.setItem(KEY, String(now));
  } catch {
    return false; // no session storage: a reload could loop
  }
  reload();
  return true;
}
