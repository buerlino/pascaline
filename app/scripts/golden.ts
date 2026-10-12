// SPDX-License-Identifier: GPL-3.0-or-later
// The golden gate: every tests/golden/*.yaml file against one engine build. Run it on every engine
// build that ships (CLAUDE.md). Exit 0 only if every stage passes.
//   npm run golden                                  # engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl
//   GIAC_MJS=/path/giac.mjs ROUNDS=5 npm run golden
//   ONLY=home,parser npm run golden                 # stages: interrupt, home, precision, solve, function, bench, parser, python
// Stages:
//   interrupt  tests/engine/interrupt-test.mjs (Giac patch 0002): 16 forced interrupts, no escapes
//   home       exact-first Home through EngineHost: every case matches with its mark, same in every round,
//              median ≤ 500 ms
//   precision  tests/golden/precision.yaml (docs/04 2.3 regression list, 20/30-digit cases): Home and CAS at the case's
//              digits, value and mark. A case with `status: pending` is known to fail until its fix: it never fails
//              the gate, and is listed as still pending or now passing. A result shown with ⚠ n (fewer confirmed
//              digits than asked) must equal `expect` rounded to those n digits.
//   solve      Solve strategy: 1-D (solve1.ts), systems and polynomials (solve.ts); every case matches in
//              every round, and no ⚠ unless the case has status "warn"
//   function   Function analysis and Num table (analysis.ts), same rules
//   bench      the 55 benchmark inputs in CAS mode: `expect` (derived) cases match; errors are listed
//   parser     LaTeX → Giac (our parser) equals the intended expression, decided by Giac; gaps never fail.
//              A case with `error: true` passes when the parser rejects the input (a message, never a guess);
//              `chips:` is the entry's chip table (\res, \ans, \const; docs/04 section 3.6)
//   python     tests/golden/python.yaml: MicroPython ($PYTHON_OUT, else python/_out/dev) with calc on this Giac;
//              output, errors with lines, calc, Cancel (worker terminated, fresh runtime works), graphics
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { EngineHost, type GiacApi } from "../src/engine/host.ts";
import { defaultHomeSettings, type HomeResult, type HomeSettings } from "../src/engine/homeEval.ts";
import { decimalFromString, formatReal, markOf, toText, type MarkInfo } from "../src/engine/format.ts";
import { giacMjsPath, loadNodeGiac } from "../src/engine/nodeGiac.ts";
import { defaultSolveSettings, solve1, type SolveResult } from "../src/engine/solve1.ts";
import { defaultCasSettings } from "../src/engine/types.ts";
import type { ChipTable } from "../src/input/chips.ts";
import { latexToGiac, resetUserFunctions, SerializeError } from "../src/input/latex-to-giac.ts";
import { Worker } from "node:worker_threads";
import { createCalcHost } from "../src/python/calcHost.ts";
import { loadNodeMath } from "../src/python/nodeMath.ts";
import { loadNodePyHost, micropythonAvailable, micropythonMjsPath } from "../src/python/nodePython.ts";
import type { GfxCmd, PyResult } from "../src/python/types.ts";

type Expect = string | Expect[];

interface Case {
  id: string;
  kind?: string;
  input?: string;
  latex?: string;
  eq?: string | string[];
  var?: string | string[];
  guess?: string | string[];
  f?: string | string[];
  g?: string;
  x0?: string;
  lo?: string;
  hi?: string;
  a?: string;
  b?: string;
  xs?: string[];
  settings?: { angle?: "rad" | "deg"; digits?: number };
  expect?: Expect;
  /** home.yaml, precision.yaml: the mark before the result (docs/04 2.4), checked by oracle.py; by this gate once the engine reports it. */
  mark?: "=" | "≈" | "⚠";
  source?: string;
  g2?: number;
  status?: string;
  /** parser.yaml: input settings for this case (L6). */
  options?: { decimalComma?: boolean; realOddRoots?: boolean };
  /** parser.yaml: entries typed before this one (e.g. a function definition, L6). */
  before?: string[];
  /** parser.yaml: the input must be rejected by the parser (docs/04 2.3 #1). */
  error?: boolean;
  /** parser.yaml: the entry's chip table (\res, \ans, \const), keyed as in app/src/input/chips.ts. */
  chips?: ChipTable;
  note?: string;
}

