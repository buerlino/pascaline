// SPDX-License-Identifier: GPL-3.0-or-later
// G61: the oracle sweep's judge on fixed inputs with known verdicts (no engine). Oracle strings here are made-up cases for the judge's rules.
import { describe, expect, it } from "vitest";
import { decimalFromString, ZERO_VALUE, type ComplexValue } from "../src/engine/format.ts";
import { judge, parseDec, type Oracle, type Shown } from "../../tools/probes/sweep/judge.ts";
import { generate } from "../../tools/probes/sweep/gen.ts";

const num = (re: string, im?: string): ComplexValue => ({ re: decimalFromString(re) ?? ZERO_VALUE, im: im === undefined ? ZERO_VALUE : (decimalFromString(im) ?? ZERO_VALUE) });
const shown = (value: ComplexValue, mark: Shown["mark"], n?: number): Shown => ({ ok: true, display: "x", value, mark, ...(n === undefined ? {} : { n }) });
const val = (re: string, im = "0"): Oracle => ({ kind: "value", re, im });

describe("sweep judge", () => {
  it("accepts an = that holds", () => {
    expect(judge(shown(num("0.25"), "="), val("0.25"), 12).kind).toBe("ok");
    expect(judge(shown(num("3"), "="), val("3.0000000000000000000000000000000000000000000000000000001"), 12).kind).toBe("ok");
  });
  it("rejects an = that does not hold", () => {
    const v = judge(shown(num("0.25"), "="), val("0.2500001"), 12);
    expect(v).toMatchObject({ kind: "wrong", check: "=" });
  });
  it("accepts an ≈ right to the shown digits and rejects one wrong from the 4th digit (F46)", () => {
    expect(judge(shown(num("1.23456789012"), "≈"), val("1.234567890123456"), 12).kind).toBe("ok");
    const v = judge(shown(num("1.2345678901234"), "≈"), val("1.2349876543210987"), 12);
    expect(v).toMatchObject({ kind: "wrong", check: "≈" });
    expect(v.detail).toContain("right to 4 digits");
  });
  it("rejects an ≈ one unit off in the last digit, accepts half a unit", () => {
    expect(judge(shown(num("1.23456789012"), "≈"), val("1.2345678901249"), 12).kind).toBe("ok");
    expect(judge(shown(num("1.23456789012"), "≈"), val("1.2345678901351"), 12).kind).toBe("wrong");
  });
  it("judges ⚠ n against n digits and a bare ⚠ against nothing", () => {
    expect(judge(shown(num("1.23456789012"), "⚠", 6), val("1.23456412"), 12).kind).toBe("ok");
    expect(judge(shown(num("1.23456789012"), "⚠", 6), val("1.2346"), 12)).toMatchObject({ kind: "wrong", check: "⚠n" });
    expect(judge(shown(num("1.23456789012"), "⚠"), val("99"), 12)).toMatchObject({ kind: "ok", detail: "⚠ without a count" });
    expect(judge(shown(num("2", "1e-2043"), "⚠", 0), val("2.1", "0"), 12).kind).toBe("ok");
  });
  it("checks the imaginary part, shown or not", () => {
    expect(judge(shown(num("2", "3"), "≈"), val("2", "3"), 12).kind).toBe("ok");
    expect(judge(shown(num("2", "3"), "≈"), val("2", "3.5"), 12)).toMatchObject({ kind: "wrong", check: "≈" });
    expect(judge(shown(num("2"), "≈"), val("2", "0.5"), 12)).toMatchObject({ kind: "wrong", check: "part" });
    expect(judge(shown(num("2"), "≈"), val("2", "1e-40"), 12).kind).toBe("ok");
    expect(judge(shown(num("2", "3"), "≈"), val("2", "0"), 12)).toMatchObject({ kind: "wrong", check: "part" });
  });
  it("refuses a number where the oracle has no value (F8)", () => {
    expect(judge(shown(num("5"), "≈"), { kind: "novalue" }, 12)).toMatchObject({ kind: "novalue" });
    expect(judge({ ok: false, error: "engine", display: "Division by zero" }, { kind: "novalue" }, 12).kind).toBe("refused");
    expect(judge({ ok: true, display: "undef" }, { kind: "novalue" }, 12).kind).toBe("ok");
  });
  it("calls a missed deadline a hang (F44) and a skipped oracle a skip", () => {
    expect(judge({ hang: true }, val("1"), 12)).toMatchObject({ kind: "hang", check: "hang" });
    expect(judge({ hang: true }, { kind: "skip", reason: "unstable" }, 12).kind).toBe("hang");
    expect(judge(shown(num("1"), "≈"), { kind: "skip", reason: "unstable" }, 12).kind).toBe("skip");
  });
  it("reads oracle text", () => {
    expect(parseDec("-1.5e+3")).toEqual({ m: -15n, e: 2 });
    expect(parseDec("nan")).toBeNull();
  });
});

describe("sweep generator", () => {
  it("is deterministic and gives keyboard LaTeX with an mpmath form", () => {
    const a = generate(7, 30);
    expect(generate(7, 30)).toEqual(a);
    expect(generate(8, 30)).not.toEqual(a);
    expect(a).toHaveLength(30);
    for (const c of a) {
      expect(c.latex.length).toBeGreaterThan(0);
      expect(c.mp.length).toBeGreaterThan(0);
    }
  });
});
