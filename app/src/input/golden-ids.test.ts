// SPDX-License-Identifier: GPL-3.0-or-later
// tests/golden/parser.yaml: every case id is used once. The golden runner's report and scripts/compare-engines.ts key
// the cases by id, so a second case with the same id shadows the first (R51 fix round 1).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("tests/golden/parser.yaml", () => {
  it("has no duplicate case ids", () => {
    const file = fileURLToPath(new URL("../../../tests/golden/parser.yaml", import.meta.url));
    const doc = parse(readFileSync(file, "utf8")) as { cases: { id: string }[] };
    const seen = new Set<string>();
    const dups = doc.cases.map((c) => c.id).filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    expect(dups).toEqual([]);
  });
});
