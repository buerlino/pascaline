// SPDX-License-Identifier: GPL-3.0-or-later
// G88: the ratchet on text matches (P20). Lines that read text with a pattern or a hand-written bracket loop are counted per
// file under src/engine and src/units against scripts/text-baseline.json; a rising count fails the gate's `rules` stage.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

/** What counts: a pattern method over text, a RegExp, an indexOf over a string literal, a bracket compare or depth counter. */
const TEXT_LINE = [
  /\.(?:match|matchAll)\(/,
  /\.(?:replace|replaceAll|split|search|test|exec)\(\s*\//,
  /new RegExp\(/,
  /\.(?:indexOf|lastIndexOf)\(\s*["'`]/,
  /\b(?:depth|level|nest|parens?)\s*(?:\+\+|--|\+=\s*1|-=\s*1)/,
  /===?\s*["'][()[\]{}]["']/,
];
/** Giac API evaluation outside the engine and units directories. */
const EVAL_CALL = /\.eval\(/;
/** The golden bench worker drives Giac directly by design. */
export const EVAL_EXEMPT = new Set(["src/golden.worker.ts"]);

export interface Hit {
  line: number;
  text: string;
}

const isComment = (l: string): boolean => /^\s*(\/\/|\*|\/\*)/.test(l);

function scan(source: string, patterns: RegExp[]): Hit[] {
  const hits: Hit[] = [];
  source.split("\n").forEach((l, i) => {
    if (!isComment(l) && patterns.some((p) => p.test(l))) hits.push({ line: i + 1, text: l.trim() });
  });
  return hits;
}

/** The lines of a source text that read text with a pattern. Comments count nothing. */
export function textLines(source: string): Hit[] {
  return scan(source, TEXT_LINE);
}

/** The lines that call the Giac API's `.eval(`. */
export function evalLines(source: string): Hit[] {
  return scan(source, [EVAL_CALL]);
}

export const isTestFile = (path: string): boolean => /\.(test|spec)\.ts$/.test(path);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|svelte)$/.test(name) && !isTestFile(name)) out.push(p);
  }
  return out;
}

export const TEXT_DIRS = ["src/engine", "src/units"];
export type Baseline = Record<string, number>;

/** Counts per file (relative to app/) of the text lines under the counted directories. */
export function countAll(app: string): { counts: Baseline; hits: Record<string, Hit[]> } {
  const counts: Baseline = {};
  const hits: Record<string, Hit[]> = {};
  for (const d of TEXT_DIRS) {
    if (!existsSync(join(app, d))) continue;
    for (const f of walk(join(app, d))) {
      const h = textLines(readFileSync(f, "utf8"));
      if (h.length > 0) {
        const rel = relative(app, f);
        counts[rel] = h.length;
        hits[rel] = h;
      }
    }
  }
  return { counts, hits };
}

/** `.eval(` calls in src outside the counted directories. */
export function evalOutside(app: string): string[] {
  const bad: string[] = [];
  for (const f of walk(join(app, "src"))) {
    const rel = relative(app, f);
    if (TEXT_DIRS.some((d) => rel.startsWith(`${d}/`)) || EVAL_EXEMPT.has(rel)) continue;
    for (const h of evalLines(readFileSync(f, "utf8"))) bad.push(`${rel}:${h.line}: ${h.text}`);
  }
  return bad;
}

export interface Verdict {
  ok: boolean;
  detail: string;
  failures: string[];
}

/** Compares counts to the baseline: a rise (or a new file) fails; a fall asks to lower the baseline. */
export function judge(counts: Baseline, baseline: Baseline, hits: Record<string, Hit[]>, evals: string[]): Verdict {
  const failures: string[] = [];
  let lower = 0;
  for (const [f, n] of Object.entries(counts)) {
    const b = baseline[f] ?? 0;
    if (n > b) {
      const lines = (hits[f] ?? []).map((h) => h.line).join(",");
      failures.push(`${f}: ${n} text lines, baseline ${b} (lines ${lines})`);
    }
  }
  for (const [f, b] of Object.entries(baseline)) if ((counts[f] ?? 0) < b) lower++;
  for (const e of evals) failures.push(`.eval( outside engine/units: ${e}`);
  const total = Object.values(counts).reduce((a, n) => a + n, 0);
  if (failures.length > 0) return { ok: false, detail: `${failures.length} failed: ${failures.slice(0, 3).join("; ")}`, failures };
  const note = lower > 0 ? `; ${lower} file${lower > 1 ? "s" : ""} below baseline: lower the baseline (npm run gate -- --update-text-baseline)` : "";
  return { ok: true, detail: `${total} text lines in ${Object.keys(counts).length} files${note}`, failures };
}

export const baselinePath = (app: string): string => join(app, "scripts/text-baseline.json");

export function readBaseline(app: string): Baseline {
  try {
    return JSON.parse(readFileSync(baselinePath(app), "utf8")) as Baseline;
  } catch {
    return {};
  }
}

export function writeBaseline(app: string, counts: Baseline): void {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(baselinePath(app), `${JSON.stringify(sorted, null, 2)}\n`);
}

/** The baseline's total per directory. */
export function totals(counts: Baseline): Record<string, number> {
  const t: Record<string, number> = {};
  for (const d of TEXT_DIRS) t[d] = 0;
  for (const [f, n] of Object.entries(counts)) for (const d of TEXT_DIRS) if (f.startsWith(`${d}/`)) t[d] = (t[d] ?? 0) + n;
  return t;
}
