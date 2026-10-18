// SPDX-License-Identifier: GPL-3.0-or-later
// The failing-file logic of scripts/pipeline.sh, on a real coloured vitest log of run 15 (2026-10-18).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { failedItems, isTiming, onlyTiming } from "./pipeline-logs.ts";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../../tests/fixtures/pipeline");
const colour = readFileSync(join(dir, "vitest-find-timing.log"), "utf8");
const files = (log: string) => [...new Set(failedItems("vitest", log).map((i) => i.file))];

describe("vitest log", () => {
  it("finds the Find timing test through the colour codes", () => {
    expect(colour).toContain("\u001b[");
    expect(files(colour)).toEqual(["src/find/queries.test.ts"]);
    expect(onlyTiming("vitest", colour)).toBe(true);
    // today's grep, for the record: it never matched
    expect(/^ *(FAIL|❯) +[^ ]+\.test\.ts/m.test(colour)).toBe(false);
  });
  it("gets both files when another one fails too, and then it is not timing", () => {
    const log = `${colour}\n\u001b[41m\u001b[1m FAIL \u001b[22m\u001b[49m src/other.test.ts\u001b[2m > \u001b[22mthing works\n`;
    expect(files(log)).toEqual(["src/find/queries.test.ts", "src/other.test.ts"]);
    expect(onlyTiming("vitest", log)).toBe(false);
  });
  it("is not timing for another failure in the Find file", () => {
    expect(isTiming("vitest", { file: "src/find/queries.test.ts", title: "Find index > finds pi" })).toBe(false);
  });
});

describe("golden and e2e logs", () => {
  const units = (n: number, p95: string) => `PASS x: 3/3\nFAIL units: ${n}/116 match (value, mark), rounds 5; desktop warm median 2.02 ms, p95 ${p95} ms (≤ 5), max 11 ms\n`;
  it("a golden failure only on the units p95 bar is timing", () => {
    expect(failedItems("golden", units(116, "6.16"))).toHaveLength(1);
    expect(onlyTiming("golden", units(116, "6.16"))).toBe(true);
    expect(onlyTiming("golden", units(115, "6.16"))).toBe(false);
    expect(onlyTiming("golden", "PASS units: 116/116 match\n")).toBe(false);
  });
  it("e2e: the copy poll and the solve reload are timing, others are not", () => {
    const l = (f: string, t: string) => `  1) [chromium-phone] › test/${f}:89:1 › ${t} ────────────\n`;
    expect(onlyTiming("e2e", l("copy.spec.ts", "copy → paste gives the value back (P5)"))).toBe(true);
    expect(onlyTiming("e2e", l("solve.spec.ts", "equations and values are stored"))).toBe(true);
    expect(onlyTiming("e2e", l("working.spec.ts", "the Cancel key stops a job"))).toBe(false);
  });
});
