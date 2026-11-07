// SPDX-License-Identifier: GPL-3.0-or-later
// The theme generator (R50c): writes every theme value from the families' own colours (theme-families.ts) by the
// contrast rules of docs/archive/shifts/2026-10-18-themes-report.md section 2. Output:
//   - the two start blocks of N62 in src/style.css (replaced in place), and
//   - src/theme/<family>.css, one lazy file per family with all its combinations ([data-contrast="high"],
//     [data-keys="plain"] and both; the other four families' plain light/dark blocks too).
//   node scripts/theme-gen.ts            # write (npm run themes)
//   node scripts/theme-gen.ts --check    # exit 1 when a file is out of date
//   node scripts/theme-gen.ts --audit    # one line per combination (what tools/probes/themes-audit.mjs prints)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { apart, CVD } from "./cvd.ts";
import { FAMILIES, type Family, type Palette } from "./theme-families.ts";

export const KEYS = ["key-num", "key-op", "key-fn", "key-ctl", "key-nav"] as const;
export type Brightness = "dark" | "light";

// --- colour maths (sRGB, WCAG 2 contrast) -------------------------------------------------------
const hex2rgb = (h: string): number[] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c: number[]): string => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
export function lum(h: string): number {
  const c = hex2rgb(h).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (c[0] as number) + 0.7152 * (c[1] as number) + 0.0722 * (c[2] as number);
}
export function cr(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return ((x as number) + 0.05) / ((y as number) + 0.05);
}
function mix(a: string, b: string, t: number): string {
  const p = hex2rgb(a);
  const q = hex2rgb(b);
  return rgb2hex(p.map((v, i) => v + ((q[i] as number) - v) * t));
}
function rgb2hsl(h: string): [number, number, number] {
  const [r, g, b] = hex2rgb(h).map((v) => v / 255) as [number, number, number];
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  let hh = 0;
  let s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hh /= 6;
  }
  return [hh, s, l];
}
function hsl2hex([h, s, l]: [number, number, number]): string {
  const f = (p: number, q: number, t0: number): number => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
  };
  if (s === 0) return rgb2hex([l, l, l].map((v) => v * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return rgb2hex([f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)].map((v) => v * 255));
}
function desat(h: string, k: number): string {
  const [hh, s, l] = rgb2hsl(h);
  return hsl2hex([hh, s * k, l]);
}
/** Move fg's lightness away from the backgrounds (hue and saturation kept) until it reaches min on all of them. */
function ensure(fg: string, bgs: string[], min: number, dark: boolean): string {
  if (bgs.every((b) => cr(fg, b) >= min)) return fg;
  const [h, s, l0] = rgb2hsl(fg);
  for (let i = 1; i <= 200; i++) {
    const l = dark ? Math.min(1, l0 + i * 0.005) : Math.max(0, l0 - i * 0.005);
    const c = hsl2hex([h, s, l]);
    if (bgs.every((b) => cr(c, b) >= min)) return c;
  }
  return dark ? "#ffffff" : "#000000";
}
/** A role's value; a missing one is a bug in the family data. */
const get = (t: Palette, role: string): string => {
  const v = t[role];
  if (v === undefined) throw new Error(`theme-gen: no --${role}`);
  return v;
};
const getAll = (t: Palette, roles: readonly string[]): string[] => roles.map((r) => get(t, r));

// --- the roles with a key twin (R150) ----------------------------------------------------------
/**
 * Legends on the keys and legends on the screen can need different colours (Teal: near-black on the teal screen, light on
 * its near-black keys). These five roles may have a twin `key-<role>` for the keys; a family that gives none has the twin
 * equal to the role, and then the role is checked against the keys and the screen together, as before R150.
 */
