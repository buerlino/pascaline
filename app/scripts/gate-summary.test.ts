// SPDX-License-Identifier: GPL-3.0-or-later
// The gate's summary lines must say FAIL when a report says so, and name what failed. Fake reports in the shape of
// Vitest's and Playwright's JSON reporters.
import { describe, expect, it } from "vitest";
import {
  formatLine, retryable, coreCount, regeneratesIndex, selectsGolden, playwrightFailedSpecs, playwrightFailures, summarizeDocs, summarizeGolden, summarizePlaywright, summarizeCasBack, summarizeSeqSweep, summarizeSize, summarizeSweep, summarizeViewSweep, summarizeFindCensus, summarizeTypecheck, summarizeVitest, vitestFailures,
} from "./gate-summary.ts";

const vitestOk = {
  numTotalTests: 3, numPassedTests: 3, numFailedTests: 0, numPendingTests: 0,
  testResults: [{ name: "/x/a.test.ts", status: "passed", assertionResults: [{ status: "passed", fullName: "a one" }] }, { name: "/x/b.test.ts", status: "passed", assertionResults: [] }],
};

describe("vitest report", () => {
  it("passes with the counts", () => {
    expect(summarizeVitest(vitestOk)).toEqual({ ok: true, detail: "3 tests in 2 files" });
  });
  it("fails and names the failing tests by file and title", () => {
    const r = { ...vitestOk, numPassedTests: 2, numFailedTests: 1, testResults: [{ name: "/x/a.test.ts", status: "failed", assertionResults: [{ status: "failed", fullName: "a one" }] }] };
    expect(summarizeVitest(r)).toEqual({ ok: false, detail: '1 of 3 tests failed: a.test.ts "a one"' });
  });
  it("fails on a file that did not load (no assertions)", () => {
    const r = { ...vitestOk, numFailedTests: 0, testResults: [{ name: "/x/c.test.ts", status: "failed", assertionResults: [] }] };
    expect(summarizeVitest(r).detail).toContain("c.test.ts (did not load)");
  });
  it("fails on no report and on zero tests", () => {
    expect(summarizeVitest(null).ok).toBe(false);
    expect(summarizeVitest({ ...vitestOk, numTotalTests: 0, numPassedTests: 0 }).ok).toBe(false);
  });
  it("lists the failed tests with their file", () => {
    const r = { ...vitestOk, numFailedTests: 1, testResults: [{ name: "/x/a.test.ts", status: "failed", assertionResults: [{ status: "failed", fullName: "a one" }, { status: "passed", fullName: "a two" }] }] };
    expect(vitestFailures(r)).toEqual([{ file: "/x/a.test.ts", title: "a one" }]);
  });
  it("counts skipped tests without failing", () => {
    expect(summarizeVitest({ ...vitestOk, numPendingTests: 2 }).detail).toBe("3 tests in 2 files, 2 skipped");
  });
});

const spec = (file: string, line: number, ok: boolean) => ({ title: "t", file, line, ok });
const pw = (unexpected: number, specs: ReturnType<typeof spec>[], extra = {}) => ({
  stats: { expected: 5, unexpected, flaky: 0, skipped: 0 },
  suites: [{ specs: [specs[0]], suites: [{ specs: specs.slice(1) }] }],
  ...extra,
});

