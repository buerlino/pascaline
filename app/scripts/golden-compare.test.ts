// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { compareGolden, readRecords } from "./golden-compare.ts";
import type { GoldenRecord } from "../src/goldenRun.ts";

const rec = (id: string, display: string, mark = "=", stage: GoldenRecord["stage"] = "home"): GoldenRecord => ({ stage, id, input: `in-${id}`, display, mark });

describe("golden compare (A20)", () => {
  const base = [rec("a", "1"), rec("b", "2.5", "≈"), rec("p", "3", "=", "precision")];
  it("two equal runs have no finding", () => {
    expect(compareGolden(base, structuredClone(base))).toEqual([]);
  });
  it("one differing case gives one finding with its input", () => {
    const other = structuredClone(base);
    other[1]!.display = "2.6";
    expect(compareGolden(base, other)).toEqual([{ stage: "home", id: "b", input: "in-b", what: "display", desktop: "2.5", device: "2.6" }]);
  });
  it("a differing mark is a finding; a case missing on one side too", () => {
    const other = [rec("a", "1", "≈"), rec("p", "3", "=", "precision"), rec("z", "9")];
    expect(compareGolden(base, other).map((f) => `${f.id}:${f.what}`)).toEqual(["a:mark", "b:missing", "z:missing"]);
  });
  it("reads logcat lines", () => {
    const line = `10-20 I chromium: [INFO:CONSOLE] "PASCALINE_BENCH golden ${JSON.stringify(base[0])}", source: x`;
    expect(readRecords(`noise\n${line}\n`)).toEqual([base[0]]);
  });
});