export const TWINS = ["text", "muted", "text-dead", "shift", "alpha"] as const;
const keyOf = (r: string): string => `key-${r}`;
/** Does role `r` have its own colour on the keys? */
const isSplit = (t: Palette, r: string): boolean => t[keyOf(r)] !== undefined && t[keyOf(r)] !== t[r];
/** Is the text on the screen lighter than the screen (a dark theme)? Decides which way the screen's colours move. */
const lightInk = (t: Palette): boolean => lum(get(t, "text")) > lum(get(t, "bg"));
/** The same for the legends on the keys. */
const lightKeyInk = (t: Palette): boolean => lum(get(t, "key-text")) > lum(get(t, "key-num"));
/**
 * Sets role `r` and its key twin in `o` from `from`: the role against the screen's grounds `scr` (and the keys' `keys` too
 * when it has no twin of its own), the twin against `keys`; `sd` and `kd` say which way each moves (true: lighter).
 */
function legend(o: Palette, from: Palette, r: string, scr: readonly string[], keys: readonly string[], min: number, sd: boolean, kd: boolean): void {
  const split = isSplit(from, r);
  o[r] = ensure(get(from, r), getAll(o, split ? scr : [...scr, ...keys]), min, sd);
  o[keyOf(r)] = split ? ensure(get(from, keyOf(r)), getAll(o, keys), min, kd) : get(o, r);
}
const SCREEN = ["bg", "panel", "pick", "chip-bg"];

// --- the base palette after the contrast floor ------------------------------------------------
/** A family's own value is kept when it passes; otherwise only its lightness moves until it does. `fixes` lists what moved. */
export function base(fam: Family, brightness: Brightness): { t: Palette; fixes: [string, string, string][] } {
  const t: Palette = { ...fam[brightness] };
  const fixes: [string, string, string][] = [];
  const sd = lightInk(t);
  const split = new Set<string>(TWINS.filter((r) => isSplit(t, r)));
  const has = (r: string): boolean => split.has(r);
  const kd = t["key-text"] === undefined ? sd : lightKeyInk(t);
  const set = (role: string, v: string): void => {
    if (v !== t[role]) {
      fixes.push([role, get(t, role), v]);
      t[role] = v;
    }
  };
  const fix = (role: string, bgs: readonly string[], min: number, up: boolean): void => set(role, ensure(get(t, role), getAll(t, bgs), min, up));
  // the picked row's ground moves away from the text rather than the text (black cannot go further)
  set("pick", ensure(get(t, "pick"), [get(t, "text")], 4.5, lum(get(t, "text")) < 0.5));
  fix("text", [...(has("text") ? [] : KEYS), ...SCREEN], 4.5, sd);
  if (has("text")) fix(keyOf("text"), KEYS, 4.5, kd);
  fix("muted", ["bg", "panel", "pick", ...(has("muted") ? [] : ["key-num"])], 4.5, sd);
  if (has("muted")) fix(keyOf("muted"), ["key-num"], 4.5, kd);
  for (const r of ["shift", "alpha"]) {
    fix(r, ["panel", ...(has(r) ? [] : KEYS)], 4.5, sd);
    if (has(r)) fix(keyOf(r), KEYS, 4.5, kd);
  }
  fix("alpha", ["pick"], 3, sd); // the caret in the bracket's box (non-text)
  for (const r of ["approx", "warn", "error"]) fix(r, ["bg", "pick"], 4.5, sd);
  fix("focus", ["bg", "panel"], 3, sd);
  fix("text-dead", ["panel", ...(has("text-dead") ? [] : KEYS)], 3, sd);
  if (has("text-dead")) fix(keyOf("text-dead"), KEYS, 3, kd);
  for (const r of TWINS) if (!has(r)) t[keyOf(r)] = get(t, r);
  // on-enter: the key moves rather than the label, so the label keeps the family's colour
  if (cr(get(t, "on-enter"), get(t, "key-enter")) < 4.5) {
    const v = ensure(get(t, "key-enter"), [get(t, "on-enter")], 4.5, lum(get(t, "on-enter")) < 0.5);
    fixes.push(["key-enter", get(t, "key-enter"), v]);
    t["key-enter"] = v;
  }
  if (cr(get(t, "on-key-on"), get(t, "key-on")) < 4.5) {
    const v = ensure(get(t, "on-key-on"), [get(t, "key-on")], 4.5, lum(get(t, "key-on")) < 0.2);
    fixes.push(["on-key-on", get(t, "on-key-on"), v]);
    t["on-key-on"] = v;
  }
  return { t, fixes };
}

