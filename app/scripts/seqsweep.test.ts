// SPDX-License-Identifier: GPL-3.0-or-later
// G62: the sequence invariant (r16 3.2) on fixed sequences with recorded results, and the generator's shape. No engine: the stage itself is scripts/seqsweep.ts.
import { describe, expect, it } from "vitest";
import { checkRead, SOURCES, sequencesOf, type Seen } from "../../tools/probes/sweep/seq.ts";

const seen = (mark: string, display: string): Seen => ({ mark, display });

describe("sequence invariant", () => {
  it("holds for a store then a read that shows what the store line showed", () => {
    expect(checkRead("12 store: sin(1)", "store", seen("≈", "0.841470984808"), seen("≈", "0.841470984808"))).toBeNull();
    expect(checkRead("12 store: 1/3", "store", seen("=", "1/3"), seen("=", "1/3"))).toBeNull();
  });
  it("breaks on F54's recorded result: sum(x^2,x,1,10) with an unaudited x stored showed ⚠ where the value typed fresh is =", () => {
    const f = checkRead("12 bound: sum", "bound", seen("=", "385"), seen("⚠", "385"));
    expect(f).toMatchObject({ check: "bound" });
    expect(f?.detail).toContain("⚠ 385");
  });
  it("breaks on F53's recorded result: a Solve root used as a known gave 1.99999999999 where 2 is right", () => {
    const f = checkRead("12 solve: u^2=2", "solve", seen("≈", "2"), seen("≈", "1.99999999999"));
    expect(f).toMatchObject({ check: "solve" });
    expect(f?.detail).toContain("1.99999999999");
  });
  it("breaks when only the mark or only the confirmed digit count differs", () => {
    expect(checkRead("a", "store", seen("≈", "0.5"), seen("⚠", "0.5"))).not.toBeNull();
    expect(checkRead("a", "relaunch", seen("⚠14", "0.57672480775687"), seen("⚠13", "0.57672480775687"))).not.toBeNull();
  });
});

describe("sequence generator", () => {
  it("is deterministic and starts each sequence with a store", () => {
    const a = sequencesOf(7, 30);
    expect(sequencesOf(7, 30)).toEqual(a);
    for (const q of a) {
      expect(q.steps[0]?.kind).toBe("store");
      expect(q.steps.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("draws every carrier within a few hundred sequences", () => {
    const kinds = new Set(sequencesOf(20261021, 300).flatMap((q) => q.steps.map((s) => s.kind)));
    for (const k of ["store", "read", "ans", "fn", "relaunch", "copy", "solve", "bound"]) expect(kinds.has(k as never)).toBe(true);
    expect(SOURCES).toContain("BesselJ(1,2)");
  });
});
