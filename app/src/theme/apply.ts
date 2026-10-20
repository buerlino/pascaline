// SPDX-License-Identifier: GPL-3.0-or-later
// Sets the theme (R50c): loads the family's lazy CSS file first, then the root's attributes, so no frame shows a
// family without its tokens. Pascaline's two start blocks are in style.css; its transforms are in pascaline.css.
// Nothing in the app calls this yet; R50e's setting will.

export type Family = "pascaline" | "graphite" | "solarized" | "gruvbox" | "nord";
export interface Theme {
  family: Family;
  brightness: "dark" | "light";
  contrast: "normal" | "high";
  keys: "colour" | "plain";
}

/** Loads a family's CSS file (Vite injects its stylesheet when the import resolves). */
export type Loader = (family: Family) => Promise<unknown>;

const FILES: Record<Family, () => Promise<unknown>> = {
  pascaline: () => import("./pascaline.css"),
  graphite: () => import("./graphite.css"),
  solarized: () => import("./solarized.css"),
  gruvbox: () => import("./gruvbox.css"),
  nord: () => import("./nord.css"),
};
const defaultLoader: Loader = (family) => FILES[family]();

/** The rules of the two switches (R50d), in one file, loaded with either switch (the injected family loader is separate). */
const loadModes = (): Promise<unknown> => import("./modes.css");

/** Does the theme need its family's file? Pascaline's plain look is in style.css already. */
export const needsFile = (t: Theme): boolean => t.family !== "pascaline" || t.contrast === "high" || t.keys === "plain";

/** The attributes, set on `root` after the file is in. A failed load leaves the attributes as they were and rejects. */
export async function applyTheme(t: Theme, root: HTMLElement = document.documentElement, load: Loader = defaultLoader, modes: () => Promise<unknown> = loadModes): Promise<void> {
  if (needsFile(t)) await load(t.family);
  if (t.contrast === "high" || t.keys === "plain") await modes();
  root.setAttribute("data-family", t.family);
  root.setAttribute("data-brightness", t.brightness);
  if (t.contrast === "high") root.setAttribute("data-contrast", "high");
  else root.removeAttribute("data-contrast");
  if (t.keys === "plain") root.setAttribute("data-keys", "plain");
  else root.removeAttribute("data-keys");
}
