// SPDX-License-Identifier: GPL-3.0-or-later
// Puts a look on the page (R50e): applyTheme, then the localStorage mirror the inline script of index.html reads
// before the first paint, and `<meta name="theme-color">` (the screen colour). A lazy chunk: the start only needs
// theme/look.ts. While the brightness is System, a change of the phone's scheme is followed.
import { applyTheme, type Theme } from "./apply.ts";
import type { Look } from "./look.ts";

/** The localStorage key of the mirror the inline script reads: `{ family, brightness, contrast, plain, bg }` (bg: the
 *  screen colour, for `<meta name="theme-color">`). IndexedDB stays the source. */
export const LOOK_KEY = "pascaline.look";

/** What applyTheme gets: System follows the phone (`systemLight`). */
export function themeOf(look: Look, systemLight: boolean): Theme {
  const light = look.brightness === "system" ? systemLight : look.brightness === "light";
  return { family: look.family, brightness: light ? "light" : "dark", contrast: look.contrast ? "high" : "normal", keys: look.plain ? "plain" : "colour" };
}

const scheme = (): MediaQueryList | null => (typeof matchMedia === "function" ? matchMedia("(prefers-color-scheme: light)") : null);
let current: Look | null = null;
let watching = false;

/** Every read and write of localStorage can throw (a blocked store, a private window): then the first frame is the default. */
function mirror(look: Look, bg: string): void {
  try {
    localStorage.setItem(LOOK_KEY, JSON.stringify({ ...look, bg }));
  } catch {
    /* not mirrored: IndexedDB still holds the setting */
  }
}

async function put(look: Look): Promise<void> {
  const root = document.documentElement;
  await applyTheme(themeOf(look, scheme()?.matches === true), root);
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  mirror(look, bg);
}

/** Show `look`. A later call wins over an earlier one still loading (applyTheme). */
export async function applyLook(look: Look): Promise<void> {
  current = look;
  if (!watching) {
    watching = true;
    scheme()?.addEventListener?.("change", () => {
      if (current?.brightness === "system") void put(current).catch(() => {});
    });
  }
  await put(look);
}