/** A key's fill moves away from its label until `min`; when the fill cannot (black under a teal label), the label moves instead. */
function apartPair(fill: string, label: string, min: number): [string, string] {
  const up = lum(label) < lum(fill);
  const f = ensure(fill, [label], min, up);
  return cr(f, label) >= min ? [f, label] : [f, ensure(label, [f], min, !up)];
}

// --- High contrast: grounds pushed away from the ink (a mid-tone screen is lightened along its hue instead), text at 7:1, legends at 7:1, a strong key outline ---
export function highContrast(t: Palette): Palette {
  const o: Palette = { ...t };
  const sd = lightInk(t);
  const kd = lightKeyInk(t);
  const [extS, inkS] = sd ? ["#000000", "#ffffff"] : ["#ffffff", "#000000"];
  const [extK, inkK] = kd ? ["#000000", "#ffffff"] : ["#ffffff", "#000000"];
  const textHC = mix(get(t, "text"), inkS, 0.8);
  // a screen whose own ink cannot reach 7:1 on it (Teal: black on #529997 is 6.4:1) is lightened along its hue until it does
  o["bg"] = !sd && cr(textHC, get(t, "bg")) < 7 ? moveUntil(get(t, "bg"), true, (c) => cr(textHC, c) >= 7) : mix(get(t, "bg"), extS, 0.65);
  o["panel"] = mix(get(t, "panel"), extS, 0.5);
  o["pick"] = mix(get(t, "pick"), extS, 0.3);
  for (const k of KEYS) o[k] = mix(get(t, k), extK, kd ? 0.45 : 0.6);
  o["chip-bg"] = mix(get(t, "chip-bg"), extS, 0.35);
  const split = isSplit(t, "text");
  const from: Palette = { ...t, text: textHC, "key-text": split ? mix(get(t, "key-text"), inkK, 0.8) : textHC };
  legend(o, from, "text", SCREEN, KEYS, 7, sd, kd);
  legend(o, t, "muted", ["bg", "panel", "pick"], ["key-num"], 7, sd, kd);
  for (const r of ["shift", "alpha"]) legend(o, t, r, ["panel"], KEYS, 7, sd, kd);
  for (const r of ["approx", "warn", "error"]) o[r] = ensure(get(t, r), getAll(o, ["bg", "pick"]), 7, sd);
  legend(o, t, "text-dead", ["panel"], KEYS, 4.5, sd, kd);
  o["line"] = ensure(mix(get(t, "line"), inkS, 0.25), getAll(o, ["bg", ...KEYS]), 3, sd);
  o["focus"] = ensure(get(t, "focus"), getAll(o, ["bg", "panel"]), 4.5, sd);
  [o["key-enter"], o["on-enter"]] = apartPair(get(t, "key-enter"), get(t, "on-enter"), 7);
  [o["key-on"], o["on-key-on"]] = apartPair(get(t, "key-on"), get(t, "on-key-on"), 7);
  return o;
}

// --- Plain keys: no colour coding. One neutral tone for every key, the digit block one step brighter,
// legends in the text colour (Shift bold, Alpha italic), Enter inverted. ⚠ and errors keep their colour.
// The key legends use `key-text`, the screen's marks `text`.
export function plain(t: Palette): Palette {
  const o: Palette = { ...t };
  const sd = lightInk(t);
  const kd = lightKeyInk(t);
  const split = isSplit(t, "text");
  const k1 = desat(get(t, "key-num"), 0.35);
  const k2 = desat(mix(get(t, "key-num"), get(t, "bg"), 0.5), 0.35);
  o["key-num"] = k1;
  for (const k of ["key-op", "key-fn", "key-ctl", "key-nav"]) o[k] = k2;
  o["shift"] = get(t, "text");
  o["alpha"] = get(t, "text");
  o["key-shift"] = get(t, "key-text");
  o["key-alpha"] = get(t, "key-text");
  o["approx"] = get(t, "text");
  o["key-enter"] = get(t, "key-text");
  o["on-enter"] = split ? k1 : get(t, "bg");
  o["key-on"] = get(t, "key-text");
  o["on-key-on"] = split ? k1 : get(t, "bg");
  o["focus"] = get(t, "text");
  o["chip-bg"] = split ? get(t, "chip-bg") : k2;
  o["pick"] = mix(get(t, "bg"), get(t, "text"), 0.1);
  // text-dead must stay dimmer than live text but readable on both tones
  if (isSplit(t, "text-dead")) {
    o["text-dead"] = ensure(get(t, "text-dead"), [get(o, "panel")], 3, sd);
    o["key-text-dead"] = ensure(get(t, "key-text-dead"), [k1, k2], 3, kd);
  } else {
    o["text-dead"] = ensure(get(t, "text-dead"), [k1, k2, get(o, "panel")], 3, sd);
    o["key-text-dead"] = get(o, "text-dead");
  }
  return o;
}

