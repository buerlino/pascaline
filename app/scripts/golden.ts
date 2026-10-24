// SPDX-License-Identifier: GPL-3.0-or-later
// The golden gate: every tests/golden/*.yaml file against one engine build. Run it on every engine
// build that ships (CLAUDE.md). Exit 0 only if every stage passes.
//   npm run golden                                  # engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl
//   GIAC_MJS=/path/giac.mjs ROUNDS=5 npm run golden
//   ONLY=home,parser npm run golden                 # stages: interrupt, steps, flags, home, precision, solve, function, bench, calls, invariants, units, parser
// Typed Giac text in a case (`input`, `before`, step inputs, `eq`, `f`, `g`) gets the parser's angle rule first (G46).
// Stages:
//   interrupt  tests/engine/interrupt-test.mjs (Giac patch 0002): 16 forced interrupts, no escapes
//   steps      G82 (patch 0004): tests/engine/step-budget-test.mjs (a step budget interrupts at the same count on a fast
//              clock), and scripts/golden-speed.ts: every home and precision case gives the same display, mark and copy text on a clock
//              8× fast (the Tab One is 5-8× slower); the cases that still differ are listed as known (SPEED_KNOWN), a new one fails
//   flags      tests/engine/flags-canary.ts (G67): every field of Giac's context in the pinned source is read and restored
//              by the host's settings check or listed with the reason (app/src/engine/flags.ts CONTEXT_FIELDS);
//              tests/engine/ctx-canary.ts (G102): each of bridge-1's fields set and printed back by Giac's getter;
//              tests/engine/tanh-test.ts and patch-canary.ts (G75): patch 0003's complex tanh against mpmath, and its
//              cause still in the pinned tarball; tests/engine/mpfr-pi-test.ts (G60): patch 0005's ln, asin, acos, acosh;
//              tests/engine/canaries.mjs (S17, G77): every workaround row still holds on the engine, so a re-pin that
//              flips one fails here; tests/engine/fetch-test.mjs (G77): the pin's fetch checks the tarball against its .dsc
//   home       exact-first Home through EngineHost: every case matches with its mark, same in every round,
//              median ≤ 500 ms (a case's `budgetMs` instead, G82); a mark-only case (no `expect`) checks the mark and that an answer came back. A case with
//              `steps` (G34) is a sequence on its own engine: each step's input (or latex, with \ans as the session
//              builds it from the step before) runs in its own angle mode, and the last step is checked. An `input` step
//              may name the result of step k as the chip `pasr_<k>` (G49: sent with a chip table of values and facts);
//              the case's `settings.digits` and `consts` (G26's constant table, `pasc_<id>`) hold for every step. A
//              step with `view: cas` runs in CAS (G49f3), never as the last step. A
//              result shown with ⚠ n (n below the digits) must equal `expect` rounded to those n digits
//   precision  tests/golden/precision.yaml (docs/04 2.3 regression list, 20/30-digit cases): Home and CAS at the case's
//              digits, value and mark; `before:` inputs run first on the same engine. `budgetMs` (G58): the case's
//              wall time at most; with no expect and no mark it checks only that, and that it answered or was refused.
//              A case with `status: pending` is
//              known to fail until its fix: it never fails the gate, and is listed as still pending or now passing. A
//              result shown with ⚠ n (fewer confirmed digits than asked) must equal `expect` rounded to those n digits.
//   solve      Solve strategy: 1-D (solve1.ts), one equation through the engine (kind one), systems and polynomials
//              (solve.ts), at the case's digits; every case matches in every round, and no ⚠ (a failed residual check
//              or fewer confirmed digits than asked) unless the case has status "warn"; a root shown with ⚠ n must
//              equal `expect` rounded to those n digits
//   function   Function analysis and Num table (analysis.ts), same rules
//   bench      the 55 benchmark inputs in CAS mode: `expect` (derived) cases match; errors are listed. Then in DEG (G46):
//              every input that answers in RAD answers, `deg` pins a DEG text, an angle-free one shows the RAD text
//   calls      G52: Giac calls per input, bridge calls included (G99) (bench in CAS, home.yaml's single inputs in Home, 12 digits); prints the totals and
//              the five largest; fails when calls per input are over 10 % above tests/golden/calls-baseline.yaml
//   invariants G43: every home.yaml and precision.yaml input without settings, across settings (no expected values):
//              (a) no angle function: the same text in RAD and DEG; (b) 12 and 30 digits round to the same 12-digit text;
//              (c) the copy text read back by the paste reader gives the same text and mark; (d) `X:=input` in one mode, then
//              `X` in the other, shows what the store line showed. Passes when the failures are exactly those in
//              tests/golden/invariants-known.yaml (a new failure, or a known one that now passes, fails)
//   units      tests/golden/units.yaml: the unit view (G16) on the Find index's factors (app/src/find/_gen, `npm run index`):
//              value, mark, exact text and dimension, or the refusal's message, the same in every round; desktop p95 of
//              an evaluation ≤ 5 ms (docs/04 8.3), warm, each case at its fastest of five passes
//   parser     LaTeX → Giac (our parser) equals the intended expression, decided by Giac; gaps never fail.
//              A case with `error: true` passes when the parser rejects the input (a message, never a guess);
//              `chips:` is the entry's chip table (\res, \ans, \const; docs/04 section 3.6). R28: a case with
//              `options: { units: true }` is the unit view's formula: `formula` is the exact text the parser must give,
//              `slots` (and `to`) the slots in unit-case.ts syntax, and `expect` the Giac text G16's builder makes from
//              them (needs the Find index, as the units stage does)
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { EngineHost, type GiacApi, type LoadedGiac } from "../src/engine/host.ts";
import type { GiacBridge } from "../src/engine/bridge.ts";
import { runHomeCase, runPrecisionCase, typed, seqMark, markText, RATIONAL_TEXT, type Case, type Expect } from "../src/goldenRun.ts";
import { defaultHomeSettings, ENGINE_DEFINITIONS, pasdegCommand, precisionFacts, type HomeResult, type HomeSettings } from "../src/engine/homeEval.ts";
import { decimalFromString, formatComplex, formatReal, markOf, toText, type MarkInfo } from "../src/engine/format.ts";
import { giacMjsPath, loadNodeGiac } from "../src/engine/nodeGiac.ts";
import { hasFloat } from "../src/engine/numeric.ts";
import { defaultSolveSettings, solve1, type SolveResult } from "../src/engine/solve1.ts";
import { defaultCasSettings } from "../src/engine/types.ts";
import { ANS_KEY, type ChipTable } from "../src/input/chips.ts";
import { chipsIn, type ChipFactsTable } from "../src/engine/chipFacts.ts";
import { inexactConstsIn, type ConstTable } from "../src/engine/constUnc.ts";
import { giacOfEntry } from "../src/input/entry.ts";
import { DEFAULT_USER_FUNCTIONS, latexToGiac, latexToGiacInfo, type UnitsInfo } from "../src/input/latex-to-giac.ts";
import { SerializeError } from "../src/input/errors.ts";
import { dropAngleFactor, hasAngleFactor, rewriteAngles } from "../src/input/angles.ts";

