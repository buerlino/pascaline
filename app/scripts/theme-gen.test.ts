// SPDX-License-Identifier: GPL-3.0-or-later
// The generated theme files are current, and all 40 combinations meet the contrast rules (report section 2).
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAMILIES } from "./theme-families.ts";
import { apart, CVD, type Mat } from "./cvd.ts";
import { LAYER_APART, WARN_APART, checks, combos, cr, dimmedOk, expected, familyPath, outOfDate, selector, styleFile, theme } from "./theme-gen.ts";

describe("generated theme files", () => {
  it("are up to date (run npm run themes)", () => {
    expect(outOfDate()).toEqual([]);
  });
  it("a hand edit of a generated file is detected", () => {
    const p = familyPath("nord");
    const before = readFileSync(p, "utf8");
    try {
      writeFileSync(p, before.replace("--bg: #2e3440", "--bg: #2e3441"));
      expect(outOfDate()).toEqual([p]);
    } finally {
      writeFileSync(p, before);
    }
    expect(outOfDate()).toEqual([]);
  });
  it("style.css keeps everything but N62's two start blocks", () => {
    const src = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
    expect(styleFile(src)).toBe(src);
    expect(expected().size).toBe(6);
  });
});

const CURVES = readFileSync(new URL("../src/apps/function/app.svelte.ts", import.meta.url), "utf8");
const curves = (b: "dark" | "light"): string[] => [...(new RegExp(`CURVE_COLORS_${b.toUpperCase()}\\s*=\\s*\\[([^\\]]*)\\]`).exec(CURVES)?.[1] ?? "").matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0]);

describe("all 40 combinations", () => {
  it("are 40", () => expect(combos()).toHaveLength(40));
  for (const c of combos())
    describe(selector(c), () => {
      const { t } = theme(c);
      it("meets every pair of the contrast rules and keeps a dead face dimmer", () => {
        const bad = checks(t, c.high).filter((x) => x.v < x.min);
        expect(bad.map((x) => `${x.l} ${x.v.toFixed(2)} < ${x.min}`)).toEqual([]);
        expect(dimmedOk(t)).toBe(true);
      });
      it("--on-error on --error is at least 4.5:1", () => {
        expect(cr(t["on-error"] as string, t["error"] as string)).toBeGreaterThanOrEqual(4.5);
      });
      it("each curve colour is at least 3:1 on --bg", () => {
        for (const col of curves(c.brightness)) expect(cr(col, t["bg"] as string), `${col} on --bg`).toBeGreaterThanOrEqual(3);
      });
    });
});

// R140: colour-vision checks (scripts/cvd.ts) and the key colours.
describe("R140: Shift, Alpha and ⚠ stay apart", () => {
  it("the formula reproduces the measured pair (N62 Dark, #ff9a33 / #529997, protanopia 0.156)", () => {
    expect(apart("#ff9a33", "#529997", CVD["protanopia"] as Mat)).toBeCloseTo(0.156, 2);
  });
  // Plain keys draws Shift and Alpha in the text colour on purpose (no colour coding), so it has no colour to tell apart.
  // High contrast has lower floors (theme-gen.ts LAYER_APART): 7:1 for all of them leaves little room.
  for (const c of combos().filter((x) => !x.plain))
    it(`${selector(c)}: Shift and Alpha at least ${LAYER_APART[c.high ? "high" : "normal"]} apart for protanopia, deuteranopia and tritanopia`, () => {
      const { t } = theme(c);
      for (const [name, m] of Object.entries(CVD)) expect(apart(t["shift"] as string, t["alpha"] as string, m), name).toBeGreaterThanOrEqual(LAYER_APART[c.high ? "high" : "normal"]);
    });
  // Graphite, Gruvbox and Nord leave with R150 and keep their colours (owner, 2026-11-06): their ⚠ is checked only as far as the generator can move it.
  for (const c of combos().filter((x) => !x.plain && ["n62", "solarized"].includes(x.family)))
    it(`${selector(c)}: ⚠ and Shift at least ${WARN_APART[c.high ? "high" : "normal"]} apart (normal vision)`, () => {
      const { t } = theme(c);
      expect(apart(t["warn"] as string, t["shift"] as string)).toBeGreaterThanOrEqual(WARN_APART[c.high ? "high" : "normal"]);
    });
});

describe("R140: Shift, Alpha, Fmt, ⌫ and the pad wear the other keys' colour", () => {
  for (const c of combos())
    it(`${selector(c)}: --key-ctl is --key-fn; --on-shift and --on-alpha read on the armed key`, () => {
      const { t } = theme(c);
      expect(t["key-ctl"]).toBe(t["key-fn"]);
      expect(cr(t["on-shift"] as string, t["shift"] as string), "on-shift").toBeGreaterThanOrEqual(4.5);
      expect(cr(t["on-alpha"] as string, t["alpha"] as string), "on-alpha").toBeGreaterThanOrEqual(4.5);
      expect(["#000000", "#ffffff"]).toContain(t["on-shift"]);
      expect(["#000000", "#ffffff"]).toContain(t["on-alpha"]);
    });
  it("the family data gives every family one colour for both", () => {
    for (const f of FAMILIES) for (const b of ["dark", "light"] as const) expect(f[b]["key-ctl"], `${f.id} ${b}`).toBe(f[b]["key-fn"]);
  });
});

describe("R140: the Dark background outside the generated CSS is N62 Dark's --bg", () => {
  const bg = theme({ family: "n62", brightness: "dark", high: false, plain: false }).t["bg"] as string;
  const repo = (p: string): string => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  /** The colour a pattern's one group finds in a repo file, lower case. */
  const found = (p: string, re: RegExp): string | undefined => re.exec(repo(p))?.[1]?.toLowerCase();
  it("the first-paint block of style.css", () => {
    expect(found("app/src/style.css", /\[data-family="n62"\]\[data-brightness="dark"\]\s*\{[^}]*?--bg:\s*(#[0-9a-f]{6})/i)).toBe(bg);
  });
  it("the swatch dots start with it", () => {
    expect(found("app/src/theme/lookView.ts", /id: "n62", name: "N62", dots: \["(#[0-9a-f]{6})"/i)).toBe(bg);
  });
  it("Capacitor's window colour and Android's colour", () => {
    expect(found("app/capacitor.config.ts", /backgroundColor: '(#[0-9a-f]{6})'/i)).toBe(bg);
    expect(found("android/app/src/main/res/values/colors.xml", /name="n62_dark_bg">(#[0-9a-f]{6})</i)).toBe(bg);
  });
  it("the page's theme-color and the manifest's colours", () => {
    expect(found("app/index.html", /name="theme-color" content="(#[0-9a-f]{6})"/i)).toBe(bg);
    const m = JSON.parse(repo("app/public/manifest.webmanifest")) as Record<string, string>;
    expect([m["background_color"]?.toLowerCase(), m["theme_color"]?.toLowerCase()]).toEqual([bg, bg]);
  });
});

describe("R140: the tip bubble takes the Shift colours, not a literal amber", () => {
  it("tips.css has no #ffc233 and uses --shift / --on-shift", () => {
    const css = readFileSync(new URL("../src/views/tips.css", import.meta.url), "utf8");
    expect(css).not.toMatch(/#ffc233|#0b1020/i);
    expect(css).toMatch(/var\(--shift\)/);
    expect(css).toMatch(/var\(--on-shift\)/);
  });
});
