// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { evalLines, isTestFile, judge, textLines } from "./text-rules.ts";

describe("textLines (G88)", () => {
  it.each([
    ["const m = s.match(/a/);", 1],
    ["const m = s.match(re);", 1],
    ['s.replace(/x/g, "y");', 1],
    ["const r = new RegExp(p);", 1],
    ['const i = s.indexOf("(");', 1],
    ["if (depth++ > 3) break;", 1],
    ['if (ch === "(") n++;', 1],
    ["const a = [1].indexOf(x);", 0],
    ['s.replace("a", "b");', 0],
    ["// s.match(/a/)", 0],
    [" * new RegExp(x)", 0],
    ["const x = 1;", 0],
  ])("%s -> %i", (src, n) => {
    expect(textLines(src).length).toBe(n);
  });
  it("reports line numbers", () => {
    expect(textLines("a\nb.match(/x/)\nc")).toEqual([{ line: 2, text: "b.match(/x/)" }]);
  });
  it("knows test files", () => {
    expect(isTestFile("src/engine/host.test.ts")).toBe(true);
    expect(isTestFile("src/engine/host.ts")).toBe(false);
  });
});

describe("evalLines and judge (G88)", () => {
  it("finds .eval(", () => expect(evalLines("g.eval('x');\n// g.eval(1)").length).toBe(1));
  it("a rise fails and names file and lines", () => {
    const v = judge({ "src/engine/host.ts": 3 }, { "src/engine/host.ts": 2 }, { "src/engine/host.ts": [{ line: 4, text: "" }] }, []);
    expect(v.ok).toBe(false);
    expect(v.detail).toContain("src/engine/host.ts");
    expect(v.detail).toContain("4");
  });
  it("a new file fails, a fall passes with a note", () => {
    expect(judge({ "src/units/new.ts": 1 }, {}, {}, []).ok).toBe(false);
    const v = judge({ "src/units/a.ts": 1 }, { "src/units/a.ts": 2 }, {}, []);
    expect(v.ok).toBe(true);
    expect(v.detail).toContain("lower the baseline");
  });
  it("an eval outside fails", () => expect(judge({}, {}, {}, ["src/x.ts:1: g.eval(a)"]).ok).toBe(false));
});
