// SPDX-License-Identifier: GPL-3.0-or-later
// Contrast of the keypad text (U0, docs/05 3.7), computed from the tokens in style.css: at least 4.5:1 for every
// face and legend in every layer and both themes; a dimmed (dead) face at least 3:1. No colour is written
// directly in the keypad component, so these tokens are all there is to check.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");

/** `--name: #rrggbb` pairs of a block. */
function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)) out[m[1] as string] = (m[2] as string).toLowerCase();
  return out;
}
/** Every `[data-family][data-brightness]` block (no contrast or keys transform): its selector and tokens. */
export function themeBlocks(source: string): [string, Record<string, string>][] {
  return [...source.matchAll(/:root(\[data-family="([a-z]+)"\]\[data-brightness="(dark|light)"\])\s*\{([^}]*)\}/g)].map((m) => [`${m[2]} ${m[3]}`, tokens(m[4] as string)]);
}
const blocks = themeBlocks(css);

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (ch[0] as number) + 0.7152 * (ch[1] as number) + 0.0722 * (ch[2] as number);
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return ((x as number) + 0.05) / ((y as number) + 0.05);
}

/** `key-pfx`: the unit pad's prefix cells (R24b), derived by theme-gen.ts from the Enter and digit colours. */
const KEY_BG = ["key-num", "key-op", "key-fn", "key-ctl", "key-nav", "key-pfx"] as const;

for (const [theme, t] of blocks) {
  describe(`keypad contrast, ${theme} theme`, () => {
    it("reads the tokens it needs", () => {
      for (const k of [...KEY_BG, "key-enter", "text", "text-dead", "shift", "alpha", "on-enter", "on-error", "approx", "warn", "pick", "focus", "key-on", "on-key-on", "error", "bg", "chip-bg"]) expect(t[k], `--${k}`).toBeDefined();
    });
    for (const bg of KEY_BG)
      it(`${bg}: face (primary, Shift, Alpha layers) and both legends are at least 4.5:1`, () => {
        for (const fg of ["text", "shift", "alpha"] as const)
          expect(contrast(t[fg] as string, t[bg] as string), `--${fg} on --${bg}`).toBeGreaterThanOrEqual(4.5);
      });
    it("Enter: one colour in every layer, at least 4.5:1", () => {
      expect(contrast(t["on-enter"] as string, t["key-enter"] as string)).toBeGreaterThanOrEqual(4.5);
    });
    for (const bg of KEY_BG)
      it(`${bg}: a dimmed face (a key that does nothing here) stays at least 3:1`, () => {
        expect(contrast(t["text-dead"] as string, t[bg] as string), `--text-dead on --${bg}`).toBeGreaterThanOrEqual(3);
      });
    it("the other pairs the app draws (themes-audit checks): marks, picked row, chips, focus, key on, Cancel", () => {
      const pairs: [string, string, number][] = [
        ["text", "bg", 4.5], ["muted", "bg", 4.5], ["error", "bg", 4.5], ["approx", "bg", 4.5], ["warn", "bg", 4.5],
        ["text", "pick", 4.5], ["muted", "pick", 4.5], ["text", "panel", 4.5], ["text", "chip-bg", 4.5], ["focus", "bg", 3],
        ["on-key-on", "key-on", 4.5], ["on-error", "error", 4.5],
      ];
      for (const [f, b, min] of pairs) expect(contrast(t[f] as string, t[b] as string), `--${f} on --${b}`).toBeGreaterThanOrEqual(min);
    });
    it("a dimmed face is clearly dimmer than a live one", () => {
      for (const bg of KEY_BG) expect(contrast(t["text-dead"] as string, t[bg] as string)).toBeLessThan(contrast(t["text"] as string, t[bg] as string) - 1);
    });
  });
}

describe("no colour is written directly in the keypad", () => {
  it("Keypad.svelte uses tokens only", () => {
    const src = readFileSync(new URL("./keyboard/Keypad.svelte", import.meta.url), "utf8");
    const style = src.slice(src.indexOf("<style>"));
    expect(style.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? []).toEqual([]);
  });
});

// The sheet (docs/05 3.1): rows on --panel, the highlighted row on --key-num; numbers in --shift, reasons in --muted.
for (const [theme, t] of blocks) {
  describe(`sheet contrast, ${theme} theme`, () => {
    for (const bg of ["panel", "key-num"] as const)
      it(`on --${bg}: labels, numbers and reason lines at least 4.5:1, a disabled label at least 3:1`, () => {
        for (const fg of ["text", "shift", "muted"] as const)
          expect(contrast(t[fg] as string, t[bg] as string), `--${fg} on --${bg}`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t["text-dead"] as string, t[bg] as string), `--text-dead on --${bg}`).toBeGreaterThanOrEqual(3);
      });
  });
}

describe("no colour is written directly in the sheet", () => {
  it("Sheet.svelte uses tokens only", () => {
    const src = readFileSync(new URL("./views/Sheet.svelte", import.meta.url), "utf8");
    const style = src.slice(src.indexOf("<style>"));
    expect(style.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g) ?? []).toEqual([]);
  });
});

