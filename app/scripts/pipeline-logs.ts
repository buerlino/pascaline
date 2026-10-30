// SPDX-License-Identifier: GPL-3.0-or-later
// What failed in a check log of scripts/pipeline.sh, and whether it was only a wall-clock test (TIMING_CHECKS in
// pipeline.sh). The shell calls this file:
//   node app/scripts/pipeline-logs.ts items <vitest|e2e|golden> <log>   # one "file<TAB>title" per failing item
//   node app/scripts/pipeline-logs.ts files <vitest|e2e|golden> <log>   # the failing files, sorted, unique
//   node app/scripts/pipeline-logs.ts timing <vitest|e2e|golden> <log>  # exit 0 when every failing item is a timing test
//   node app/scripts/pipeline-logs.ts mismatch <vitest|e2e> <log>      # prints the message, exit 0, when the parsed count differs from the runner's own
// Only erasable TypeScript syntax (Node runs this file).
import { readFileSync } from "node:fs";

export type Check = "vitest" | "e2e" | "golden";
export interface Item {
  file: string;
  title: string;
}

/** Removes ANSI escape sequences (colour codes do not match a plain `^ *FAIL`). */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "");
}

/** The failing items of a check log. */
export function failedItems(check: Check, log: string): Item[] {
  const lines = stripAnsi(log).split(/\r?\n/);
  const items: Item[] = [];
  if (check === "vitest") {
    for (const l of lines) {
      const m = /^\s*FAIL\s+(\S+\.test\.ts)\s*(?:>\s*(.*))?$/.exec(l);
      if (m) items.push({ file: m[1]!, title: (m[2] ?? "").trim() });
    }
    // a suite that fails to load: "FAIL  src/x.test.ts [ src/x.test.ts ]" (no "> title")
    for (const l of lines) {
      const m = /^\s*FAIL\s+(\S+\.test\.ts)\s*\[/.exec(l);
      if (m && !items.some((i) => i.file === m[1])) items.push({ file: m[1]!, title: "" });
    }
    // a file listed as failed without a FAIL line of its own
    for (const l of lines) {
      const m = /^\s*❯\s+(\S+\.test\.ts)\b.*\bfailed\b/.exec(l);
      if (m && !items.some((i) => i.file === m[1])) items.push({ file: m[1]!, title: "" });
    }
  } else if (check === "e2e") {
    for (const l of lines) {
      const m = /^\s*\d+\)\s+\[[^\]]*\]\s+›\s+(?:test\/)?([^\s:]+\.spec\.ts):\d+:\d+\s+›\s+(.*?)\s*(?:─+)?\s*$/.exec(l);
      if (m) items.push({ file: m[1]!, title: m[2]! });
    }
  } else {
    for (const l of lines) {
      const m = /^FAIL\s+([^:\s]+):\s*(.*)$/.exec(l);
      if (!m) continue;
      const parts = m[1] === "steps" ? stepsItems(lines, m[2]!) : m[1] === "flags" ? flagsItems(m[2]!) : null;
      if (parts) items.push(...parts); else items.push({ file: m[1]!, title: m[2]! });
    }
  }
  return items;
}

/** A51: the golden `steps` stage fails with one line per new finding above its FAIL line ("  steps <stage> <id> [kind] ..."):
 *  one item per finding (title "<stage>/<id>"). Null (the stage as one item) when its canary failed or the findings printed
 *  are not the number the stage counted. */
