// SPDX-License-Identifier: GPL-3.0-or-later
// The IEC 60063 tables (eseries.ts) against structure and formula, so a typo in a literal list shows.
import { describe, expect, it } from "vitest";
import { ESERIES, ESERIES_SCALE } from "./eseries.ts";

describe("IEC 60063 tables", () => {
  it("have n entries, ascending, inside [d, 10d)", () => {
    for (const [n, t] of Object.entries(ESERIES)) {
      const d = ESERIES_SCALE[Number(n)]!;
      expect(t.length, `E${n}`).toBe(Number(n));
      expect(t.every((v, i) => v >= d && v < 10 * d && (i === 0 || v > t[i - 1]!)), `E${n}`).toBe(true);
    }
  });
  it("nest: every other value of E192 is E96, of E96 is E48; E6 ⊂ E12 ⊂ E24", () => {
    expect(ESERIES[192]!.filter((_, i) => i % 2 === 0)).toEqual(ESERIES[96]);
    expect(ESERIES[96]!.filter((_, i) => i % 2 === 0)).toEqual(ESERIES[48]);
    expect(ESERIES[12]!.every((v) => ESERIES[24]!.includes(v))).toBe(true);
    expect(ESERIES[6]!.every((v) => ESERIES[12]!.includes(v))).toBe(true);
  });
  it("E48, E96, E192 are round(10^(2+k/n)); the one published E192 exception is 9.20", () => {
    for (const n of [48, 96, 192]) {
      const off = ESERIES[n]!.map((v, k) => [k, v, Math.round(10 ** (2 + k / n))] as const).filter(([, v, f]) => v !== f);
      expect(off.map(([, v]) => v), `E${n}`).toEqual(n === 192 ? [920] : []);
    }
  });
  it("E6–E24 keep the published values a formula misses", () => {
    for (const v of [27, 33, 39, 47, 82]) expect(ESERIES[12]).toContain(v);
  });
});