describe("curve colours", () => {
  it("each curve colour is at least 3:1 on the --bg of its brightness", () => {
    const src = readFileSync(new URL("./apps/function/app.svelte.ts", import.meta.url), "utf8");
    for (const b of ["dark", "light"] as const) {
      const list = new RegExp(`CURVE_COLORS_${b.toUpperCase()}\\s*=\\s*\\[([^\\]]*)\\]`).exec(src)?.[1] ?? "";
      const colors = [...list.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0]);
      expect(colors.length, b).toBe(10);
      for (const [theme, t] of blocks)
        if (theme.endsWith(b)) for (const c of colors) expect(contrast(c, t["bg"] as string), `${c} on ${theme} --bg`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("no colour is written directly in the three components", () => {
  it("History.svelte and FunctionPlot.svelte have no #fff", () => {
    for (const f of ["./views/History.svelte", "./apps/function/FunctionPlot.svelte"]) expect(readFileSync(new URL(f, import.meta.url), "utf8")).not.toMatch(/#fff\b/i);
    expect(readFileSync(new URL("./App.svelte", import.meta.url), "utf8")).not.toMatch(/--selection-background-color:\s*#/);
  });
});

// R116: the entry line's highlights. App.svelte maps MathLive's variables to theme tokens (one scheme for the caret,
// the box of the bracket that holds the cursor and the selection); every theme block (style.css and the five lazy
// family files: every family, brightness, High contrast and Plain keys) meets the floors with that mapping.
const MATHLIVE = ["caret-color", "contains-highlight-background-color", "contains-highlight-color", "selection-background-color", "selection-color"] as const;
/** The `--name: var(--token)` pairs of App.svelte's `.entry :global(math-field)` rule. */
function entryMap(): Record<string, string> {
  const src = readFileSync(new URL("./App.svelte", import.meta.url), "utf8");
  const rule = /\.entry :global\(math-field\)\s*\{([^}]*)\}/.exec(src)?.[1] ?? "";
  return Object.fromEntries([...rule.matchAll(/--([a-z-]+):\s*var\(--([a-z-]+)\)/g)].map((m) => [m[1] as string, m[2] as string]));
}
/** Every block of a theme combination, with whether it is High contrast. */
function allThemeBlocks(): [string, Record<string, string>, boolean][] {
  const files = ["./style.css", ...["pascaline", "graphite", "solarized", "gruvbox", "nord"].map((f) => `./theme/${f}.css`)];
  return files.flatMap((f) =>
    [...readFileSync(new URL(f, import.meta.url), "utf8").matchAll(/:root(\[data-family="[a-z]+"\]\[data-brightness="(?:dark|light)"\](?:\[data-[a-z]+="[a-z]+"\])*)\s*\{([^}]*)\}/g)].map(
      (m): [string, Record<string, string>, boolean] => [m[1] as string, tokens(m[2] as string), (m[1] as string).includes('data-contrast="high"')],
    ),
  );
}
/** theme-gen.ts PICK_APART: the box stands this far from the entry line's --panel (1.13 was not seen on the Tab One). */
const APART = 1.3;

describe("entry highlights (R116)", () => {
  const map = entryMap();
  it("every MathLive highlight of the entry line (and the unit view's field, inside .entry) is a theme token", () => {
    for (const v of MATHLIVE) expect(map[v], `--${v}`).toMatch(/^[a-z-]+$/);
    expect(map["selection-background-color"]).toBe(map["contains-highlight-background-color"]); // the box and the selection: one ground (never both at once)
  });
  const blocks40 = allThemeBlocks();
  it("reads the 40 theme combinations", () => expect(blocks40).toHaveLength(40));
  for (const [sel, t, hc] of blocks40)
    it(`${sel}: the box, the selection and the caret meet the floors, and the box stands apart from --panel`, () => {
      const T = hc ? 7 : 4.5;
      const c = (role: string): string => t[map[role] ?? "-"] ?? `missing --${map[role]}`;
      expect(contrast(t["text"] as string, c("contains-highlight-background-color")), "text in the box").toBeGreaterThanOrEqual(T);
      expect(contrast(c("contains-highlight-color"), c("contains-highlight-background-color")), "the bracket on its box").toBeGreaterThanOrEqual(T);
      expect(contrast(c("selection-color"), c("selection-background-color")), "selected text").toBeGreaterThanOrEqual(T);
      expect(contrast(c("caret-color"), t["panel"] as string), "caret on the entry line").toBeGreaterThanOrEqual(T);
      expect(contrast(c("caret-color"), c("contains-highlight-background-color")), "caret in the box (non-text)").toBeGreaterThanOrEqual(3);
      expect(contrast(c("contains-highlight-background-color"), t["panel"] as string), "the box apart from --panel").toBeGreaterThanOrEqual(APART);
      expect(contrast(c("selection-background-color"), t["panel"] as string), "the selection apart from --panel").toBeGreaterThanOrEqual(APART);
    });
});
