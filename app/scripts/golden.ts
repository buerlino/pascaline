// SPDX-License-Identifier: GPL-3.0-or-later
// The golden gate: every tests/golden/*.yaml file against one engine build. Run it on every engine
// build that ships (CLAUDE.md). Exit 0 only if every stage passes.
//   npm run golden                                  # engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl
//   GIAC_MJS=/path/giac.mjs ROUNDS=5 npm run golden
//   ONLY=home,parser npm run golden                 # stages: interrupt, home, precision, solve, function, bench, units, parser
// Stages:
//   interrupt  tests/engine/interrupt-test.mjs (Giac patch 0002): 16 forced interrupts, no escapes
//   home       exact-first Home through EngineHost: every case matches with its mark, same in every round,
//              median ≤ 500 ms; a mark-only case (no `expect`) checks the mark and that an answer came back
//   precision  tests/golden/precision.yaml (docs/04 2.3 regression list, 20/30-digit cases): Home and CAS at the case's
//              digits, value and mark; `before:` inputs run first on the same engine. A case with `status: pending` is
//              known to fail until its fix: it never fails the gate, and is listed as still pending or now passing. A
//              result shown with ⚠ n (fewer confirmed digits than asked) must equal `expect` rounded to those n digits.
//   solve      Solve strategy: 1-D (solve1.ts), one equation through the engine (kind one), systems and polynomials
//              (solve.ts), at the case's digits; every case matches in every round, and no ⚠ (a failed residual check
//              or fewer confirmed digits than asked) unless the case has status "warn"; a root shown with ⚠ n must
//              equal `expect` rounded to those n digits
//   function   Function analysis and Num table (analysis.ts), same rules
//   bench      the 55 benchmark inputs in CAS mode: `expect` (derived) cases match; errors are listed
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
import { EngineHost, type GiacApi } from "../src/engine/host.ts";
import { defaultHomeSettings, ENGINE_DEFINITIONS, type HomeResult, type HomeSettings } from "../src/engine/homeEval.ts";
import { decimalFromString, formatReal, markOf, toText, type MarkInfo } from "../src/engine/format.ts";
import { giacMjsPath, loadNodeGiac } from "../src/engine/nodeGiac.ts";
import { hasFloat } from "../src/engine/numeric.ts";
import { defaultSolveSettings, solve1, type SolveResult } from "../src/engine/solve1.ts";
import { defaultCasSettings } from "../src/engine/types.ts";
import type { ChipTable } from "../src/input/chips.ts";
import { DEFAULT_USER_FUNCTIONS, latexToGiac, latexToGiacInfo, type UnitsInfo } from "../src/input/latex-to-giac.ts";
import { SerializeError } from "../src/input/errors.ts";
import { buildJob } from "../src/units/build.ts";
import { factorTable, type FactorTable } from "../src/units/factors.ts";
import { unitErrorMessage } from "../src/units/messages.ts";
import { isUnitError, type Quantity, type UnitError } from "../src/units/types.ts";
import type { IndexItem } from "../src/find/types.ts";
import { requestOf, slotOf } from "./unit-case.ts";

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
  /** `shown`: the digits the result is shown with when the input asks for them (CAS evalf(x,n), decisions M4-6). */
  settings?: { angle?: "rad" | "deg"; digits?: number; shown?: number };
  expect?: Expect;
  /** home.yaml, precision.yaml: the mark before the result (docs/04 2.4), checked by oracle.py; by this gate once the engine reports it. */
  mark?: "=" | "≈" | "⚠";
  source?: string;
  g2?: number;
  status?: string;
  /** parser.yaml: input settings for this case (L6). */
  options?: { decimalComma?: boolean; realOddRoots?: boolean; units?: boolean };
  /** parser.yaml, units mode (R28): the exact UnitRequest.formula and the slots, in unit-case.ts syntax. */
  formula?: string;
  slots?: string[];
  /** parser.yaml: entries typed before this one (e.g. a function definition, L6). precision.yaml: inputs evaluated
   *  first in the same view and engine (a stored variable, decisions M4-7). */
  before?: string[];
  /** precision.yaml, kind cas: inputs run first in Home on the same engine (a value stored there, G20). */
  beforeHome?: string[];
  /** precision.yaml, kind cas: the stored names the CAS result must list as used (G20); [] means none. */
  uses?: string[];
  /** units.yaml: the end slot; the exact text, the dimension key (null: an exact 0), the SI value's exact text with
   *  an end slot (si_oracle checks it in oracle.py) and a refusal's message. */
  to?: string;
  exact?: string;
  dim?: string | null;
  /** units.yaml, G25: the unit the value is shown in ("" for a pure number) and the dimension as text. */
  unit?: string;
  dimtext?: string;
  si?: string;
  si_oracle?: string;
  /** units.yaml, G18: σ at 2 significant digits ("none" for a result with no uncertainty), the value with it
   *  ("39.5 ± 1.2") and an oracle expression for σ (oracle.py checks σ against it). */
  unc?: string;
  shown?: string;
  unc_oracle?: string;
  message?: string;
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
      // A case written as `latex` goes through our parser with Home's options (R39: realOddRoots), its `before` too
      const giacOf = (t: string): string => (c.latex !== undefined ? latexToGiac(t, { realOddRoots: true }) : t);
      for (const b of c.before ?? []) host.home(giacOf(b), s);
      runs.get(c.id)!.push(host.home(c.latex !== undefined ? giacOf(c.latex) : c.input!, s).result);
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
    const answered = c.expect === undefined ? rs.every((x) => x.ok && !lostAnswer(x.display, c.input!)) : rs.every((x) => x.display === c.expect);
    const ok = answered && markOk;
    const med = median(rs.map((x) => x.totalMs));
    maxMed = Math.max(maxMed, med);
    if (ok) pass++;
    else console.log(`  home ${c.id}: got ${rs.map((x, k) => `${got[k] ?? "-"} ${x.display}`).join(" / ")}, expect ${c.mark ?? ""} ${c.expect ?? "(mark only)"}`);
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