function stepsItems(lines: string[], title: string): Item[] | null {
  const n = /: (\d+) new findings, \d+ known$/.exec(title);
  if (!n || !title.startsWith("PASS step-budget-test")) return null;
  const found = lines.flatMap((l) => {
    const m = /^ {2}steps (?!known )(\S+) (\S+) \[/.exec(l);
    return m ? [{ file: "steps", title: `${m[1]}/${m[2]}` }] : [];
  });
  return found.length === Number(n[1]) && found.length > 0 ? found : null;
}

/** A51: the golden `flags` stage joins the last lines of its sub-tests with " | "; a sub-test that failed is a segment
 *  "FAIL <file>: ..." (app/scripts/golden/engine.ts). One item per such segment (title "<file>: ..."); null when none. */
function flagsItems(title: string): Item[] | null {
  const failed = title.split(" | ").flatMap((seg) => {
    const m = /^FAIL (\S+?): (.*)$/.exec(seg);
    return m ? [{ file: "flags", title: `${m[1]}: ${m[2]}` }] : [];
  });
  return failed.length > 0 ? failed : null;
}

/** Golden steps cases that differ between the real clock and the 8× fast one only under load: Home's 300 ms budget (the
 *  agreement run of chisquare_icdf, the doubling of sin(10^2000)) is read from performance.now (A51, 3 runs at load 20-30). */
const STEPS_LOAD_ITEMS = new Set(["precision/prec-g44f2f1-chisquare_icdf-1-0.95-12", "precision/prec-G23-sin-1e2000"]);
/** Golden flags sub-tests that run out of golden/engine.ts's spawnSync timeout under load: 40 gunzips of the Giac tarball. */
const FLAGS_LOAD_ITEMS = /^(?:patch-canary\.ts|canaries\.mjs): timed out after \d+ s$/;

/** A wall-clock test: the Find 16 ms/key test, the golden units p95 bar, two golden steps cases and two flags sub-tests (A51), solve.spec.ts persistence, the clipboard poll, the G78 timing case, Home's acos deadline, the G83 library restore and first call, the Esc-before-Working test; FLAKES 1: G39's 3*int(1/x), the CAS -> Home budget, 10^1000000+7, the parser fuzz, Working… after 150 ms.
 *  Not the golden g58-factorial cases: the golden log names only the stage ("FAIL precision: n/m active match"), the case id is on a plain line above it. */
export function isTiming(check: Check, item: Item): boolean {
  if (check === "vitest") {
    return (item.file.endsWith("find/queries.test.ts") && /takes well under/.test(item.title)) ||
      (item.file.endsWith("engine/novalue.test.ts") && /timing case/.test(item.title)) ||
      (item.file.endsWith("engine/homeDeadline.test.ts") && /(?:^|> )acos\(120\^\(5\/2\+5\)\) answers/.test(item.title)) ||
      (item.file.endsWith("engine/library.test.ts") && /restore\(\) of the 200 takes under 50 ms/.test(item.title)) ||
      // F106 (FLAKES 78): its 1 ms Giac timeout races the interrupt under load
      (item.file.endsWith("engine/flags.test.ts") && /G102: a Digits set right after an interrupted call/.test(item.title)) ||
      // FLAKES 1 (2026-10-26, load 20-40): Giac's 1.5 s clock, a 2 s total, the 5 s test timeout
      (item.file.endsWith("engine/converge.test.ts") && /Home and CAS refuse 3\*int\(1\/x,x,-1,1\)\+1$/.test(item.title)) ||
      (item.file.endsWith("engine/host.test.ts") && /switching CAS -> Home restores Home's 300 ms budget/.test(item.title)) ||
      (item.file.endsWith("engine/valueKind.test.ts") && /10\^1000000\+7 is exact/.test(item.title)) ||
      (item.file.endsWith("input/fuzz.test.ts") && /20000 random token strings parse or fail/.test(item.title));
  }
  if (check === "e2e") {
    return (item.file === "working.spec.ts" && /Esc stops a job before Working… shows|a job shows Working… and Cancel only after 150 ms/.test(item.title)) ||
      (item.file === "solve.spec.ts" && /equations and values are stored|kept across a reload/.test(item.title)) ||
      (item.file === "copy.spec.ts" && /copy → paste gives the value back/.test(item.title));
  }
  if (item.file === "steps") return STEPS_LOAD_ITEMS.has(item.title);
  if (item.file === "flags") return FLAGS_LOAD_ITEMS.test(item.title);
  // units: every case matched (n/n) and only the p95 bar was missed
  const m = /(\d+)\/(\d+) match/.exec(item.title);
  return item.file === "units" && !!m && m[1] === m[2] && /p95 [\d.]+ ms \(≤/.test(item.title);
}

/** The runner's own failure count against the items we parsed (vitest: failed files; e2e: failed tests); null when they agree or there is no summary. */
export function countMismatch(check: Check, log: string): string | null {
  const items = failedItems(check, log);
  const text = stripAnsi(log);
  if (check === "vitest") {
    const m = /Test Files\s+(\d+) failed/.exec(text);
    const parsed = new Set(items.map((i) => i.file)).size;
    return m && Number(m[1]) !== parsed ? `parsed ${parsed} failing files, vitest says ${m[1]} failed` : null;
  }
  if (check === "e2e") {
    const m = /^\s*(\d+) failed\s*$/m.exec(text);
    return m && Number(m[1]) !== items.length ? `parsed ${items.length} failing tests, Playwright says ${m[1]} failed` : null;
  }
  return null;
}

/** True when something failed and every failing item is a timing test. */
export function onlyTiming(check: Check, log: string): boolean {
  const items = failedItems(check, log);
  // the summary counts what failed: if we found fewer, something failed that we did not see
  if (countMismatch(check, log) !== null) return false;
  return items.length > 0 && items.every((i) => isTiming(check, i));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [cmd, check, path] = process.argv.slice(2);
  if (!cmd || !path || !["vitest", "e2e", "golden"].includes(check ?? "")) {
    console.error("usage: pipeline-logs.ts items|files|timing|mismatch <vitest|e2e|golden> <log>");
    process.exit(2);
  }
  const log = readFileSync(path, "utf8");
  const c = check as Check;
  if (cmd === "mismatch") { const m = countMismatch(c, log); if (m !== null) console.log(m); process.exit(m !== null ? 0 : 1); }
  if (cmd === "timing") process.exit(onlyTiming(c, log) ? 0 : 1);
  const items = failedItems(c, log);
  if (cmd === "files") console.log([...new Set(items.map((i) => i.file))].sort().join("\n"));
  else for (const i of items) console.log(`${i.file}\t${i.title}`);
}