/** A result text with a trig function in it (the CAS view draws its angle in degrees in DEG). */
const TRIG_TEXT = /(?<![A-Za-z0-9_])a?(sin|cos|tan|sec|csc|cot)\(/;
import { buildJob } from "../src/units/build.ts";
import { factorTable, type FactorTable } from "../src/units/factors.ts";
import { unitErrorMessage, unitNoteText, unitWhyText } from "../src/units/messages.ts";
import { isUnitError, type Quantity, type UnitError } from "../src/units/types.ts";
import type { IndexItem } from "../src/find/types.ts";
import { requestOf, slotOf } from "./unit-case.ts";
import { callsStage, type CallsBaseline } from "./calls-budget.ts";
import { SPEED_KNOWN, speedFindings } from "./golden-speed.ts";
import { describe as describeFinding } from "./golden-compare.ts";
import { checkAngle, checkCopy, checkDigits, checkStoreBoth, copySourceOf, invariantsOf, storesNames, invariantsStage, type InvariantFailure } from "./invariants.ts";
import { copyFull } from "../src/clipboard/text.ts";
import { parsePastedNumber } from "../src/clipboard/paste.ts";


const root = fileURLToPath(new URL("../../", import.meta.url));
const mjs = giacMjsPath();
const ROUNDS = Number(process.env.ROUNDS ?? 5);
const HOME_LIMIT_MS = 500;
const only = process.env.ONLY?.split(",").map((s) => s.trim());
const want = (stage: string) => !only || only.includes(stage);

/** Files whose `input`-style fields are what the user types, in Giac's spelling (not the parser's LaTeX). */
const TYPED_FILES = new Set(["home.yaml", "precision.yaml", "bench.yaml", "solve.yaml", "function.yaml", "units.yaml"]);


function cases(file: string): Case[] {
  const doc = parse(readFileSync(`${root}tests/golden/${file}`, "utf8")) as { cases: Case[] };
  return TYPED_FILES.has(file) ? doc.cases.map(typed) : doc.cases;
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

async function freshEngine(): Promise<LoadedGiac> {
  const L = await loadNodeGiac(mjs);
  L.giac.eval(pasdegCommand("rad")); // R64: our parser's text reads pasdeg, as the engine host sets it
  return L;
}
async function freshHost(): Promise<EngineHost> {
  const L = await freshEngine();
  return new EngineHost(L.giac, L.bridge);
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

async function stageSteps(): Promise<void> {
  const r = spawnSync(process.execPath, [`${root}tests/engine/step-budget-test.mjs`], { env: { ...process.env, GIAC_MJS: mjs }, encoding: "utf8", timeout: 300_000 });
  const canary = `${r.stdout}${r.stderr}`.trim().split("\n").slice(-3).join(" | ");
  const { findings, known, records } = await speedFindings(8, mjs);
  for (const f of known) console.log(`  steps known (${SPEED_KNOWN[`${f.stage}/${f.id}`]}): ${describeFinding(f)}`);
  for (const f of findings) console.log(`  steps ${describeFinding(f)}`);
  report("steps", r.status === 0 && findings.length === 0, `${canary} | ${records} cases, clock ×1 and ×8: ${findings.length} new findings, ${known.length} known`);
}

function stageFlags(): void {
  // G102: ctx-canary.ts sets each of bridge-1's fields and reads it back with Giac's own getter (needs the engine);
  // G75: tanh-test.ts (needs the engine) and patch-canary.ts (the tarball) for patch 0003; G60: mpfr-pi-test.ts, 0005;
  // G77: canaries.mjs (S17's workaround rows on the engine) and fetch-test.mjs (the pin's .dsc check, no network)
  const runs = ["flags-canary.ts", "ctx-canary.ts", "tanh-test.ts", "mpfr-pi-test.ts", "patch-canary.ts", "canaries.mjs", "fetch-test.mjs"].map((f) =>
    spawnSync(process.execPath, [`${root}tests/engine/${f}`], { env: { ...process.env, GIAC_MJS: mjs }, encoding: "utf8", timeout: 120_000 }),
  );
  const out = runs.map((r) => `${r.stdout}${r.stderr}`.trim().split("\n").slice(-3).join(" | ")).join(" | ");
  report("flags", runs.every((r) => r.status === 0), out);
}

async function stageHome(): Promise<void> {
  const cs = cases("home.yaml");
  const runs = new Map<string, HomeResult[]>(cs.map((c) => [c.id, []]));
  for (let r = 0; r < ROUNDS; r++) {
    const host = await freshHost();
    for (const c of cs) {
      runs.get(c.id)!.push(await runHomeCase(c, host, freshHost));
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
    const digits = c.settings?.digits ?? 12;
    const marksOf = rs.map((x) => seqMark(x, digits));
    const got = marksOf.map(markText);
    const markOk = !c.mark || got.every((m) => m?.startsWith(c.mark!));
    if (c.mark) marks++;
    // ⚠ n: only the n confirmed digits are shown, and they must be the oracle's (as in the precision stage).
    const wantOf = (m: MarkInfo | null): string | null =>
      m?.mark === "⚠" && m.n !== undefined && m.n < digits ? expectAt(String(c.expect), Math.max(1, m.n)) : String(c.expect);
    const answered = c.expect === undefined ? rs.every((x) => x.ok && !lostAnswer(x.display, dropAngleFactor(c.input ?? ""))) : rs.every((x, k) => x.display === wantOf(marksOf[k]!));
    // `exact` (G38): the text the result copies (`full`), when the case pins it.
    const exactOk = c.exact === undefined || rs.every((x) => x.full === c.exact);
    const ok = answered && markOk && exactOk;
    const med = median(rs.map((x) => x.totalMs));
    maxMed = Math.max(maxMed, med);
    if (ok) pass++;
    else console.log(`  home ${c.id}: got ${rs.map((x, k) => `${got[k] ?? "-"} ${x.display}`).join(" / ")}, expect ${c.mark ?? ""} ${c.expect ?? "(mark only)"}${exactOk ? "" : `, copies ${rs[0]!.full}, expect ${c.exact}`}`);
    // G82: a case whose exact pass Home's step budget or its clock stops, not finishing on any device, may name its own.
    const limit = c.budgetMs ?? HOME_LIMIT_MS;
    if (!(med <= limit)) {
      slow++;
      console.log(`  home ${c.id}: median ${med.toFixed(1)} ms > ${limit} ms (${shown})`);
    }
    if (c.source === "assumed") assumed++;
  }
  report(
    "home",
    pass === cs.length && slow === 0,
    `${pass}/${cs.length} match with their mark (${assumed} assumed, ${marks} marks checked), ${slow} over ${HOME_LIMIT_MS} ms, max median ${maxMed.toFixed(1)} ms, rounds ${ROUNDS}`,
  );
}


/** `expect` (STD at the case's digits) rounded again to n digits, or null when that could round the wrong way
 *  (the dropped part is exactly 5: the case then needs a longer expect). */
function expectAt(expect: string, n: number): string | null {
  const v = decimalFromString(expect.replace("E", "e"));
  if (!v) return null;
  if (v.digits.slice(n) === "5") return null;
  return toText(formatReal(v, { format: "STD", digits: n }));
}

const LOOKS_NUMERIC = /^-?(\d+(\.\d+)?|\.\d+)(E[+-]?\d+)?([+-](\d+(\.\d+)?(E[+-]?\d+)?\*)?i)?$/;

/** A mark-only case still needs an answer: a number, or a non-number that holds a float (G27: its ⚠ is the mark the
 *  case checks), or a list of numbers. The input echoed back (BesselJ(1,2) at 30 digits) is a lost result. */
function lostAnswer(shown: string, input: string): boolean {
  // G48: a list, matrix or sequence of numbers (`[899450126402,1]`, `899450126402,1`) is an answer too.
  const numbers = shown.replace(/[[\]]/g, "").split(",");
  return !numbers.every((x) => LOOKS_NUMERIC.test(x)) && !(hasFloat(shown) && shown !== input);
}

async function stagePrecision(): Promise<void> {
  const cs = cases("precision.yaml");
  const shared = await freshHost();
  let active = 0;
  let activePass = 0;
  const pending: string[] = [];
  const nowPassing: string[] = [];
  let marksChecked = 0;
  for (const c of cs) {
    const t0 = performance.now();
    const run = await runPrecisionCase(c, shared, freshHost);
    const ms = performance.now() - t0;
    const { shown, mark, input, digits, problems } = run;
    // G58: `budgetMs`, the wall time of the case (its Enter): it answers or is refused within it.
    if (c.budgetMs !== undefined && ms > c.budgetMs) problems.push(`took ${ms.toFixed(0)} ms > budgetMs ${c.budgetMs}`);
    if (c.expect !== undefined) {
      // ⚠ n: the result shows only its n confirmed digits; those must be the oracle's.
      const want = mark?.mark === "⚠" && mark.n !== undefined && mark.n < digits ? expectAt(String(c.expect), Math.max(1, mark.n)) : String(c.expect);
      if (want === null) problems.push(`expect ${String(c.expect)} cannot be rounded to ${mark?.n} digits safely: give more digits`);
      else if (shown !== want) problems.push(`got ${shown}, expect ${want}${want !== c.expect ? ` (${c.expect} at ${mark?.n} digits)` : ""}`);
    }
    // A mark-only case still needs an answer: the input echoed back (BesselJ(1,2) at 30 digits) is a lost result.
    // G58: a time-only case (budgetMs, no expect and no mark) may also be refused.
    const timeOnly = c.budgetMs !== undefined && c.mark === undefined;
    if (c.expect === undefined && !(timeOnly && shown.startsWith("error: ")) && lostAnswer(shown, input)) problems.push(`answer is not a number: ${shown}`);
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

/** What a case produced: the shown text(s), and whether ⚠ was raised. `n`: per shown value, the confirmed digits when
 *  it is shown with ⚠ n (fewer than the case's digits); `expect` is then compared rounded to them. */
interface Got {
  shown: Expect;
  warn: boolean;
  n?: (number | undefined)[];
}

/** ⚠ n of one result at `digits` (undefined when every digit shown is confirmed), and whether it carries ⚠ at all. */
function confirmedN(r: HomeResult, digits: number): { n: number | undefined; warn: boolean } {
  const m = markOf(precisionFacts(r), { format: "STD", digits });
  return { n: m?.mark === "⚠" && m.n !== undefined && m.n < digits ? Math.max(1, m.n) : undefined, warn: m?.mark === "⚠" };
}

/** The results' texts, ⚠ n per result, and whether any is ⚠. */
function shownOf(rs: HomeResult[], digits: number): { shown: string[]; n: (number | undefined)[]; warn: boolean } {
  const cs = rs.map((r) => confirmedN(r, digits));
  return { shown: rs.map((r) => r.display), n: cs.map((c) => c.n), warn: cs.some((c) => c.warn) };
}

/** `expect` with each entry rounded to the digits its result was shown with (⚠ n). */
function expectShown(expect: Expect | undefined, n: (number | undefined)[] | undefined): Expect | undefined {
  if (expect === undefined || !n?.some((x) => x !== undefined)) return expect;
  const at = (e: Expect, k: number | undefined): Expect => (k === undefined || typeof e !== "string" ? e : (expectAt(e, k) ?? `${e} (cannot round to ${k})`));
  if (typeof expect === "string") return at(expect, n[0]);
  return expect.map((e, i) => at(e, n[i]));
}

const same = (a: Expect, b: Expect | undefined): boolean => JSON.stringify(a) === JSON.stringify(b);
const str = (x: string | string[] | undefined): string => (Array.isArray(x) ? x[0]! : x!);
const list = (x: string | string[] | undefined): string[] => (Array.isArray(x) ? x : [x!]);

const caseSettings = (c: Case): HomeSettings => ({ ...defaultHomeSettings, digits: c.settings?.digits ?? defaultHomeSettings.digits, angle: c.settings?.angle ?? "rad" });

function solveCase(host: EngineHost, _g: GiacApi, c: Case): Got {
  const s = caseSettings(c);
  if (!c.kind) {
    const r: SolveResult = solve1(host.giac, str(c.eq), str(c.var), str(c.guess), defaultSolveSettings);
    return { shown: r.display, warn: r.warn };
  }
  const r =
    c.kind === "poly"
      ? host.solve({ kind: "poly", equation: str(c.eq), unknown: str(c.var) }, s)
      : host.solve({ kind: "equations", equations: list(c.eq), unknowns: list(c.var), guesses: list(c.guess) }, s);
  if (r.ok) {
    const o = shownOf(r.roots.map((x) => x.result), s.digits);
    // One equation (kind one): a single root, shown as a string like the solve1 cases.
    return { shown: c.kind === "one" ? o.shown[0]! : o.shown, n: o.n, warn: r.warn || o.warn };
  }
  return { shown: r.error === "bad-input" && c.kind === "poly" ? "not a polynomial" : r.error === "no-root" ? "no root found" : r.info, warn: r.warn };
}

function functionCase(host: EngineHost, c: Case): Got {
  const s = caseSettings(c);
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
  if (c.kind === "slope" || c.kind === "area") {
    const o = shownOf([r.value!], s.digits);
    return { shown: o.shown[0]!, n: o.n, warn: r.warn || o.warn };
  }
  const o = shownOf([r.x!, r.y!], s.digits);
  return { shown: c.kind === "extremum" ? [...o.shown, r.extremum!] : o.shown, n: o.n, warn: r.warn || o.warn };
}

/** Runs every case of `file` ROUNDS times on fresh engines; a case passes when every round shows `expect`
 *  and raises ⚠ exactly when the case says status "warn". */
async function stageCases(stage: string, file: string, run: (host: EngineHost, g: GiacApi, c: Case) => Got): Promise<void> {
  const cs = cases(file);
  const runs = new Map<string, Got[]>(cs.map((c) => [c.id, []]));
  for (let r = 0; r < ROUNDS; r++) {
    const { giac: g, bridge } = await freshEngine();
    g.eval("timeout 2");
    g.eval("ckevery 10");
    const host = new EngineHost(g, bridge);
    for (const c of cs) runs.get(c.id)!.push(run(host, g, c));
  }
  let pass = 0;
  for (const c of cs) {
    const rs = runs.get(c.id)!;
    const wantWarn = c.status === "warn";
    if (rs.every((x) => same(x.shown, expectShown(c.expect, x.n)) && x.warn === wantWarn)) pass++;
    else
      console.log(
        `  ${stage} ${c.id}: got ${rs.map((x) => `${JSON.stringify(x.shown)}${x.warn ? ` ⚠${x.n?.some((k) => k !== undefined) ? JSON.stringify(x.n) : ""}` : ""}`).join(" / ")}, expect ${JSON.stringify(c.expect)}${wantWarn ? " ⚠" : ""}`,
      );
  }
  report(stage, pass === cs.length, `${pass}/${cs.length} match, rounds ${ROUNDS}`);
}

async function stageBench(): Promise<void> {
  const cs = cases("bench.yaml");
  const host = await freshHost();
  let checked = 0;
  let pass = 0;
  const errors: string[] = [];
  const radText = new Map<string, string>();
  for (const c of cs) {
    const r = host.cas(c.input!, defaultCasSettings).result;
    if (!r.ok) errors.push(`${c.id} (${r.error})`);
    else radText.set(c.id, r.text);
    if (c.expect === undefined) continue;
    checked++;
    if (r.ok && r.text === c.expect) pass++;
    else console.log(`  bench ${c.id}: got ${r.text}, expect ${c.expect}`);
  }
  // G46: the same inputs in DEG. Every one that answers in RAD answers in DEG (A16 saw limit and series refused); `deg`
  // pins the DEG text; an input without an angle function shows the RAD text, unless its result holds a trig function
  // (the CAS view draws that in degrees, S14 option 2).
  const deg = { ...defaultCasSettings, angle: "deg" as const };
  let degChecked = 0;
  let degPass = 0;
  for (const c of cs) {
    const rad = radText.get(c.id);
    if (rad === undefined) continue;
    const r = host.cas(c.input!, deg).result;
    const want = c.deg ?? (hasAngleFactor(c.input!) || TRIG_TEXT.test(rad) ? undefined : rad);
    if (r.ok && want === undefined) continue;
    degChecked++;
    if (r.ok && r.text === want) degPass++;
    else console.log(`  bench ${c.id} in DEG: got ${r.ok ? r.text : `error ${r.error}: ${r.text}`}, expect ${want ?? "an answer"}`);
  }
  report(
    "bench",
    pass === checked && degPass === degChecked,
    `${pass}/${checked} expect match, ${cs.length} run, errors: ${errors.length ? errors.join(", ") : "none"}; DEG ${degPass}/${degChecked} match`,
  );
}

/** G52: Giac calls per input (one Enter at 12 digits) for the bench inputs (CAS) and home.yaml's single inputs (Home),
 *  against tests/golden/calls-baseline.yaml. A set whose calls per input are more than 10 % over its baseline fails. */
async function stageCalls(): Promise<void> {
  const base = parse(readFileSync(`${root}tests/golden/calls-baseline.yaml`, "utf8")) as CallsBaseline;
  const counted = async (): Promise<{ host: EngineHost; calls: () => number }> => {
    const { giac, bridge } = await freshEngine();
    let n = 0;
    const evalOnce = giac.eval.bind(giac);
    giac.eval = (text: string) => {
      n++;
      return evalOnce(text);
    };
    // G99: a bridge call is a Giac call too
    const counted: GiacBridge = {
      ctxGet: () => (n++, bridge.ctxGet()),
      ctxSet: (f) => (n++, bridge.ctxSet(f)),
      parse: (t) => (n++, bridge.parse(t)),
      value: (t, p) => (n++, bridge.value(t, p)),
    };
    return { host: new EngineHost(giac, counted), calls: () => n };
  };
  const bench = new Map<string, number>();
  {
    const { host, calls } = await counted();
    for (const c of cases("bench.yaml")) {
      const n0 = calls();
      host.cas(c.input!, defaultCasSettings);
      bench.set(c.id, calls() - n0);
    }
  }
  const home = new Map<string, number>();
  {
    const { host, calls } = await counted();
    const s: HomeSettings = { ...defaultHomeSettings, digits: 12 };
    for (const c of cases("home.yaml")) {
      if (c.steps) continue;
      const hs: HomeSettings = { ...s, angle: c.settings?.angle ?? "rad" };
      const giacOf = (t: string): string => (c.latex !== undefined ? giacOfEntry(t, "home").giac : t);
      for (const b of c.before ?? []) host.home(giacOf(b), hs);
      const n0 = calls();
      host.home(giacOf(c.latex ?? c.input!), hs);
      home.set(c.id, calls() - n0);
    }
  }
  for (const [set, counts, baseline, baselineInputs] of [["bench", bench, base.bench, base.benchInputs], ["home", home, base.home, base.homeInputs]] as const) {
    const r = callsStage(set, counts, baseline, baselineInputs);
    report(`calls-${set}`, r.ok, r.line);
  }
}

/** G43: the invariants over every home.yaml and precision.yaml input without settings; see invariants.ts. */
async function stageInvariants(): Promise<void> {
  const seen = new Set<string>();
  const inputs: { id: string; giac: string; before: string[]; cas: boolean }[] = [];
  for (const file of ["home.yaml", "precision.yaml"]) {
    for (const c of cases(file)) {
      // A case whose only setting is `angle` joins when its input holds no angle function (G46: cosh(90*i), (-8)^0.2 exist
      // only in DEG cases); it runs in both modes, the setting dropped.
      const angleOnly = c.settings !== undefined && Object.keys(c.settings).every((k) => k === "angle");
      if ((c.settings && !angleOnly) || c.steps || c.beforeHome?.length || c.beforeCas?.length || c.relaunch || c.status === "pending" || c.kind === "cas") continue;
      const giacOf = (t: string): string => (c.latex !== undefined ? giacOfEntry(t, "home").giac : t);
      let giac: string;
      try {
        giac = giacOf(c.latex ?? c.input!);
      } catch {
        continue;
      }
      const before = (c.before ?? []).map(giacOf);
      if (angleOnly && !invariantsOf(giac, before).angleFree) continue;
      const key = `${before.join(";")}|${giac}`;
      if (seen.has(key)) continue;
      seen.add(key);
      inputs.push({ id: `${file === "home.yaml" ? "home" : "precision"}:${c.id}`, giac, before, cas: false });
    }
  }
  const at = async (host: EngineHost, i: (typeof inputs)[number], angle: "rad" | "deg", digits: number): Promise<HomeResult> => {
    const s: HomeSettings = { ...defaultHomeSettings, angle, digits };
    for (const b of i.before) host.home(b, s);
    return host.home(i.giac, s).result;
  };
  const failures: InvariantFailure[] = [];
  let stageHost: EngineHost | undefined;
  const t0 = performance.now();
  let checked = { a: 0, b: 0, c: 0, d: 0 };
  for (const i of inputs) {
    // `before` inputs and inputs that store a name themselves (`:=`, `=>`, `sto(`) get their own engine; the others share
    // one for the stage (check (d) purges its name after each direction).
    const keep = i.before.length > 0 || storesNames(i.giac);
    const own = keep ? await freshHost() : null;
    const host = async (): Promise<EngineHost> => own ?? (stageHost ??= await freshHost());
    const rad = await at(await host(), i, "rad", 12);
    const o = invariantsOf(i.giac, i.before);
    if (o.angleFree) {
      const deg = await at(await host(), i, "deg", 12);
      checked.a++;
      const f = checkAngle(i.id, rad, deg);
      if (f) failures.push(f);
    }
    if (rad.ok && rad.value) {
      const b = checkDigits(i.id, rad, await at(await host(), i, "rad", 30));
      if (b.checked) checked.b++;
      if (b.failure) failures.push(b.failure);
      // (c): the copy text the app makes (invariants.ts copySourceOf), read back by the paste reader
      const copy = copyFull(copySourceOf(rad));
      const pasted = copy === undefined ? null : parsePastedNumber(copy);
      if (copy !== undefined && pasted) {
        checked.c++;
        try {
          const back = (await host()).home(giacOfEntry(pasted.latex, "home").giac, { ...defaultHomeSettings, digits: 12 }).result;
          const f = checkCopy(i.id, rad, copy, back);
          if (f) failures.push(f);
        } catch (e) {
          failures.push({ id: i.id, check: "c", detail: `copy ${copy} pasted as ${pasted.latex}: ${e instanceof Error ? e.message : String(e)}` });
        }
      }
    }
    // (d): X:=input in one mode, X in the other shows what the store line showed
    // (d) runs for the inputs it ran for before G43f1: no `before`. Only a storing input gets a new engine per direction.
    if (rad.ok && rad.value && i.before.length === 0) {
      const d = await checkStoreBoth(storesNames(i.giac) ? async () => await freshHost() : host, i.id, i.giac);
      checked.d += d.checked;
      failures.push(...d.failures);
    }
  }
  const known = parse(readFileSync(`${root}tests/golden/invariants-known.yaml`, "utf8")) as { known?: { id: string; check: string; package: string; note?: string }[] };
  const r = invariantsStage(failures, known.known ?? []);
  for (const l of r.lines) console.log(`  invariants ${l}`);
  const secs = (performance.now() - t0) / 1000;
  report("invariants", r.ok && secs < 60, `${inputs.length} inputs, ${checked.a} (a) RAD/DEG, ${checked.b} (b) 12/30 digits, ${checked.c} (c) copy and paste, ${checked.d} (d) store; ${r.summary}; ${secs.toFixed(1)} s (< 60)`);
}

const UNIT_P95_MS = 5;

/** What a units case got, as text to compare and print. */
function unitGot(r: Quantity | UnitError, c: Case): string {
  if (isUnitError(r)) return `refused: ${unitErrorMessage(r)}`;
  const m = markText(markOf(precisionFacts(r.value), { format: "STD", digits: 12 }));
  return `${m ?? "-"} ${r.value.display} exact ${r.value.exact ?? "-"}${c.dim !== undefined ? ` dim ${JSON.stringify(r.dimension)}` : ""}${c.unit !== undefined ? ` unit ${JSON.stringify(r.unit)}` : ""}${c.dimtext !== undefined ? ` dimtext ${JSON.stringify(r.dimensionText)}` : ""}${c.si !== undefined ? ` si ${r.si ?? "-"}` : ""}${c.unc !== undefined ? ` unc ${r.unc?.text ?? "none"}` : ""}${c.shown !== undefined ? ` shown ${r.unc?.shown ?? "-"}` : ""}${r.unc?.why ? ` ⚠ ${unitWhyText(r.unc.why)}` : ""}${r.note ? ` note ${unitNoteText(r.note)}` : ""}`;
}

/** The same text for what the case expects; `dim` and `si` are checked where the case gives them. */
function unitWant(c: Case): string {
  if (c.message !== undefined) return `refused: ${c.message}`;
  return `${c.mark ?? "-"} ${str(c.expect as string)} exact ${c.exact ?? "-"}${c.dim !== undefined ? ` dim ${JSON.stringify(c.dim)}` : ""}${c.unit !== undefined ? ` unit ${JSON.stringify(c.unit)}` : ""}${c.dimtext !== undefined ? ` dimtext ${JSON.stringify(c.dimtext)}` : ""}${c.si !== undefined ? ` si ${c.si}` : ""}${c.unc !== undefined ? ` unc ${c.unc}` : ""}${c.shown !== undefined ? ` shown ${c.shown}` : ""}${c.unc_why !== undefined ? ` ⚠ ${c.unc_why}` : ""}${c.notice !== undefined ? ` note ${c.notice}` : ""}`;
}

async function stageUnits(): Promise<void> {
  const cs = cases("units.yaml");
  const indexFile = process.env.FIND_INDEX_JSON ?? `${root}app/src/find/_gen/find-index.json`;
  if (!existsSync(indexFile)) {
    report("units", false, `no Find index at ${indexFile}: run npm run index (QALC_OUT=<main checkout>/engine/qalc/_out/dev in a worktree)`);
    return;
  }
  const table = factorTable(JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]);
  const settingsOf = (c: Case): HomeSettings => ({ ...defaultHomeSettings, angle: c.settings?.angle ?? "rad" });
  const jobs = cs.map((c) => buildJob(requestOf(c.input!, c.to, table), table));
  const runs = new Map<string, string[]>(cs.map((c) => [c.id, []]));
  let host: EngineHost | null = null;
  for (let r = 0; r < ROUNDS; r++) {
    host = await freshHost();
    cs.forEach((c, k) => {
      const job = jobs[k]!;
      runs.get(c.id)!.push(unitGot(isUnitError(job) ? job : host!.units(job, settingsOf(c)), c));
    });
  }
  let pass = 0;
  for (const c of cs) {
    const want = unitWant(c);
    const got = runs.get(c.id)!;
    if (got.every((g) => g === want)) pass++;
    else console.log(`  units ${c.id}: got ${[...new Set(got)].join(" / ")}, expect ${want}`);
  }
  // Warm timing: one pass to warm up, then five timed passes; each case counts with its fastest pass, so another
  // process on the desktop does not fail the gate (the device bar is measured on the device, docs/04 8.3).
  const best = new Map<string, number>();
  for (let r = 0; r < 6; r++) {
    cs.forEach((c, k) => {
      const job = jobs[k]!;
      if (isUnitError(job)) return;
      const t0 = performance.now();
      host!.units(job, settingsOf(c));
      const t = performance.now() - t0;
      if (r > 0) best.set(c.id, Math.min(best.get(c.id) ?? Infinity, t));
    });
  }
  const times = [...best.values()];
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)] ?? 0;
  report(
    "units",
    pass === cs.length && p95 <= UNIT_P95_MS,
    `${pass}/${cs.length} match (value, mark, exact, dimension, or the refusal), rounds ${ROUNDS}; desktop warm (best of 5) median ${median(times).toFixed(2)} ms, p95 ${p95.toFixed(2)} ms (≤ ${UNIT_P95_MS}), max ${(sorted.at(-1) ?? 0).toFixed(2)} ms`,
  );
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

let unitTable: FactorTable | null | undefined;

/** R28: a units-mode case: the formula as written, the slots and the end slot it names, and the Giac text G16's builder
 *  makes from it with the Find index's factors, compared by Giac. */
function unitsCase(g: GiacApi, c: Case, formula: string, u: UnitsInfo | undefined): { ok: boolean; how: string } {
  if (formula !== c.formula) return { ok: false, how: `formula ${formula}, want ${c.formula}` };
  if (!u || u.slots.length !== (c.slots ?? []).length) return { ok: false, how: `slots ${JSON.stringify(u?.slots)}, want ${(c.slots ?? []).length}` };
  if ((u.end !== undefined) !== (c.to !== undefined)) return { ok: false, how: `end slot ${u.end ?? "none"}, want ${c.to ?? "none"}` };
  if (unitTable === undefined) {
    const indexFile = process.env.FIND_INDEX_JSON ?? `${root}app/src/find/_gen/find-index.json`;
    unitTable = existsSync(indexFile) ? factorTable(JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[]) : null;
  }
  if (!unitTable) return { ok: false, how: "no Find index: run npm run index" };
  const table = unitTable;
  const job = buildJob(
    { formula, slots: (c.slots ?? []).map((s) => slotOf(s, table)), ...(u.consts.length ? { consts: u.consts } : {}), ...(c.to !== undefined ? { end: slotOf(c.to, table) } : {}) },
    table,
  );
  if (isUnitError(job)) return { ok: false, how: `builder refused: ${JSON.stringify(job)}` };
  return equalByGiac(g, job.expr, c.expect as string);
}

async function stageParser(): Promise<void> {
  const cs = cases("parser.yaml");
  const g = (await freshEngine()).giac;
  // The parser emits our own names (pasmod); the host loads them on first use, here they are all loaded.
  for (const def of Object.values(ENGINE_DEFINITIONS)) g.eval(def);
  let pass = 0;
  let run = 0;
  let gaps = 0;
  const gapPassing: string[] = [];
  for (const c of cs) {
    let produced: string;
    let r: { ok: boolean; how: string };
    try {
      // A function a `before` entry defines is a call in what follows, as the session counts it (R56)
      const userFunctions = new Set(DEFAULT_USER_FUNCTIONS);
      const o = { ...(c.options ?? {}), ...(c.chips ? { chips: c.chips } : {}), userFunctions };
      for (const b of c.before ?? []) {
        const d = latexToGiacInfo(b, o).defines;
        if (d) userFunctions.add(d);
      }
      if (c.options?.units && !c.error) {
        const u = latexToGiacInfo(c.latex!, o);
        produced = u.giac;
        r = unitsCase(g, c, u.giac, u.units);
      } else {
        produced = latexToGiac(c.latex!, o);
        r = c.error ? { ok: false, how: "accepted, but must be an error" } : equalByGiac(g, produced, c.expect as string);
      }
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

console.log(`golden: engine ${mjs}`);
if (want("interrupt")) stageInterrupt();
if (want("steps")) await stageSteps();
if (want("flags")) stageFlags();
if (want("home")) await stageHome();
if (want("precision")) await stagePrecision();
if (want("solve")) await stageCases("solve", "solve.yaml", solveCase);
if (want("function")) await stageCases("function", "function.yaml", (host, _g, c) => functionCase(host, c));
if (want("bench")) await stageBench();
if (want("calls")) await stageCalls();
if (want("invariants")) await stageInvariants();
if (want("units")) await stageUnits();
if (want("parser")) await stageParser();
const failed = summary.filter((s) => !s.ok);
console.log(failed.length ? `\nGOLDEN GATE FAILED: ${failed.map((s) => s.stage).join(", ")}` : "\nGOLDEN GATE PASSED");
process.exit(failed.length ? 1 : 0);
