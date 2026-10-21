// SPDX-License-Identifier: GPL-3.0-or-later
// The gate's summary lines must say FAIL when a report says so, and name what failed. Fake reports in the shape of
// Vitest's and Playwright's JSON reporters.
import { describe, expect, it } from "vitest";
import {
  formatLine, isSolveReloadFailure, regeneratesIndex, selectsGolden, playwrightFailedSpecs, playwrightFailures, summarizeDocs, summarizeGolden, summarizePlaywright, summarizeSize, summarizeSweep, summarizeTypecheck, summarizeVitest, vitestFailures,
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
  it("re-runs only the solve.spec.ts reload tests, by title", () => {
    const t = (file: string, line: number, title: string) => ({ title, file, line, ok: false });
    const reload = t("solve.spec.ts", 142, "Solve: equations and values are stored");
    const reload2 = t("solve.spec.ts", 157, "Solve: the ⚠ of an answer is kept across a reload (M4-10)");
    const other = t("solve.spec.ts", 55, "Solve: x·e^x=5 with guess 1 gives the oracle root and the info line");
    const ok = (r: ReturnType<typeof t>[]) => playwrightFailedSpecs(pw(r.length, r)).every(isSolveReloadFailure);
    expect(ok([reload, reload2])).toBe(true);
    expect(ok([reload, other])).toBe(false);
    expect(ok([reload, t("keys.spec.ts", 142, "Solve: equations and values are stored")])).toBe(false);
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
