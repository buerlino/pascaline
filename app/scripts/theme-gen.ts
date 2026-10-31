// SPDX-License-Identifier: GPL-3.0-or-later
// The theme generator (R50c): writes every theme value from the families' own colours (theme-families.ts) by the
// contrast rules of docs/shifts/2026-10-18-themes-report.md section 2. Output:
//   - the two start blocks of Pascaline in src/style.css (replaced in place), and
//   - src/theme/<family>.css, one lazy file per family with all its combinations ([data-contrast="high"],
//     [data-keys="plain"] and both; the other four families' plain light/dark blocks too).
//   node scripts/theme-gen.ts            # write (npm run themes)
//   node scripts/theme-gen.ts --check    # exit 1 when a file is out of date
//   node scripts/theme-gen.ts --audit    # one line per combination (what tools/probes/themes-audit.mjs prints)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

// --- the base palette after the contrast floor ------------------------------------------------
/** A family's own value is kept when it passes; otherwise only its lightness moves until it does. `fixes` lists what moved. */
export function base(fam: Family, brightness: Brightness): { t: Palette; fixes: [string, string, string][] } {
  const dark = brightness === "dark";
  const t: Palette = { ...fam[brightness] };
  const fixes: [string, string, string][] = [];
  const fix = (role: string, bgs: string[], min: number): void => {
    const v = ensure(get(t, role), getAll(t, bgs), min, dark);
    if (v !== t[role]) {
      fixes.push([role, get(t, role), v]);
      t[role] = v;
    }
  };
  fix("text", [...KEYS, "bg", "panel", "pick", "chip-bg"], 4.5);
  fix("muted", ["bg", "panel", "key-num", "pick"], 4.5);
  for (const r of ["shift", "alpha"]) fix(r, [...KEYS, "panel"], 4.5);
  for (const r of ["approx", "warn", "error"]) fix(r, ["bg", "pick"], 4.5);
  fix("focus", ["bg", "panel"], 3);
  fix("text-dead", [...KEYS, "panel"], 3);
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

// --- High contrast: darker (or lighter) grounds, text at 7:1, legends at 7:1, a strong key outline ---
export function highContrast(t: Palette, dark: boolean): Palette {
  const o: Palette = { ...t };
  const ext = dark ? "#000000" : "#ffffff";
  const ink = dark ? "#ffffff" : "#000000";
  o["bg"] = mix(get(t, "bg"), ext, 0.65);
  o["panel"] = mix(get(t, "panel"), ext, 0.5);
  o["pick"] = mix(get(t, "pick"), ext, 0.3);
  for (const k of KEYS) o[k] = mix(get(t, k), ext, dark ? 0.45 : 0.6);
  o["chip-bg"] = mix(get(t, "chip-bg"), ext, 0.35);
  o["text"] = mix(get(t, "text"), ink, 0.8);
  o["text"] = ensure(get(o, "text"), getAll(o, [...KEYS, "bg", "panel", "pick", "chip-bg"]), 7, dark);
  o["muted"] = ensure(get(t, "muted"), getAll(o, ["bg", "panel", "key-num", "pick"]), 7, dark);
  for (const r of ["shift", "alpha"]) o[r] = ensure(get(t, r), getAll(o, [...KEYS, "panel"]), 7, dark);
  for (const r of ["approx", "warn", "error"]) o[r] = ensure(get(t, r), getAll(o, ["bg", "pick"]), 7, dark);
  o["text-dead"] = ensure(get(t, "text-dead"), getAll(o, [...KEYS, "panel"]), 4.5, dark);
  o["line"] = ensure(mix(get(t, "line"), ink, 0.25), getAll(o, ["bg", ...KEYS]), 3, dark);
  o["focus"] = ensure(get(t, "focus"), getAll(o, ["bg", "panel"]), 4.5, dark);
  o["key-enter"] = ensure(get(t, "key-enter"), [get(t, "on-enter")], 7, lum(get(t, "on-enter")) < 0.5);
  o["key-on"] = ensure(get(t, "key-on"), [get(t, "on-key-on")], 7, lum(get(t, "on-key-on")) < 0.5);
  return o;
}

// --- Plain keys: no colour coding. One neutral tone for every key, the digit block one step brighter,
// legends in the text colour (Shift bold, Alpha italic), Enter inverted. ⚠ and errors keep their colour.
export function plain(t: Palette, dark: boolean): Palette {
  const o: Palette = { ...t };
  const k1 = desat(get(t, "key-num"), 0.35);
  const k2 = desat(mix(get(t, "key-num"), get(t, "bg"), 0.5), 0.35);
  o["key-num"] = k1;
  for (const k of ["key-op", "key-fn", "key-ctl", "key-nav"]) o[k] = k2;
  o["shift"] = get(t, "text");
  o["alpha"] = get(t, "text");
  o["approx"] = get(t, "text");
  o["key-enter"] = get(t, "text");
  o["on-enter"] = get(t, "bg");
  o["key-on"] = get(t, "text");
  o["on-key-on"] = get(t, "bg");
  o["focus"] = get(t, "text");
  o["chip-bg"] = k2;
  o["pick"] = mix(get(t, "bg"), get(t, "text"), 0.1);
  // text-dead must stay dimmer than live text but readable on both tones
  o["text-dead"] = ensure(get(t, "text-dead"), [k1, k2, get(o, "panel")], 3, dark);
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
    ["text", "shift", "alpha"].every((f) => cr(get(t, f), c) >= floor) && cr(get(t, "text-dead"), c) >= dead && cr(get(t, "text-dead"), c) <= cr(get(t, "text"), c) - 1;
  for (const to of ["key-enter", "bg"])
    for (let share = to === "bg" ? 0.5 : 0.34; share > 0.05; share -= 0.02) {
      const c = mix(get(t, "key-num"), get(t, to), share);
      if (ok(c)) return { ...t, "key-pfx": c };
    }
  return { ...t, "key-pfx": get(t, "key-num") };
}

/** The label on an --error ground (Cancel and the like): the family's --bg in dark, white in light. Set last, from the final --bg. */
function withOnError(t: Palette, dark: boolean): Palette {
  return { ...t, "on-error": dark ? get(t, "bg") : "#ffffff" };
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
/** The 40 combinations: 5 families × dark/light × High contrast × Plain keys. */
export function combos(): Combo[] {
  return FAMILIES.flatMap((f) => (["dark", "light"] as const).flatMap((brightness) => [false, true].flatMap((high) => [false, true].map((pl) => ({ family: f.id, brightness, high, plain: pl })))));
}
export function theme(c: Combo): { t: Palette; fixes: [string, string, string][] } {
  const fam = FAMILIES.find((f) => f.id === c.family);
  if (fam === undefined) throw new Error(`theme-gen: no family ${c.family}`);
  const dark = c.brightness === "dark";
  const { t, fixes } = base(fam, c.brightness);
  let o = t;
  if (c.plain) o = plain(o, dark);
  if (c.high) o = highContrast(o, dark);
  return { t: withOnError(withPfx(o, c.high), dark), fixes };
}

// --- the audit: every pair the app draws (docs/shifts/2026-10-18-themes-report.md section 2) ---
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
  add("Screen", "focus and cursor on screen (non-text)", "focus", "bg", 3);
  for (const k of [...KEYS, "key-pfx"]) {
    for (const f of ["text", "shift", "alpha"]) add("Keys", `${f} on ${k}`, f, k, T);
    add("Keys", `dead face on ${k}`, "text-dead", k, D);
  }
  add("Keys", "Enter label", "on-enter", "key-enter", T);
  add("Keys", "label of a key that is on", "on-key-on", "key-on", T);
  add("Screen", "label on an error ground (Cancel)", "on-error", "error", 4.5);
  for (const b of ["panel", "key-num"]) {
    for (const f of ["text", "shift", "muted"]) add("Sheet", `${f} on ${b}`, f, b, T);
    add("Sheet", `disabled row on ${b}`, "text-dead", b, D);
  }
  if (hc) for (const k of KEYS) add("Keys", `key outline on screen around ${k} (non-text)`, "line", "bg", 3);
  return out;
}
/** A dimmed face is at least 1 below a live one on every key. */
export function dimmedOk(t: Palette): boolean {
  return [...KEYS, "key-pfx"].every((k) => cr(get(t, "text-dead"), get(t, k)) <= cr(get(t, "text"), get(t, k)) - 1);
}

// --- the files ---------------------------------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
export const STYLE_CSS = join(here, "../src/style.css");
export const THEME_DIR = join(here, "../src/theme");

/** One block; the first (Pascaline, no transform) ones in style.css carry their long comment elsewhere. */
export function block(c: Combo): string {
  const { t } = theme(c);
  return `${selector(c)} {\n${Object.entries(t).map(([k, v]) => `  --${k}: ${v};`).join("\n")}\n  color-scheme: ${c.brightness};\n}\n`;
}

/** The content of src/theme/<family>.css. Pascaline's untransformed blocks are in style.css, so they are not here. */
export function familyFile(id: string): string {
  const own = id === "pascaline" ? "its transforms (the two start blocks are in src/style.css)" : "all its combinations";
  const head = `/* SPDX-License-Identifier: GPL-3.0-or-later */\n/* GENERATED by scripts/theme-gen.ts (npm run themes): ${id}, ${own}. Do not edit; change theme-families.ts. Loaded by applyTheme (src/theme/). */\n`;
  const list = combos().filter((c) => c.family === id && !(id === "pascaline" && !c.high && !c.plain));
  return head + list.map(block).join("");
}
export const familyPath = (id: string): string => join(THEME_DIR, `${id}.css`);

const START = /:root\[data-family="pascaline"\]\[data-brightness="(dark|light)"\]\s*\{[^}]*\}\n/g;
/** style.css with Pascaline's two start blocks replaced by the generated ones. */
export function styleFile(source: string): string {
  const gen = (b: Brightness): string => block({ family: "pascaline", brightness: b, high: false, plain: false });
  if ([...source.matchAll(START)].length !== 2) throw new Error("theme-gen: style.css must hold exactly Pascaline's two start blocks");
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