describe("playwright report", () => {
  it("passes", () => {
    expect(summarizePlaywright(pw(0, [spec("a.spec.ts", 1, true)]))).toEqual({ ok: true, detail: "5 of 5" });
  });
  it("fails with the failing specs as file:line, nested suites included", () => {
    const r = pw(2, [spec("solve.spec.ts", 40, false), spec("keys.spec.ts", 7, false), spec("keys.spec.ts", 9, true)]);
    expect(playwrightFailures(r)).toEqual(["solve.spec.ts:40", "keys.spec.ts:7"]);
    expect(summarizePlaywright(r)).toEqual({ ok: false, detail: "2 of 7 failed: solve.spec.ts:40, keys.spec.ts:7" });
  });
  it("retries exactly what isTiming accepts, per check", () => {
    const e = (file: string, title: string) => ({ file, line: 1, title });
    const timing = e("working.spec.ts", "Esc stops a job before Working… shows");
    const reload = e("solve.spec.ts", "Solve: equations and values are stored");
    const other = e("solve.spec.ts", "Solve: x·e^x=5 with guess 1 gives the oracle root");
    expect(retryable("e2e", [timing, reload])).toBe(true);
    expect(retryable("e2e", [timing, other])).toBe(false);
    expect(retryable("e2e", [e("keys.spec.ts", reload.title)])).toBe(false);
    expect(retryable("e2e", [])).toBe(false);
    expect(retryable("vitest", [{ file: "/x/src/find/queries.test.ts", title: "a takes well under 16 ms" }])).toBe(true);
    expect(retryable("vitest", [{ file: "/x/src/find/queries.test.ts", title: "other" }])).toBe(false);
  });
  it("counts the core cases as the core reporter does", () => {
    const t = (title: string, expectedStatus: string, status: string) => ({ title, file: "core.spec.ts", line: 1, ok: status !== "unexpected", tests: [{ expectedStatus, status }] });
    const r = { suites: [{ specs: [t("c01 a", "passed", "expected"), t("c02 b", "passed", "unexpected"), t("c03 c", "failed", "expected"), t("c04 d", "passed", "skipped"), t("c05 e", "passed", "flaky"), { title: "other", file: "keys.spec.ts", line: 1, ok: true, tests: [{ expectedStatus: "passed", status: "expected" }] }] }] };
    expect(coreCount(r)).toBe("CORE 2/3 (known 1, needs 1)");
    expect(coreCount({ suites: [] })).toBeNull();
    const good = { suites: [{ specs: [t("c01 a", "passed", "expected"), t("c03 c", "failed", "expected"), t("c04 d", "passed", "skipped")] }] };
    expect(summarizePlaywright({ ...good, stats: { expected: 2, unexpected: 0, flaky: 0, skipped: 1 } }).detail).toBe("2 of 3, 1 skipped, CORE 1/1 (known 1, needs 1)");
  });
  it("fails on errors outside tests and on no report", () => {
    expect(summarizePlaywright(pw(0, [spec("a.spec.ts", 1, true)], { errors: [{ message: "boom\nmore" }] })).detail).toContain("boom");
    expect(summarizePlaywright({}).ok).toBe(false);
  });
});

describe("tool output", () => {
  it("typecheck: counts, and a warning fails (--threshold warning)", () => {
    expect(summarizeTypecheck("svelte-check found 0 errors and 0 warnings", 0)).toEqual({ ok: true, detail: "0 errors" });
    expect(summarizeTypecheck("svelte-check found 2 errors and 1 warning", 1)).toEqual({ ok: false, detail: "2 errors, 1 warnings" });
    expect(summarizeTypecheck('1 COMPLETED 578 FILES 0 ERRORS 0 WARNINGS 0 FILES_WITH_PROBLEMS', 0)).toEqual({ ok: true, detail: "0 errors" });
    expect(summarizeTypecheck('1 COMPLETED 578 FILES 3 ERRORS 0 WARNINGS 1 FILES_WITH_PROBLEMS', 1).ok).toBe(false);
    expect(summarizeTypecheck("crash", 1).ok).toBe(false);
  });
  it("golden: needs the PASSED line and exit 0", () => {
    expect(summarizeGolden("x\nGOLDEN GATE PASSED\n", 0).ok).toBe(true);
    expect(summarizeGolden("GOLDEN GATE PASSED", 1).ok).toBe(false);
    expect(summarizeGolden("\nGOLDEN GATE FAILED: home, solve\n", 1)).toEqual({ ok: false, detail: "stages failed: home, solve" });
    expect(summarizeGolden("crashed", 0).ok).toBe(false);
    expect(summarizeGolden("PASS invariants: 304 inputs, 244 (a) RAD/DEG; 2 known failures, 0 new, 0 now passing; 46.1 s (< 60)\nGOLDEN GATE PASSED\n", 0).detail).toBe("GOLDEN GATE PASSED (invariants: 304 inputs, 2 known failures)");
  });
  it("size: lists the failures", () => {
    const out = "table\n\nsize-check FAILED:\n  start chunk 300 kB > 250 kB\n  find 9 > 8\nA budget changes only";
    expect(summarizeSize(out, 1)).toEqual({ ok: false, detail: "2 over: start chunk 300 kB > 250 kB; find 9 > 8" });
    expect(summarizeSize("size-check passed", 0).ok).toBe(true);
  });
  it("docs: tools/docs-check.mjs's summary line, and its first failures when it fails (S7's budgets)", () => {
    expect(summarizeDocs("docs ok: 319 links and paths; backlog.md 12.4/20 kB", 0)).toEqual({ ok: true, detail: "319 links and paths; backlog.md 12.4/20 kB" });
    const bad = "budget: docs/backlog.md is 21.0 kB, over 20 kB\nlink: docs/a.md → b.md (no docs/b.md)\ndocs FAILED (2): 310 links and paths";
    expect(summarizeDocs(bad, 1)).toEqual({ ok: false, detail: "2 failed: budget: docs/backlog.md is 21.0 kB, over 20 kB; link: docs/a.md → b.md (no docs/b.md)" });
    expect(summarizeDocs("", 1)).toEqual({ ok: false, detail: "exit 1" });
  });
});

