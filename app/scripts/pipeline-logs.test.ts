// SPDX-License-Identifier: GPL-3.0-or-later
// The failing-file logic of scripts/pipeline.sh, on a real coloured vitest log of run 15 (2026-10-18).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { countMismatch, failedItems, isTiming, onlyTiming } from "./pipeline-logs.ts";

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
  it("a suite that fails on import is found, and the count guard refuses a miss", () => {
    const find = " FAIL  src/find/queries.test.ts > Find index > takes well under 16 ms per key\n";
    const suite = " FAIL  src/x.test.ts [ src/x.test.ts ]\nError: Cannot find module './y'\n Test Files  2 failed | 52 passed (54)\n";
    expect(files(find + suite)).toEqual(["src/find/queries.test.ts", "src/x.test.ts"]);
    expect(onlyTiming("vitest", find + suite)).toBe(false);
    // an unseen failure: the summary says 2 files, only 1 was found
    expect(onlyTiming("vitest", `${find} Test Files  2 failed | 52 passed (54)\n`)).toBe(false);
  });
  it("is not timing for another failure in the Find file", () => {
    expect(isTiming("vitest", { file: "src/find/queries.test.ts", title: "Find index > finds pi" })).toBe(false);
  });
});

describe("timing tests of runs 150 and 152", () => {
  const fail = (f: string, t: string) => ` FAIL  src/engine/${f} > ${t}\n`;
  const novalue = fail("novalue.test.ts", "G78 on the real engine > evaluates only the parts that can make an infinity, and none when they would take too long (timing case)");
  const acos = fail("homeDeadline.test.ts", "Home's deadline (real Giac) > acos(120^(5/2+5)) answers: Giac's im() of its exact result looped past the interrupt");
  it("the novalue timing case and the Home acos deadline are timing", () => {
    expect(onlyTiming("vitest", novalue)).toBe(true);
    expect(onlyTiming("vitest", acos)).toBe(true);
    expect(onlyTiming("vitest", novalue + acos + " Test Files  2 failed | 52 passed (54)\n")).toBe(true);
  });
  it("the G83 library restore and first call is timing; another test in library.test.ts is not", () => {
    const lib = (t: string) => ` FAIL  src/engine/library.test.ts > 200 library programs, defined on first use (G83, real Giac) > ${t}\n`;
    expect(onlyTiming("vitest", lib("restore() of the 200 takes under 50 ms in Node, and a first call at most 10 ms more than after an eager replay (median of 7)"))).toBe(true);
    expect(onlyTiming("vitest", lib("a unit request for 2 m and a root analysis of x^2-2 leave every program pending (G83f1: their keys and JSON load nothing)"))).toBe(false);
  });
  it("F106: the G102 interrupted-call test is timing; another flags.test.ts test is not", () => {
    const fl = (t: string) => ` FAIL  src/engine/flags.test.ts > Giac's settings (real Giac) > ${t}\n`;
    expect(onlyTiming("vitest", fl("G102: a Digits set right after an interrupted call is set (ctx_set clears ctrl_c, G75: one call, no retry), and adjacent sets are one"))).toBe(true);
    expect(onlyTiming("vitest", fl("G102: after each of G67's leak inputs the settings are back through giac_ctx_set, and no getter list is sent as text"))).toBe(false);
  });

  it("another failure in the same files is not timing", () => {
    expect(isTiming("vitest", { file: "src/engine/novalue.test.ts", title: "G78 on the real engine > keeps 1/0 undefined" })).toBe(false);
    expect(isTiming("vitest", { file: "src/engine/homeDeadline.test.ts", title: "Home's deadline (real Giac) > sin(1) answers" })).toBe(false);
    expect(onlyTiming("vitest", novalue + fail("homeDeadline.test.ts", "Home's deadline (real Giac) > factor(x^4-1) answers"))).toBe(false);
  });
  it("e2e: Esc before Working… shows is timing, the Cancel test is not", () => {
    const l = "  2) [chromium-phone] › test/working.spec.ts:61:1 › Esc stops a job before Working… shows ──────────\n";
    expect(onlyTiming("e2e", l)).toBe(true);
    expect(onlyTiming("e2e", l + "  3) [chromium-phone] › test/working.spec.ts:90:1 › the Cancel key stops a job ──────────\n")).toBe(false);
  });
  it("golden: the case id is not on the FAIL line, so a g58 failure stays a real failure", () => {
    const log = "  precision g58-factorial-1e6-30: took 2100 ms > budgetMs 2000\nFAIL precision: 99/100 active match; 0 pending; 40 marks checked\n";
    expect(onlyTiming("golden", log)).toBe(false);
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
  it("e2e: a count that differs from Playwright's own summary is a mismatch, never timing", () => {
    const one = "  1) [chromium-phone] › test/copy.spec.ts:89:1 › copy → paste gives the value back (P5) ────────────\n";
    expect(countMismatch("e2e", `${one}\n  1 failed\n  300 passed\n`)).toBeNull();
    expect(onlyTiming("e2e", `${one}\n  1 failed\n`)).toBe(true);
    expect(countMismatch("e2e", `${one}\n  3 failed\n`)).toMatch(/parsed 1.*3 failed/);
    expect(onlyTiming("e2e", `${one}\n  3 failed\n`)).toBe(false);
  });
});
