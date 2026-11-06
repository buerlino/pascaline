// SPDX-License-Identifier: GPL-3.0-or-later
// The generated theme files are current, and all 40 combinations meet the contrast rules (report section 2).
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAMILIES } from "./theme-families.ts";
import { checks, combos, cr, dimmedOk, expected, familyPath, outOfDate, selector, styleFile, theme } from "./theme-gen.ts";

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

// R140: colour-vision checks (Machado 2009, severity 1, in linear RGB; distance in OKLab) and the key colours.
type Mat = readonly [readonly number[], readonly number[], readonly number[]];
const CVD: Record<string, Mat> = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const lin = (h: string): number[] => [1, 3, 5].map((i) => {
  const s = parseInt(h.slice(i, i + 2), 16) / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
});
/** OKLab (Ottosson) of a linear RGB triple. */
function oklab([r, g, b]: number[]): number[] {
  const l = Math.cbrt(0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!);
  const m = Math.cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!);
  const s = Math.cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const sim = (rgb: number[], m: Mat | null): number[] => (m === null ? rgb : m.map((row) => Math.min(1, Math.max(0, row[0]! * rgb[0]! + row[1]! * rgb[1]! + row[2]! * rgb[2]!))));
/** OKLab distance of two #rrggbb colours as seen through a colour-vision matrix (null: normal vision). */
export function apart(a: string, b: string, m: Mat | null = null): number {
  const [p, q] = [oklab(sim(lin(a), m)), oklab(sim(lin(b), m))];
  return Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!);
}

describe("R140: Shift, Alpha and ⚠ stay apart", () => {
  it("the formula reproduces the measured pair (N62 Dark, #ff9a33 / #529997, protanopia 0.156)", () => {
    expect(apart("#ff9a33", "#529997", CVD["protanopia"] as Mat)).toBeCloseTo(0.156, 2);
  });
  // Plain keys draws Shift and Alpha in the text colour on purpose (no colour coding), so it has no colour to tell apart.
  for (const c of combos().filter((x) => !x.plain))
    it(`${selector(c)}: Shift and Alpha at least 0.12 apart for protanopia, deuteranopia and tritanopia`, () => {
      const { t } = theme(c);
      for (const [name, m] of Object.entries(CVD)) expect(apart(t["shift"] as string, t["alpha"] as string, m), name).toBeGreaterThanOrEqual(0.12);
    });
  for (const c of combos())
    it(`${selector(c)}: ⚠ and Shift at least 0.08 apart (normal vision)`, () => {
      const { t } = theme(c);
      expect(apart(t["warn"] as string, t["shift"] as string)).toBeGreaterThanOrEqual(0.08);
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
  const repo = (p: string): string => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8").toLowerCase();
  it("the first-paint block of style.css", () => {
    expect(/\[data-family="n62"\]\[data-brightness="dark"\]\s*\{[^}]*?--bg:\s*(#[0-9a-f]{6})/.exec(repo("app/src/style.css"))?.[1]).toBe(bg);
  });
  it("the swatch dots start with it", () => {
    expect(/id: "n62", name: "N62", dots: \["(#[0-9a-f]{6})"/.exec(repo("app/src/theme/lookView.ts"))?.[1]).toBe(bg);
  });
  it("Capacitor's window colour and Android's colour", () => {
    expect(/backgroundColor: '(#[0-9a-f]{6})'/.exec(repo("app/capacitor.config.ts"))?.[1]).toBe(bg);
    expect(/name="n62_dark_bg">(#[0-9a-f]{6})</.exec(repo("android/app/src/main/res/values/colors.xml"))?.[1]).toBe(bg);
  });
  it("the page's theme-color and the manifest's colours", () => {
    expect(/name="theme-color" content="(#[0-9a-f]{6})"/.exec(repo("app/index.html"))?.[1]).toBe(bg);
    const m = JSON.parse(repo("app/public/manifest.webmanifest")) as Record<string, string>;
    expect([m["background_color"], m["theme_color"]]).toEqual([bg, bg]);
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