/**
 * The unit pad's prefix cells (R24b) get their own key colour, derived last from the final key colours: the Enter
 * colour in the digit key's, as much as the legends allow (34 % down); where the Enter colour leaves no room (a dark
 * theme with a bright Enter), the digit key moved toward --bg. Either way text, Shift, Alpha and a dead face keep the
 * floors of every other key, so no theme can fall below them; --key-num itself is the last resort.
 */
function withPfx(t: Palette, hc: boolean): Palette {
  const [floor, dead] = hc ? [7, 4.5] : [4.5, 3];
  const ok = (c: string): boolean =>
    ["text", "shift", "alpha"].every((f) => cr(get(t, keyOf(f)), c) >= floor) && cr(get(t, "key-text-dead"), c) >= dead && cr(get(t, "key-text-dead"), c) <= cr(get(t, "key-text"), c) - 1;
  for (const to of ["key-enter", "bg"])
    for (let share = to === "bg" ? 0.5 : 0.34; share > 0.05; share -= 0.02) {
      const c = mix(get(t, "key-num"), get(t, to), share);
      if (ok(c)) return { ...t, "key-pfx": c };
    }
  return { ...t, "key-pfx": get(t, "key-num") };
}

/** How far the box of the bracket that holds the cursor (--pick, R116) stands from the entry line's --panel: 1.13 on
 *  N62 Dark was "not seen well" on the Tab One (night review 2026-11-02). src/style.test.ts uses the same floor. */
export const PICK_APART = 1.3;
/** Below this HSL saturation a colour reads as grey and its hue as none (the caret's hue is then not given to the box). */
export const HUE_SAT = 0.15;
/** The caret and the box are one hue family: at most this far apart in hue (degrees) when both have a hue (R116). */
export const HUE_NEAR = 40;
/**
 * R116: --pick is also the box MathLive draws round the bracket that holds the cursor, on the entry line's --panel.
 * It takes --alpha's hue (the caret's), then its lightness moves away from --panel (hue and saturation kept) until the box stands PICK_APART from it; the roles
 * drawn on a picked row then move as their own floors need (text, muted, the marks: R50b's pairs, unchanged).
 */
function withPick(t: Palette, hc: boolean): Palette {
  const o: Palette = { ...t };
  const sd = lightInk(t);
  const kd = lightKeyInk(t);
  const T = hc ? 7 : 4.5;
  // the box takes the caret's (--alpha's) hue, saturation and lightness kept: caret, box and selection one hue family
  // (Gruvbox Light drew a teal caret in a yellow box, the "blue and yellow" moved to another family; audit of run 519)
  const [ah, as] = rgb2hsl(get(o, "alpha"));
  if (as >= HUE_SAT) {
    const [, ps, pl] = rgb2hsl(get(o, "pick"));
    o["pick"] = hsl2hex([ah, ps, pl]);
  }
  if (cr(get(o, "pick"), get(o, "panel")) < PICK_APART) {
    const [h, s, l0] = rgb2hsl(get(o, "pick"));
    for (let i = 1; i <= 200; i++) {
      const c = hsl2hex([h, s, sd ? Math.min(1, l0 + i * 0.005) : Math.max(0, l0 - i * 0.005)]);
      o["pick"] = c;
      if (cr(c, get(o, "panel")) >= PICK_APART) break;
    }
  }
  legend(o, o, "text", SCREEN, KEYS, T, sd, kd);
  legend(o, o, "muted", ["bg", "panel", "pick"], ["key-num"], T, sd, kd);
  for (const r of ["approx", "warn", "error"]) o[r] = ensure(get(o, r), getAll(o, ["bg", "pick"]), T, sd);
  // R150: a picked row's ground moves away from the text when the text cannot (black on Teal)
  o["pick"] = ensure(get(o, "pick"), [get(o, "text")], T, lum(get(o, "text")) < 0.5);
  return o;
}

