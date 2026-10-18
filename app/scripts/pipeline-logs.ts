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
      if (m) items.push({ file: m[1]!, title: m[2]! });
    }
  }
  return items;
}

/** A wall-clock test: the Find 16 ms/key test, the golden units p95 bar, solve.spec.ts persistence, the clipboard poll. */
export function isTiming(check: Check, item: Item): boolean {
  if (check === "vitest") return item.file.endsWith("find/queries.test.ts") && /takes well under/.test(item.title);
  if (check === "e2e") {
    return (item.file === "solve.spec.ts" && /equations and values are stored|kept across a reload/.test(item.title)) ||
      (item.file === "copy.spec.ts" && /copy → paste gives the value back/.test(item.title));
  }
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