const root = fileURLToPath(new URL("../../", import.meta.url));
const mjs = giacMjsPath();
const ROUNDS = Number(process.env.ROUNDS ?? 5);
const HOME_LIMIT_MS = 500;
const only = process.env.ONLY?.split(",").map((s) => s.trim());
const want = (stage: string) => !only || only.includes(stage);

function cases(file: string): Case[] {
  const doc = parse(readFileSync(`${root}tests/golden/${file}`, "utf8")) as { cases: Case[] };
  return doc.cases;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

async function freshGiac(): Promise<GiacApi> {
  return (await loadNodeGiac(mjs)).giac;
}

const summary: { stage: string; ok: boolean; line: string }[] = [];
function report(stage: string, ok: boolean, line: string): void {
  summary.push({ stage, ok, line });
  console.log(`${ok ? "PASS" : "FAIL"} ${stage}: ${line}`);
}

function stageInterrupt(): void {
  const r = spawnSync(process.execPath, [`${root}tests/engine/interrupt-test.mjs`], {
    env: { ...process.env, GIAC_MJS: mjs },
    encoding: "utf8",
    timeout: 300_000,
  });
  const out = `${r.stdout}${r.stderr}`.trim();
  report("interrupt", r.status === 0, out.split("\n").slice(-3).join(" | "));
}

async function stageHome(): Promise<void> {
  const cs = cases("home.yaml");
  const runs = new Map<string, HomeResult[]>(cs.map((c) => [c.id, []]));
  for (let r = 0; r < ROUNDS; r++) {
    const host = new EngineHost(await freshGiac());
    for (const c of cs) {
      const s: HomeSettings = { ...defaultHomeSettings, angle: c.settings?.angle ?? "rad" };
      runs.get(c.id)!.push(host.home(c.input!, s).result);
    }
  }
  let pass = 0;
  let slow = 0;
  let maxMed = 0;
  let assumed = 0;
  let marks = 0;
  for (const c of cs) {
    const rs = runs.get(c.id)!;
    const shown = rs[0]!.display;
    const got = rs.map((x) => markText(markOf(x, { format: "STD", digits: 12 })));
    const markOk = !c.mark || got.every((m) => m?.startsWith(c.mark!));
    if (c.mark) marks++;
    const ok = rs.every((x) => x.display === c.expect) && markOk;
    const med = median(rs.map((x) => x.totalMs));
    maxMed = Math.max(maxMed, med);
    if (ok) pass++;
    else console.log(`  home ${c.id}: got ${rs.map((x, k) => `${got[k] ?? "-"} ${x.display}`).join(" / ")}, expect ${c.mark ?? ""} ${c.expect}`);
    if (!(med <= HOME_LIMIT_MS)) {
      slow++;
      console.log(`  home ${c.id}: median ${med.toFixed(1)} ms > ${HOME_LIMIT_MS} ms (${shown})`);
    }
    if (c.source === "assumed") assumed++;
  }
  report(
    "home",
    pass === cs.length && slow === 0,
    `${pass}/${cs.length} match with their mark (${assumed} assumed, ${marks} marks checked), ${slow} over ${HOME_LIMIT_MS} ms, max median ${maxMed.toFixed(1)} ms, rounds ${ROUNDS}`,
  );
}

/** A mark as text: "=", "≈", "⚠", or "⚠11" (eleven confirmed digits). */
function markText(m: MarkInfo | null): string | undefined {
  return m ? `${m.mark}${m.n ?? ""}` : undefined;
}

const RATIONAL_TEXT = /^-?\d+(\/\d+)?$/;

/** `expect` (STD at the case's digits) rounded again to n digits, or null when that could round the wrong way
 *  (the dropped part is exactly 5: the case then needs a longer expect). */
function expectAt(expect: string, n: number): string | null {
  const v = decimalFromString(expect.replace("E", "e"));
  if (!v) return null;
  if (v.digits.slice(n) === "5") return null;
  return toText(formatReal(v, { format: "STD", digits: n }));
}

const LOOKS_NUMERIC = /^-?(\d+(\.\d+)?|\.\d+)(E[+-]?\d+)?([+-](\d+(\.\d+)?(E[+-]?\d+)?\*)?i)?$/;

async function stagePrecision(): Promise<void> {
  const cs = cases("precision.yaml");
  const host = new EngineHost(await freshGiac());
  let active = 0;
  let activePass = 0;
  const pending: string[] = [];
  const nowPassing: string[] = [];
  let marksChecked = 0;
  for (const c of cs) {
    const problems: string[] = [];
    let mark: MarkInfo | null;
    let shown: string;
    const digits = c.settings?.digits ?? 12;
    if (c.kind === "cas") {
      const r = host.cas(c.input!, { ...defaultCasSettings, digits }).result;
      shown = r.ok ? r.text : `error: ${r.error ?? "engine"}`;
      // A float result carries its numeric facts; an exact rational CAS result is exact (no mark is drawn for it).
      mark = r.numeric ? markOf(r.numeric, { format: "STD", digits }) : r.ok && RATIONAL_TEXT.test(r.text) ? { mark: "=" } : null;
    } else {
      const s: HomeSettings = { ...defaultHomeSettings, angle: c.settings?.angle ?? "rad", digits };
      const r = host.home(c.input!, s).result;
      shown = r.ok ? r.display : `error: ${r.display}`;
      mark = markOf(r, { format: "STD", digits });
    }
    if (c.expect !== undefined) {
      // ⚠ n: the result shows only its n confirmed digits; those must be the oracle's.
      const want = mark?.mark === "⚠" && mark.n !== undefined && mark.n < digits ? expectAt(String(c.expect), Math.max(1, mark.n)) : String(c.expect);
      if (want === null) problems.push(`expect ${String(c.expect)} cannot be rounded to ${mark?.n} digits safely: give more digits`);
      else if (shown !== want) problems.push(`got ${shown}, expect ${want}${want !== c.expect ? ` (${c.expect} at ${mark?.n} digits)` : ""}`);
    }
    // A mark-only case still needs an answer: the input echoed back (BesselJ(1,2) at 30 digits) is a lost result.
    if (c.expect === undefined && !LOOKS_NUMERIC.test(shown)) problems.push(`answer is not a number: ${shown}`);
    if (c.mark) {
      marksChecked++;
      if (!mark || mark.mark !== c.mark) problems.push(`mark ${markText(mark) ?? "none"}, expect ${c.mark}`);
    }
    if (c.status === "pending") {
      if (problems.length === 0) nowPassing.push(c.id);
      else pending.push(c.id);
      console.log(`  precision ${c.id}: pending${problems.length ? ` (${problems.join("; ")})` : ""}`);
    } else {
      active++;
      if (problems.length === 0) activePass++;
      else console.log(`  precision ${c.id}: ${problems.join("; ")}`);
    }
  }
  const pendingNote = `${pending.length} pending${nowPassing.length ? `, ${nowPassing.length} NOW PASSING (remove status: ${nowPassing.join(", ")})` : ""}`;
  report(
    "precision",
    activePass === active,
    `${activePass}/${active} active match; ${pendingNote}; ${marksChecked} marks checked`,
  );
}

/** What a case produced: the shown text(s), and whether ⚠ was raised. */
interface Got {
  shown: Expect;
  warn: boolean;
}

const same = (a: Expect, b: Expect | undefined): boolean => JSON.stringify(a) === JSON.stringify(b);
const str = (x: string | string[] | undefined): string => (Array.isArray(x) ? x[0]! : x!);
const list = (x: string | string[] | undefined): string[] => (Array.isArray(x) ? x : [x!]);

function solveCase(host: EngineHost, g: GiacApi, c: Case): Got {
  if (!c.kind) {
    const r: SolveResult = solve1(g, str(c.eq), str(c.var), str(c.guess), defaultSolveSettings);
    return { shown: r.display, warn: r.warn };
  }
  const r =
    c.kind === "poly"
      ? host.solve({ kind: "poly", equation: str(c.eq), unknown: str(c.var) }, defaultHomeSettings)
      : host.solve({ kind: "equations", equations: list(c.eq), unknowns: list(c.var), guesses: list(c.guess) }, defaultHomeSettings);
  if (r.ok) return { shown: r.roots.map((x) => x.result.display), warn: r.warn };
  return { shown: r.error === "bad-input" && c.kind === "poly" ? "not a polynomial" : r.error === "no-root" ? "no root found" : r.info, warn: r.warn };
}

function functionCase(host: EngineHost, c: Case): Got {
  const s = defaultHomeSettings;
  if (c.kind === "table") {
    const rows = host.table({ fns: list(c.f), xs: c.xs!, variable: str(c.var ?? "x") }, s);
    return { shown: rows.map((row) => row.map((x) => x.display)), warn: false };
  }
  const f = str(c.f);
  const variable = str(c.var ?? "x");
  const r =
    c.kind === "slope"
      ? host.analyze({ kind: "slope", f, x0: c.x0!, variable }, s)
      : c.kind === "area"
        ? host.analyze({ kind: "area", f, ...(c.g ? { g: c.g } : {}), a: c.a!, b: c.b!, variable }, s)
        : c.kind === "intersection"
          ? host.analyze({ kind: "intersection", f, g: c.g!, x0: c.x0!, lo: c.lo, hi: c.hi, variable }, s)
          : host.analyze({ kind: c.kind === "extremum" ? "extremum" : "root", f, x0: c.x0!, lo: c.lo, hi: c.hi, variable }, s);
  if (!r.ok) return { shown: r.error === "no-root" ? (c.kind === "area" ? "no area" : "no root found") : r.info, warn: r.warn };
  if (c.kind === "slope" || c.kind === "area") return { shown: r.value!.display, warn: r.warn };
  const xy = [r.x!.display, r.y!.display];
  return { shown: c.kind === "extremum" ? [...xy, r.extremum!] : xy, warn: r.warn };
}

/** Runs every case of `file` ROUNDS times on fresh engines; a case passes when every round shows `expect`
 *  and raises ⚠ exactly when the case says status "warn". */
async function stageCases(stage: string, file: string, run: (host: EngineHost, g: GiacApi, c: Case) => Got): Promise<void> {
  const cs = cases(file);
  const runs = new Map<string, Got[]>(cs.map((c) => [c.id, []]));
  for (let r = 0; r < ROUNDS; r++) {
    const g = await freshGiac();
    g.eval("timeout 2");
    g.eval("ckevery 10");
    const host = new EngineHost(g);
    for (const c of cs) runs.get(c.id)!.push(run(host, g, c));
  }
  let pass = 0;
  for (const c of cs) {
    const rs = runs.get(c.id)!;
    const wantWarn = c.status === "warn";
    if (rs.every((x) => same(x.shown, c.expect) && x.warn === wantWarn)) pass++;
    else
      console.log(
        `  ${stage} ${c.id}: got ${rs.map((x) => `${JSON.stringify(x.shown)}${x.warn ? " ⚠" : ""}`).join(" / ")}, expect ${JSON.stringify(c.expect)}${wantWarn ? " ⚠" : ""}`,
      );
  }
  report(stage, pass === cs.length, `${pass}/${cs.length} match, rounds ${ROUNDS}`);
}

async function stageBench(): Promise<void> {
  const cs = cases("bench.yaml");
  const host = new EngineHost(await freshGiac());
  let checked = 0;
  let pass = 0;
  const errors: string[] = [];
  for (const c of cs) {
    const r = host.cas(c.input!, defaultCasSettings).result;
    if (!r.ok) errors.push(`${c.id} (${r.error})`);
    if (c.expect === undefined) continue;
    checked++;
    if (r.ok && r.text === c.expect) pass++;
    else console.log(`  bench ${c.id}: got ${r.text}, expect ${c.expect}`);
  }
  report("bench", pass === checked, `${pass}/${checked} expect match, ${cs.length} run, errors: ${errors.length ? errors.join(", ") : "none"}`);
}

function equalByGiac(g: GiacApi, a: string, b: string): { ok: boolean; how: string } {
  if (a === b) return { ok: true, how: "identical" };
  const ea = g.eval(a);
  if (ea === g.eval(b) && !/undef|error/i.test(ea)) return { ok: true, how: "same value" };
  const diff = `(${a})-(${b})`;
  const s = g.eval(`simplify(${diff})`);
  if (s === "0" || s === "0=0") return { ok: true, how: "simplify" };
  const vars = g
    .eval(`lname(${diff})`)
    .replace(/[[\]\s]/g, "")
    .split(",")
    .filter((v) => v && v !== "pi" && v !== "i");
  // Fixed sample points (deterministic runs), inside (0.15, 1.85) like the original random ones.
  for (const x of [0.3719, 0.9137, 1.6453]) {
    const at = (e: string): string =>
      vars.length ? `subst(${e},[${vars.join(",")}],[${vars.map((_, j) => (x + j * 0.31).toFixed(6)).join(",")}])` : e;
    const r = g.eval(`evalf(abs(${at(diff)}) / max(1, abs(${at(`(${b})`)})))`);
    // Internal comparison only, never shown to users.
    const v = Number(r);
    if (!Number.isFinite(v) || v > 1e-8) return { ok: false, how: `numeric diff ${r} (simplify gave ${s.slice(0, 60)})` };
  }
  return { ok: true, how: "numeric" };
}

async function stageParser(): Promise<void> {
  const cs = cases("parser.yaml");
  const g = await freshGiac();
  let pass = 0;
  let run = 0;
  let gaps = 0;
  const gapPassing: string[] = [];
  for (const c of cs) {
    let produced: string;
    let r: { ok: boolean; how: string };
    try {
      resetUserFunctions();
      const o = { ...(c.options ?? {}), ...(c.chips ? { chips: c.chips } : {}) };
      for (const b of c.before ?? []) latexToGiac(b, o);
      produced = latexToGiac(c.latex!, o);
      r = c.error ? { ok: false, how: "accepted, but must be an error" } : equalByGiac(g, produced, c.expect as string);
    } catch (e) {
      produced = "";
      const msg = e instanceof Error ? e.message : String(e);
      r = c.error && e instanceof SerializeError ? { ok: true, how: `error: ${msg}` } : { ok: false, how: `parser threw: ${msg}` };
    }
    if (c.status === "gap") {
      gaps++;
      if (r.ok) gapPassing.push(c.id);
      continue;
    }
    run++;
    if (r.ok) pass++;
    else console.log(`  parser ${c.id}: ${c.latex} -> ${produced}, want ${c.expect}: ${r.how}`);
  }
  report(
    "parser",
    pass === run,
    `${pass}/${run} match, ${gaps} known gaps${gapPassing.length ? ` (now passing: ${gapPassing.join(", ")})` : ""}; total ${pass}/${cs.length}`,
  );
}

interface PyCase {
  id: string;
  kind: "run" | "shell" | "cancel";
  code: string;
  file?: string;
  before?: string[];
  home?: string[];
  /** "pending": known to fail until its fix; never fails the gate (listed as still pending or now passing). */
  status?: string;
  expect: { stdout?: string; error?: { type: string; line?: number }; gfx?: unknown[]; home?: Record<string, string> };
}

/** Runs `code` in its own worker thread (its own JS realm, as each app worker is). With `cancelAfterMs`, the
 *  thread is terminated then, like Cancel; `finished` stays empty if the script was still running. */
async function pyWorker(code: string, cancelAfterMs?: number): Promise<{ finished: string; stdout: string; terminateMs: number }> {
  const w = new Worker(new URL("./python-cancel-worker.ts", import.meta.url), { workerData: { code, mjs: micropythonMjsPath() } });
  let finished = "";
  let stdout = "";
  const done = new Promise<void>((resolve, reject) => {
    w.on("message", (m: string) => {
      if (m.startsWith("out:")) stdout += m.slice(4);
      else if (m.startsWith("finished")) {
        finished = m;
        resolve();
      }
    });
    w.on("error", reject);
  });
  await new Promise<void>((resolve, reject) => {
    w.on("message", (m: string) => m === "ready" && resolve());
    w.on("error", reject);
  });
  if (cancelAfterMs === undefined) {
    await done;
    await w.terminate();
    return { finished, stdout, terminateMs: 0 };
  }
  await new Promise((r) => setTimeout(r, cancelAfterMs));
  const t0 = performance.now();
  await w.terminate();
  return { finished, stdout, terminateMs: performance.now() - t0 };
}

async function stagePython(): Promise<void> {
  if (!micropythonAvailable()) {
    report("python", false, `no MicroPython at ${micropythonMjsPath()} (python/build-micropython.sh dev, or set PYTHON_OUT)`);
    return;
  }
  const doc = parse(readFileSync(`${root}tests/golden/python.yaml`, "utf8")) as { cases: PyCase[] };
  const { math, host } = await loadNodeMath();
  let out = "";
  let gfx: GfxCmd[] = [];
  const py = await loadNodePyHost({ output: (o) => (out += o.stream === "stdout" ? o.text : ""), hostCall: createCalcHost(math), graphics: (b) => gfx.push(...b) });
  let pass = 0;
  let active = 0;
  const pendingIds: string[] = [];
  const nowPassing: string[] = [];
  const cancelMs: number[] = [];
  for (const c of doc.cases) {
    const problems: string[] = [];
    for (const h of c.home ?? []) host.home(h, defaultHomeSettings);
    for (const b of c.before ?? []) await py.shell(b);
    out = "";
    gfx = [];
    let r: PyResult | undefined;
    if (c.kind === "cancel") {
      const k = await pyWorker(c.code, 300);
      cancelMs.push(k.terminateMs);
      if (k.finished) problems.push(`the script ended by itself (${k.finished})`);
      // After Cancel the app starts a fresh runtime; it must work.
      const fresh = await pyWorker("print(1)");
      out = fresh.stdout;
      r = { ok: fresh.finished === "finished ok", ms: 0 };
    } else {
      r = c.kind === "shell" ? await py.shell(c.code) : await py.run(c.code, c.file);
    }
    const e = c.expect;
    if (e.stdout !== undefined && out !== e.stdout) {
      problems.push(`stdout ${JSON.stringify(out)}, want ${JSON.stringify(e.stdout)}`);
    }
    if (e.error) {
      if (r.ok) problems.push(`no error, want ${e.error.type}`);
      else if (r.error?.type !== e.error.type || (e.error.line !== undefined && r.error.line !== e.error.line))
        problems.push(`error ${r.error?.type} line ${r.error?.line}, want ${e.error.type} line ${e.error.line}`);
    } else if (!r.ok) problems.push(`error ${r.error?.type}: ${r.error?.message}`);
    if (e.gfx && JSON.stringify(gfx) !== JSON.stringify(e.gfx)) problems.push(`gfx ${JSON.stringify(gfx)}, want ${JSON.stringify(e.gfx)}`);
    for (const [input, display] of Object.entries(e.home ?? {})) {
      const got = host.home(input, defaultHomeSettings).result.display;
      if (got !== display) problems.push(`Home ${input} -> ${got}, want ${display}`);
    }
    if (c.status === "pending") {
      (problems.length === 0 ? nowPassing : pendingIds).push(c.id);
      console.log(`  python ${c.id}: pending${problems.length ? ` (${problems.join("; ")})` : ""}`);
      continue;
    }
    active++;
    if (problems.length === 0) pass++;
    else console.log(`  python ${c.id}: ${problems.join("; ")}`);
  }
  const ms = cancelMs.length ? `; Cancel terminate median ${median(cancelMs).toFixed(1)} ms (desktop)` : "";
  const pend = pendingIds.length + nowPassing.length ? `; ${pendingIds.length} pending${nowPassing.length ? `, ${nowPassing.length} NOW PASSING (remove status: ${nowPassing.join(", ")})` : ""}` : "";
  report("python", pass === active, `${pass}/${active} match${pend}${ms}`);
}

console.log(`golden: engine ${mjs}`);
if (want("interrupt")) stageInterrupt();
if (want("home")) await stageHome();
if (want("precision")) await stagePrecision();
if (want("solve")) await stageCases("solve", "solve.yaml", solveCase);
if (want("function")) await stageCases("function", "function.yaml", (host, _g, c) => functionCase(host, c));
if (want("bench")) await stageBench();
if (want("parser")) await stageParser();
if (want("python")) await stagePython();
const failed = summary.filter((s) => !s.ok);
console.log(failed.length ? `\nGOLDEN GATE FAILED: ${failed.map((s) => s.stage).join(", ")}` : "\nGOLDEN GATE PASSED");
process.exit(failed.length ? 1 : 0);