/** The label on an --error ground (Cancel and the like): the family's --bg in dark, white in light. Set last, from the final --bg. */
function withOnError(t: Palette, dark: boolean): Palette {
  return { ...t, "on-error": dark ? get(t, "bg") : "#ffffff" };
}

/** R140: the label on an armed Shift or Alpha key (the key fills with the layer's colour): black or white, whichever reads better (always at least 4.5:1). Set last, from the final colours. */
function withOnLayer(t: Palette): Palette {
  const on = (c: string): string => (cr("#000000", c) >= cr("#ffffff", c) ? "#000000" : "#ffffff");
  return { ...t, "on-shift": on(get(t, "shift")), "on-alpha": on(get(t, "alpha")), "on-key-shift": on(get(t, "key-shift")), "on-key-alpha": on(get(t, "key-alpha")) };
}

/**
 * R140: Shift and Alpha stay this far apart (OKLab, scripts/cvd.ts) for protanopia, deuteranopia and tritanopia, and ⚠
 * this far from Shift for normal vision. High contrast puts all four at 7:1 on the same keys, which squeezes them into
 * a narrow band: N62 Light's Shift and Alpha reach 0.105 there at best (a darker Shift needs #5c2800, which then
 * crowds ⚠), so its floors are lower.
 */
export const LAYER_APART = { normal: 0.12, high: 0.1 } as const;
export const WARN_APART = { normal: 0.08, high: 0.06 } as const;
/** `fg`'s lightness moved away from the backgrounds (hue and saturation kept, so every floor it meets only improves) until `ok` holds; fg itself when it already does or never does. */
function moveUntil(fg: string, dark: boolean, ok: (c: string) => boolean): string {
  if (ok(fg)) return fg;
  const [h, s, l0] = rgb2hsl(fg);
  for (let i = 1; i <= 200; i++) {
    const c = hsl2hex([h, s, dark ? Math.min(1, l0 + i * 0.005) : Math.max(0, l0 - i * 0.005)]);
    if (ok(c)) return c;
  }
  return fg;
}
/**
 * R140: if Shift and Alpha come closer than LAYER_APART for any of the three colour-vision deficiencies, Shift moves away
 * from the keys until they do not; the same for ⚠ against Shift. Plain keys draws Shift and Alpha in the text colour on
 * purpose and is left alone.
 */
function withLayersApart(t: Palette, high: boolean): Palette {
  const k = high ? "high" : "normal";
  const sd = lightInk(t);
  const kd = lightKeyInk(t);
  const o: Palette = { ...t };
  const away = (alpha: string, up: boolean, from: string): string =>
    moveUntil(from, up, (c) => Math.min(...Object.values(CVD).map((m) => apart(c, alpha, m))) >= LAYER_APART[k]);
  o["shift"] = away(get(t, "alpha"), sd, get(t, "shift"));
  // R150: the keys' own Shift and Alpha (Teal) are held apart the same way; without a twin they follow the screen's
  o["key-shift"] = isSplit(t, "shift") || isSplit(t, "alpha") ? away(get(t, "key-alpha"), kd, get(t, "key-shift")) : get(o, "shift");
  o["warn"] = moveUntil(get(t, "warn"), sd, (c) => apart(c, get(o, "shift")) >= WARN_APART[k]);
  return o;
}

