// SPDX-License-Identifier: GPL-3.0-or-later
// The pure half of `npm run gate` (scripts/gate.ts): turns Vitest's and Playwright's JSON reports (never their text)
// into one summary line each. Kept apart from gate.ts so a test can feed it fake reports.

export interface Summary {
  ok: boolean;
  /** The text after `PASS name ` / `FAIL name `, without the duration. */
  detail: string;
}

/** At most this many failing tests are named on a FAIL line; the rest are counted. */
const NAMED = 4;

function failLine(total: number, names: string[], what: string): string {
  const shown = names.slice(0, NAMED).join(", ");
  const more = names.length > NAMED ? `, +${names.length - NAMED} more` : "";
  return `${names.length} of ${total} ${what}: ${shown}${more}`;
}

interface VitestReport {
  numTotalTests?: number;
  numPassedTests?: number;
  numFailedTests?: number;
  numPendingTests?: number;
  testResults?: {
    name?: string;
    status?: string;
    message?: string;
    assertionResults?: { status?: string; fullName?: string }[];
  }[];
}

function base(path: string): string {
  return path.split("/").pop() ?? path;
}

/** Vitest's `--reporter=json`. A file that failed to load has no assertions: it is named by its file. */
export function summarizeVitest(report: unknown): Summary {
  const r = report as VitestReport | null;
  if (!r || typeof r.numTotalTests !== "number" || !Array.isArray(r.testResults)) return { ok: false, detail: "no usable report" };
  const names: string[] = [];
  for (const file of r.testResults) {
    const failedTests = (file.assertionResults ?? []).filter((a) => a.status === "failed");
    for (const a of failedTests) names.push(`${base(file.name ?? "?")} "${a.fullName ?? "?"}"`);
    if (file.status === "failed" && failedTests.length === 0) names.push(`${base(file.name ?? "?")} (did not load)`);
  }
  const files = r.testResults.length;
  if (names.length > 0 || (r.numFailedTests ?? 0) > 0) return { ok: false, detail: failLine(r.numTotalTests, names, "tests failed") };
  if (r.numTotalTests === 0) return { ok: false, detail: "0 tests ran" };
  const skipped = (r.numPendingTests ?? 0) > 0 ? `, ${r.numPendingTests} skipped` : "";
  return { ok: true, detail: `${r.numPassedTests} tests in ${files} files${skipped}` };
}

/** The failed tests of a Vitest report as `{ file, title }` (full path of the file), for the gate's one re-run of a timing test. */
export function vitestFailures(report: unknown): { file: string; title: string }[] {
  const out: { file: string; title: string }[] = [];
  for (const f of (report as VitestReport | null)?.testResults ?? [])
    for (const a of f.assertionResults ?? []) if (a.status === "failed") out.push({ file: f.name ?? "?", title: a.fullName ?? "?" });
  return out;
}

interface PwSpec {
  title?: string;
  file?: string;
  ok?: boolean;
  line?: number;
}
interface PwSuite {
  specs?: PwSpec[];
  suites?: PwSuite[];
}
interface PwReport {
  stats?: { expected?: number; unexpected?: number; flaky?: number; skipped?: number };
  suites?: PwSuite[];
  errors?: { message?: string }[];
}

/** The failing specs of a Playwright report as `file:line` (all of them, in order). */
export function playwrightFailures(report: unknown): string[] {
  const out: string[] = [];
  const walk = (s: PwSuite): void => {
    for (const spec of s.specs ?? []) if (spec.ok === false) out.push(`${base(spec.file ?? "?")}:${spec.line ?? 0}`);
    for (const c of s.suites ?? []) walk(c);
  };
  for (const s of (report as PwReport | null)?.suites ?? []) walk(s);
  return out;
}

/** The failing specs of a Playwright report with file, line and title. */
export function playwrightFailedSpecs(report: unknown): { file: string; line: number; title: string }[] {
  const out: { file: string; line: number; title: string }[] = [];
  const walk = (s: PwSuite): void => {
    for (const spec of s.specs ?? []) if (spec.ok === false) out.push({ file: base(spec.file ?? "?"), line: spec.line ?? 0, title: spec.title ?? "" });
    for (const c of s.suites ?? []) walk(c);
  };
  for (const s of (report as PwReport | null)?.suites ?? []) walk(s);
  return out;
}

/** The two solve.spec.ts tests that reload the page and read what was stored (brief section 8: the known-flaky persistence test). */
export function isSolveReloadFailure(f: { file: string; title: string }): boolean {
  return f.file === "solve.spec.ts" && /equations and values are stored|kept across a reload/.test(f.title);
}

