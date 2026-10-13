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
const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
const lightBlock = /@media \(prefers-color-scheme: light\)\s*\{\s*:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
const dark = tokens(rootBlock);
const light = { ...dark, ...tokens(lightBlock) };

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

const KEY_BG = ["key-num", "key-op", "key-fn", "key-ctl", "key-nav"] as const;

for (const [theme, t] of [
  ["dark", dark],
  ["light", light],
] as const) {
  describe(`keypad contrast, ${theme} theme`, () => {
    it("reads the tokens it needs", () => {
      for (const k of [...KEY_BG, "key-enter", "text", "text-dead", "shift", "alpha", "on-enter"]) expect(t[k], `--${k}`).toBeDefined();
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
for (const [theme, t] of [
  ["dark", dark],
  ["light", light],
] as const) {
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
