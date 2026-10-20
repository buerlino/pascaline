// SPDX-License-Identifier: GPL-3.0-or-later
// The generated theme files are current, and all 40 combinations meet the contrast rules (report section 2).
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
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
  it("style.css keeps everything but Pascaline's two start blocks", () => {
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