/** Playwright's `--reporter=json`. */
export function summarizePlaywright(report: unknown): Summary {
  const r = report as PwReport | null;
  if (!r || !r.stats) return { ok: false, detail: "no usable report" };
  const { expected = 0, unexpected = 0, flaky = 0, skipped = 0 } = r.stats;
  const total = expected + unexpected + flaky + skipped;
  const failed = playwrightFailures(r);
  if (unexpected > 0 || failed.length > 0) return { ok: false, detail: failLine(total, failed.length > 0 ? failed : Array(unexpected).fill("?"), "failed") };
  if ((r.errors?.length ?? 0) > 0) return { ok: false, detail: `${r.errors?.length} errors outside tests: ${(r.errors?.[0]?.message ?? "").split("\n")[0]}` };
  if (expected + flaky === 0) return { ok: false, detail: "0 tests ran" };
  const extra = (flaky > 0 ? `, ${flaky} flaky` : "") + (skipped > 0 ? `, ${skipped} skipped` : "");
  return { ok: true, detail: `${expected + flaky} of ${total}${extra}` };
}

/** `PASS typecheck 0 errors (12 s)` / `FAIL e2e 2 of 214 failed: a.spec.ts:40, … (3 min)`. */
export function formatLine(name: string, s: Summary, ms: number): string {
  return `${s.ok ? "PASS" : "FAIL"} ${name} ${s.detail} (${duration(ms)})`;
}

export function duration(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 120 ? `${s} s` : `${Math.round(s / 60)} min`;
}

/** svelte-check's counts: `COMPLETED 578 FILES 0 ERRORS 0 WARNINGS …` (its machine output, what CI shows) or `svelte-check found 0 errors and 0 warnings`. */
export function summarizeTypecheck(out: string, exitCode: number): Summary {
  const m = /found (\d+) errors? and (\d+) warnings?/.exec(out) ?? /(\d+) ERRORS (\d+) WARNINGS/.exec(out);
  if (!m) return { ok: false, detail: exitCode === 0 ? "no count in the output" : `exit ${exitCode}, no count in the output` };
  const errors = Number(m[1]);
  const warnings = Number(m[2]);
  const ok = exitCode === 0 && errors === 0 && warnings === 0;
  return { ok, detail: `${errors} errors${warnings > 0 ? `, ${warnings} warnings` : ""}` };
}

/** The golden gate ends with `GOLDEN GATE PASSED`, or `GOLDEN GATE FAILED: <stages>`. */
export function summarizeGolden(out: string, exitCode: number): Summary {
  if (exitCode === 0 && /GOLDEN GATE PASSED/.test(out)) return { ok: true, detail: "GOLDEN GATE PASSED" };
  const failed = /GOLDEN GATE FAILED: (.*)/.exec(out);
  if (failed) return { ok: false, detail: `stages failed: ${failed[1]}` };
  return { ok: false, detail: `exit ${exitCode}, no GOLDEN GATE PASSED: ${out.trim().split("\n").slice(-1)[0]?.slice(0, 120) ?? ""}` };
}

/** The size test exits 1 over a budget and lists each failure indented after `size-check FAILED:`. */
export function summarizeSize(out: string, exitCode: number): Summary {
  if (exitCode === 0) return { ok: true, detail: "inside the budgets" };
  const lines = out.split("\n");
  const at = lines.findIndex((l) => l.includes("size-check FAILED"));
  const bad = at < 0 ? [] : lines.slice(at + 1).filter((l) => l.startsWith("  ")).map((l) => l.trim().slice(0, 100));
  return { ok: false, detail: bad.length > 0 ? `${bad.length} over: ${bad.slice(0, 3).join("; ")}` : `exit ${exitCode}` };
}

/** A docs-size budget row: file, bytes, limit (null = only reported until S7 sets one). */
export interface DocSize {
  file: string;
  bytes: number;
  limit: number | null;
}

/** Reports the sizes. A limit is enforced once one is set (S7); none is set today, so this never fails. */
export function summarizeDocs(sizes: DocSize[]): Summary {
  const over = sizes.filter((d) => d.limit !== null && d.bytes > d.limit);
  const kb = (n: number): string => `${(n / 1000).toFixed(1)} kB`;
  const list = sizes.map((d) => `${d.file} ${kb(d.bytes)}${d.limit !== null ? `/${kb(d.limit)}` : ""}`).join(", ");
  if (over.length > 0) return { ok: false, detail: `over budget: ${over.map((d) => d.file).join(", ")} (${list})` };
  return { ok: true, detail: `${list}${sizes.every((d) => d.limit === null) ? " (reported only until S7 sets budgets)" : ""}` };
}