describe("line format", () => {
  it("is one line: verdict, name, detail, time", () => {
    expect(formatLine("typecheck", { ok: true, detail: "0 errors" }, 12_300)).toBe("PASS typecheck 0 errors (12 s)");
    expect(formatLine("e2e", { ok: false, detail: "2 of 214 failed: a.spec.ts:40" }, 400_000)).toBe("FAIL e2e 2 of 214 failed: a.spec.ts:40 (7 min)");
  });
});

describe("what the gate selects by changed paths", () => {
  it("golden runs for units, unit-case, find and its generator", () => {
    expect(selectsGolden(["app/src/units/evaluate.ts"])).toBe(true);
    expect(selectsGolden(["app/scripts/unit-case.ts"])).toBe(true);
    expect(selectsGolden(["find/aliases.yaml"])).toBe(true);
    expect(selectsGolden(["tools/find-index/generate.mjs"])).toBe(true);
    for (const f of ["tools/probes/giac-check.mjs", "tools/probes/giaccheck/lib.ts", "tools/probes/sweep/a.ts", "tools/probes/casback/a.ts", "tests/engine/a.test.ts"]) expect(selectsGolden([f])).toBe(true);
    expect(selectsGolden(["app/src/ui/Key.svelte", "docs/backlog.md"])).toBe(false);
  });
  it("the Find index is regenerated for find/ and its generator only", () => {
    expect(regeneratesIndex(["find/aliases.yaml"])).toBe(true);
    expect(regeneratesIndex(["tools/find-index/generate.mjs"])).toBe(true);
    expect(regeneratesIndex(["app/src/units/evaluate.ts"])).toBe(false);
  });
});

describe("summarizeSweep", () => {
  const ok = "  sweep known (G60) x\nSWEEP PASSED: 1182 runs of 1000 trees (seed 1): 781 numbers judged, 0 refused; oracle 14.0 s, total 37.4 s; 17 known failures, 0 new, 0 now passing";
  it("passes with the counts", () => {
    expect(summarizeSweep(ok, 0)).toEqual({ ok: true, detail: "1182 runs, 781 numbers judged, 17 known failures, sweep 37.4 s" });
  });
  it("fails on a new failure and names it", () => {
    const s = summarizeSweep("  sweep NEW rad 12 \\sin\\left(1\\right) [hang]: no answer\nSWEEP FAILED: 9 runs of 5 trees; total 9.0 s; 0 known failures, 1 new, 0 now passing", 1);
    expect(s.ok).toBe(false);
    expect(s.detail).toContain("1 to look at: NEW rad 12");
  });
  it("fails without the closing line", () => {
    expect(summarizeSweep("boom", 1).ok).toBe(false);
  });
});