export interface Combo {
  family: string;
  brightness: Brightness;
  high: boolean;
  plain: boolean;
}
export function selector(c: Combo): string {
  return `:root[data-family="${c.family}"][data-brightness="${c.brightness}"]${c.high ? '[data-contrast="high"]' : ""}${c.plain ? '[data-keys="plain"]' : ""}`;
}
/** The 24 combinations: 3 families × dark/light × High contrast × Plain keys. */
export function combos(): Combo[] {
  return FAMILIES.flatMap((f) => (["dark", "light"] as const).flatMap((brightness) => [false, true].flatMap((high) => [false, true].map((pl) => ({ family: f.id, brightness, high, plain: pl })))));
}
export function theme(c: Combo): { t: Palette; fixes: [string, string, string][] } {
  const fam = FAMILIES.find((f) => f.id === c.family);
  if (fam === undefined) throw new Error(`theme-gen: no family ${c.family}`);
  const dark = c.brightness === "dark";
  const { t, fixes } = base(fam, c.brightness);
  let o = t;
  if (c.plain) o = plain(o);
  if (c.high) o = highContrast(o);
  if (!c.plain) o = withLayersApart(o, c.high);
  return { t: withOnLayer(withOnError(withPfx(withPick(o, c.high), c.high), dark)), fixes };
}

// --- the audit: every pair the app draws (docs/archive/shifts/2026-10-18-themes-report.md section 2) ---
export interface Check {
  g: string;
  l: string;
  f: string;
  b: string;
  min: number;
  v: number;
}
export function checks(t: Palette, hc: boolean): Check[] {
  const out: Check[] = [];
  const T = hc ? 7 : 4.5;
  const D = hc ? 4.5 : 3;
  const add = (g: string, l: string, f: string, b: string, min: number): void => {
    out.push({ g, l, f, b, min, v: cr(get(t, f), get(t, b)) });
  };
  add("Screen", "text on screen", "text", "bg", T);
  add("Screen", "input line (muted) on screen", "muted", "bg", T);
  add("Screen", "error text on screen", "error", "bg", T);
  add("Screen", "≈ mark on screen", "approx", "bg", T);
  add("Screen", "⚠ mark on screen", "warn", "bg", T);
  add("Screen", "text on the picked row", "text", "pick", T);
  add("Screen", "muted on the picked row", "muted", "pick", T);
  add("Screen", "text on the status line", "text", "panel", T);
  add("Screen", "text on a chip", "text", "chip-bg", T);
  add("Screen", "focus ring on screen (non-text)", "focus", "bg", 3);
  // R116: the entry line (App.svelte maps MathLive's highlights): the caret is --alpha, the box of the bracket that
  // holds the cursor and the selection are --pick, both with --text on them
  add("Entry", "caret on the entry line", "alpha", "panel", T);
  add("Entry", "caret in the bracket's box (non-text)", "alpha", "pick", 3);
  add("Entry", "the bracket's box apart from the entry line", "pick", "panel", PICK_APART);
  for (const k of [...KEYS, "key-pfx"]) {
    for (const f of ["text", "shift", "alpha"]) add("Keys", `${f} on ${k}`, keyOf(f), k, T);
    add("Keys", `dead face on ${k}`, "key-text-dead", k, D);
  }
  add("Keys", "Enter label", "on-enter", "key-enter", T);
  add("Keys", "label of a key that is on", "on-key-on", "key-on", T);
  add("Screen", "label on an error ground (Cancel)", "on-error", "error", 4.5);
  add("Keys", "label of the armed Shift key", "on-shift", "shift", 4.5);
  add("Keys", "label of the armed Alpha key", "on-alpha", "alpha", 4.5);
  add("Keys", "label of the armed Shift key (the key's own Shift)", "on-key-shift", "key-shift", 4.5);
  add("Keys", "label of the armed Alpha key (the key's own Alpha)", "on-key-alpha", "key-alpha", 4.5);
  for (const [b, key] of [["panel", false], ["key-num", true]] as const) {
    for (const f of ["text", "shift", "muted"]) add("Sheet", `${f} on ${b}`, key ? keyOf(f) : f, b, T);
    add("Sheet", `disabled row on ${b}`, key ? "key-text-dead" : "text-dead", b, D);
  }
  if (hc) for (const k of KEYS) add("Keys", `key outline on screen around ${k} (non-text)`, "line", "bg", 3);
  return out;
}
/** A dimmed face is at least 1 below a live one on every key. */
export function dimmedOk(t: Palette): boolean {
  return [...KEYS, "key-pfx"].every((k) => cr(get(t, "key-text-dead"), get(t, k)) <= cr(get(t, "key-text"), get(t, k)) - 1);
}