/** A mark-only case still needs an answer: a number, or a non-number that holds a float (G27: its ⚠ is the mark the
 *  case checks). The input echoed back (BesselJ(1,2) at 30 digits) is a lost result. */
function lostAnswer(shown: string, input: string): boolean {
  return !LOOKS_NUMERIC.test(shown) && !(hasFloat(shown) && shown !== input);
}

async function stagePrecision(): Promise<void> {
  const cs = cases("precision.yaml");
  const shared = new EngineHost(await freshGiac());
  let active = 0;
  let activePass = 0;
  const pending: string[] = [];
  const nowPassing: string[] = [];
  let marksChecked = 0;
  for (const c of cs) {
    const problems: string[] = [];
    let mark: MarkInfo | null;
    let shown: string;
    // A case that stores names in Home (`beforeHome`) gets its own engine, so the stored x does not reach later cases.
    const host = c.beforeHome?.length ? new EngineHost(await freshGiac()) : shared;
    const setting = c.settings?.digits ?? 12;
    // The digits the result is shown with: the setting, or what the input asked for (CAS evalf(x,n), M4-6).
    const digits = c.settings?.shown ?? setting;
    // A case written as `latex` (what the keys type) goes through our parser first, its `before` entries too (R18f1).
    const giacOf = (t: string): string => (c.latex !== undefined ? latexToGiac(t) : t);
    const input = c.latex !== undefined ? latexToGiac(c.latex) : c.input!;
    if (c.kind === "cas") {
      const cs = { ...defaultCasSettings, digits: setting };
      for (const b of c.beforeHome ?? []) host.home(giacOf(b), { ...defaultHomeSettings, digits: setting });
      for (const b of c.before ?? []) host.cas(giacOf(b), cs);
      const r = host.cas(input, cs).result;
      if (c.uses) {
        const got = (r.uses ?? []).map((u) => u.name).join(",");
        if (got !== c.uses.join(",")) problems.push(`uses [${got}], expect [${c.uses.join(",")}]`);
      }
      shown = r.ok ? r.text : `error: ${r.error ?? "engine"}`;
      // A float result carries its numeric facts; an exact rational CAS result is exact (no mark is drawn for it); a
      // true or false resting on a float is approximate (R18f1).
      mark = r.numeric ? markOf(r.numeric, { format: "STD", digits }) : r.ok && RATIONAL_TEXT.test(r.text) ? { mark: "=" } : r.ok && r.approximate ? (r.warn ? { mark: "⚠" } : { mark: "≈" }) : null;
    } else {
      const s: HomeSettings = { ...defaultHomeSettings, angle: c.settings?.angle ?? "rad", digits: setting };
      for (const b of c.before ?? []) host.home(giacOf(b), s);
      const r = host.home(input, s).result;
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
    if (c.expect === undefined && lostAnswer(shown, input)) problems.push(`answer is not a number: ${shown}`);
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
  const m = markOf(r, { format: "STD", digits });
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

const caseSettings = (c: Case): HomeSettings => ({ ...defaultHomeSettings, digits: c.settings?.digits ?? defaultHomeSettings.digits });

function solveCase(host: EngineHost, g: GiacApi, c: Case): Got {
  const s = caseSettings(c);
  if (!c.kind) {
    const r: SolveResult = solve1(g, str(c.eq), str(c.var), str(c.guess), defaultSolveSettings);
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

const UNIT_P95_MS = 5;

/** What a units case got, as text to compare and print. */
function unitGot(r: Quantity | UnitError, c: Case): string {
  if (isUnitError(r)) return `refused: ${unitErrorMessage(r)}`;
  const m = markText(markOf(r.value, { format: "STD", digits: 12 }));
  return `${m ?? "-"} ${r.value.display} exact ${r.value.exact ?? "-"}${c.dim !== undefined ? ` dim ${JSON.stringify(r.dimension)}` : ""}${c.unit !== undefined ? ` unit ${JSON.stringify(r.unit)}` : ""}${c.dimtext !== undefined ? ` dimtext ${JSON.stringify(r.dimensionText)}` : ""}${c.si !== undefined ? ` si ${r.si ?? "-"}` : ""}${c.unc !== undefined ? ` unc ${r.unc?.text ?? "none"}` : ""}${c.shown !== undefined ? ` shown ${r.unc?.shown ?? "-"}` : ""}`;
}

/** The same text for what the case expects; `dim` and `si` are checked where the case gives them. */
function unitWant(c: Case): string {
  if (c.message !== undefined) return `refused: ${c.message}`;
  return `${c.mark ?? "-"} ${str(c.expect as string)} exact ${c.exact ?? "-"}${c.dim !== undefined ? ` dim ${JSON.stringify(c.dim)}` : ""}${c.unit !== undefined ? ` unit ${JSON.stringify(c.unit)}` : ""}${c.dimtext !== undefined ? ` dimtext ${JSON.stringify(c.dimtext)}` : ""}${c.si !== undefined ? ` si ${c.si}` : ""}${c.unc !== undefined ? ` unc ${c.unc}` : ""}${c.shown !== undefined ? ` shown ${c.shown}` : ""}`;
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
    host = new EngineHost(await freshGiac());
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
  const g = await freshGiac();
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
if (want("home")) await stageHome();
if (want("precision")) await stagePrecision();
if (want("solve")) await stageCases("solve", "solve.yaml", solveCase);
if (want("function")) await stageCases("function", "function.yaml", (host, _g, c) => functionCase(host, c));
if (want("bench")) await stageBench();
if (want("units")) await stageUnits();
if (want("parser")) await stageParser();
const failed = summary.filter((s) => !s.ok);
console.log(failed.length ? `\nGOLDEN GATE FAILED: ${failed.map((s) => s.stage).join(", ")}` : "\nGOLDEN GATE PASSED");
process.exit(failed.length ? 1 : 0);