describe("summarizeSeqSweep", () => {
  it("passes with the counts", () => {
    const ok = "  seq known (G69) x\nSEQ PASSED: 300 sequences (seed 1): 608 reads checked, 68 relaunches, total 5.6 s; 7 known failures, 0 new, 0 now passing";
    expect(summarizeSeqSweep(ok, 0)).toEqual({ ok: true, detail: "300 sequences, 608 reads checked, 7 known failures, 5.6 s" });
  });
  it("fails on a new failure and names it", () => {
    const s = summarizeSeqSweep("  seq NEW 12 store: x [store]: a\nSEQ FAILED: 3 sequences (seed 1): 4 reads checked, 0 relaunches, total 1.0 s; 0 known failures, 1 new, 0 now passing", 1);
    expect(s.ok).toBe(false);
    expect(s.detail).toContain("1 to look at: NEW 12 store");
  });
  it("fails without the closing line", () => {
    expect(summarizeSeqSweep("boom", 1).ok).toBe(false);
  });
});

describe("summarizeFindCensus", () => {
  it("passes with the counts", () => {
    const ok = "FINDCENSUS PASSED: 3314 runs of 1657 inputs (958 functions, 308 without a sample): checked 137, unchecked 793; 232 engine restarts; total 44.4 s; 474 findings filed, 0 class changes, 0 new findings, 0 now passing";
    expect(summarizeFindCensus(ok, 0)).toEqual({ ok: true, detail: "3314 runs of 1657 inputs, 474 findings filed, 44.4 s" });
  });
  it("fails on a class change and names it", () => {
    const s = summarizeFindCensus("  findcensus CHANGED home erfc/0: was checked, now wrong (x)\nFINDCENSUS FAILED: 2 runs of 1 inputs (1 functions, 0 without a sample): wrong 1; total 1.0 s; 0 findings filed, 1 class changes, 1 new findings, 0 now passing", 1);
    expect(s.ok).toBe(false);
    expect(s.detail).toContain("1 to look at: CHANGED home erfc/0");
  });
  it("fails without its last line", () => {
    expect(summarizeFindCensus("Error: no Find index", 1)).toEqual({ ok: false, detail: "exit 1: Error: no Find index" });
  });
});

describe("summarizeViewSweep", () => {
  it("passes with the counts", () => {
    const ok = "VIEWSWEEP PASSED: 48 expressions (seed 1), 1434 comparisons, total 17.7 s; 6 known failures, 0 new, 0 now passing";
    expect(summarizeViewSweep(ok, 0)).toEqual({ ok: true, detail: "48 expressions, 1434 comparisons, 6 known failures, 17.7 s" });
  });
  it("fails on a new failure and names it", () => {
    const s = summarizeViewSweep("  viewsweep NEW rad 0..1 \\ln x [area]: -1 against refused\nVIEWSWEEP FAILED: 48 expressions, 9 comparisons, total 9.0 s; 0 known failures, 1 new, 0 now passing", 1);
    expect(s.ok).toBe(false);
    expect(s.detail).toContain("1 to look at: NEW rad 0..1");
  });
});

describe("summarizeCasBack", () => {
  it("reads the counts of a passing stage", () => {
    const ok = "CASBACK PASSED: 123 questions (seed 1): 92 checked, 227 skipped as not checkable, 0 failed, total 0.6 s; 0 known failures, 0 new, 0 now passing";
    expect(summarizeCasBack(ok, 0)).toEqual({ ok: true, detail: "92 checked, 227 skipped, 0 failed (0 known), 0.6 s" });
  });
  it("names a new failure", () => {
    const s = summarizeCasBack("  casback NEW antiderivative: x [antiderivative]: a\nCASBACK FAILED: 3 questions (seed 1): 2 checked, 0 skipped as not checkable, 1 failed, total 1.0 s; 0 known failures, 1 new, 0 now passing", 1);
    expect(s.ok).toBe(false);
    expect(s.detail).toContain("1 to look at");
  });
});