// --- the files ---------------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
export const STYLE_CSS = join(here, "../src/style.css");
export const THEME_DIR = join(here, "../src/theme");

/** One block; the first (N62, no transform) ones in style.css carry their long comment elsewhere. */
export function block(c: Combo): string {
  const { t } = theme(c);
  return `${selector(c)} {\n${Object.entries(t).map(([k, v]) => `  --${k}: ${v};`).join("\n")}\n  color-scheme: ${colorScheme(t)};\n}\n`;
}

/** The UA colour scheme (scrollbars, native controls): light when the screen's text is dark, whatever the family's brightness
 *  name says, so Teal Dark (black text on the teal screen) is `light` too (R150). */
export const colorScheme = (t: Palette): "light" | "dark" => (lightInk(t) ? "dark" : "light");

/** The content of src/theme/<family>.css. N62's untransformed blocks are in style.css, so they are not here. */
export function familyFile(id: string): string {
  const own = id === "n62" ? "its transforms (the two start blocks are in src/style.css)" : "all its combinations";
  const head = `/* SPDX-License-Identifier: GPL-3.0-or-later */\n/* GENERATED by scripts/theme-gen.ts (npm run themes): ${id}, ${own}. Do not edit; change theme-families.ts. Loaded by applyTheme (src/theme/). */\n`;
  const list = combos().filter((c) => c.family === id && !(id === "n62" && !c.high && !c.plain));
  return head + list.map(block).join("");
}
export const familyPath = (id: string): string => join(THEME_DIR, `${id}.css`);

const START = /:root\[data-family="n62"\]\[data-brightness="(dark|light)"\]\s*\{[^}]*\}\n/g;
/** style.css with N62's two start blocks replaced by the generated ones. */
export function styleFile(source: string): string {
  const gen = (b: Brightness): string => block({ family: "n62", brightness: b, high: false, plain: false });
  if ([...source.matchAll(START)].length !== 2) throw new Error("theme-gen: style.css must hold exactly N62's two start blocks");
  return source.replace(START, (_m, b: string) => gen(b === "light" ? "light" : "dark"));
}

/** Every generated file: path → content it should have. */
export function expected(): Map<string, string> {
  const out = new Map<string, string>();
  out.set(STYLE_CSS, styleFile(readFileSync(STYLE_CSS, "utf8")));
  for (const f of FAMILIES) out.set(familyPath(f.id), familyFile(f.id));
  return out;
}

/** The paths whose content differs from what the generator writes. */
export function outOfDate(): string[] {
  return [...expected()].filter(([p, content]) => !existsSync(p) || readFileSync(p, "utf8") !== content).map(([p]) => p);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = process.argv[2];
  if (arg === "--audit") {
    let pass = 0;
    const all = combos();
    for (const c of all) {
      const { t } = theme(c);
      const cs = checks(t, c.high);
      const bad = cs.filter((x) => x.v < x.min);
      const ok = bad.length === 0 && dimmedOk(t);
      if (ok) pass++;
      console.log(`${ok ? "ok  " : "FAIL"} ${selector(c)}  ${cs.length} pairs${bad.length > 0 ? "  " + bad.map((x) => `${x.l} ${x.v.toFixed(2)} < ${x.min}`).join("; ") : ""}`);
    }
    console.log(`${pass}/${all.length} pass`);
    process.exitCode = pass === all.length ? 0 : 1;
  } else if (arg === "--check") {
    const stale = outOfDate();
    if (stale.length > 0) {
      console.error(`theme-gen: out of date (run npm run themes): ${stale.join(", ")}`);
      process.exitCode = 1;
    } else console.log("theme-gen: up to date");
  } else {
    mkdirSync(THEME_DIR, { recursive: true });
    for (const [p, content] of expected()) writeFileSync(p, content);
    console.log(`theme-gen: wrote ${expected().size} files`);
  }
}
