// SPDX-License-Identifier: GPL-3.0-or-later
// The gate's summary lines must say FAIL when a report says so, and name what failed. Fake reports in the shape of
// Vitest's and Playwright's JSON reporters.
import { describe, expect, it } from "vitest";
import {
  formatLine, playwrightFailures, summarizeDocs, summarizeGolden, summarizePlaywright, summarizeSize, summarizeTypecheck, summarizeVitest, vitestFailures,
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
  });
  it("size: lists the failures", () => {
    const out = "table\n\nsize-check FAILED:\n  start chunk 300 kB > 250 kB\n  find 9 > 8\nA budget changes only";
    expect(summarizeSize(out, 1)).toEqual({ ok: false, detail: "2 over: start chunk 300 kB > 250 kB; find 9 > 8" });
    expect(summarizeSize("size-check passed", 0).ok).toBe(true);
  });
  it("docs: reports sizes, fails only over a set limit", () => {
    expect(summarizeDocs([{ file: "a.md", bytes: 30_000, limit: null }]).ok).toBe(true);
    expect(summarizeDocs([{ file: "a.md", bytes: 30_000, limit: 25_000 }]).ok).toBe(false);
  });
});

describe("line format", () => {
  it("is one line: verdict, name, detail, time", () => {
    expect(formatLine("typecheck", { ok: true, detail: "0 errors" }, 12_300)).toBe("PASS typecheck 0 errors (12 s)");
    expect(formatLine("e2e", { ok: false, detail: "2 of 214 failed: a.spec.ts:40" }, 400_000)).toBe("FAIL e2e 2 of 214 failed: a.spec.ts:40 (7 min)");
  });
});
