// SPDX-License-Identifier: GPL-3.0-or-later
// The golden Home and precision cases, run one at a time. Shared by the Node gate (scripts/golden.ts), the Node dump
// (scripts/golden-dump.ts) and the WebView run (goldenBench.ts, ?bench=golden, A20), so both sides run the same code.
import { EngineHost, type GiacApi } from "./engine/host.ts";
import { defaultHomeSettings, type HomeResult, type HomeSettings } from "./engine/homeEval.ts";
import { markOf, type MarkInfo } from "./engine/format.ts";
import { defaultCasSettings } from "./engine/types.ts";
import { ANS_KEY, type ChipTable } from "./input/chips.ts";
import { chipsIn, type ChipFactsTable } from "./engine/chipFacts.ts";
import { inexactConstsIn, type ConstTable } from "./engine/constUnc.ts";
import { latexToGiac, latexToGiacInfo } from "./input/latex-to-giac.ts";
import { rewriteAngles } from "./input/angles.ts";

export type Expect = string | Expect[];

export interface Step {
  input?: string;
  latex?: string;
  angle?: "rad" | "deg";
  /** G49f3: "cas" runs an `input` step in the CAS view (a definition made there); its result is not checked. */
  view?: "home" | "cas";
}

export interface Case {
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
  /** precision.yaml, Home cases: inputs run first in CAS on the same engine (a value stored there, G50f1). */
  beforeCas?: string[];
  /** home.yaml (G34): a sequence of lines, each in its own angle mode; the last one is checked against expect and mark. */
  steps?: Step[];
  /** home.yaml sequences (G49): the constants the steps hold by name (`pasc_<id>`), as G26's table. */
  consts?: ConstTable;
  /** precision.yaml, kind cas: the stored names the CAS result must list as used (G20); [] means none. */
  uses?: string[];
  /** units.yaml: the end slot; the exact text, the dimension key (a result 0 keeps its terms' one, G35), the SI value's exact text with
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
  /** units.yaml, G41: the why-line of a σ shown with ⚠ (the text the user reads); a σ with one and a case without it
   *  fails, and the other way round. */
  unc_why?: string;
  /** units.yaml, G40: the note the result carries (the text the user reads); a result with a note and a case without
   *  one fails, and the other way round. */
  notice?: string;
  message?: string;
  /** bench.yaml (G46): the CAS text in DEG, where it differs from the RAD one. */
  deg?: string;
  /** parser.yaml: the input must be rejected by the parser (docs/04 2.3 #1). */
  error?: boolean;
  /** parser.yaml: the entry's chip table (\res, \ans, \const), keyed as in app/src/input/chips.ts. */
  chips?: ChipTable;
  note?: string;
}

/**
 * G46: Giac runs in radians and the angle mode lives in the parser's text (R64, `sin(pasdeg*x)`). A case's typed Giac
 * text (`input`, `before`, `beforeHome`, `beforeCas`, step inputs, `eq`, `f`, `g`) is what the user types, so it gets
 * the parser's angle rule (input/angles.ts `rewriteAngles`) as the keys' LaTeX would; `latex` goes through the parser.
 */
export function typed(c: Case): Case {
  const one = (t: string): string => rewriteAngles(t);
  const many = <T extends string | string[] | undefined>(x: T): T => (x === undefined ? x : Array.isArray(x) ? (x.map(one) as T) : (one(x) as T));
  const raw = c.latex === undefined;
  return {
    ...c,
    ...(c.input !== undefined ? { input: one(c.input) } : {}),
    ...(raw && c.before ? { before: c.before.map(one) } : {}),
    ...(raw && c.beforeHome ? { beforeHome: c.beforeHome.map(one) } : {}),
    ...(raw && c.beforeCas ? { beforeCas: c.beforeCas.map(one) } : {}),
    ...(c.steps ? { steps: c.steps.map((st) => (st.input !== undefined ? { ...st, input: one(st.input) } : st)) } : {}),
    ...(c.eq !== undefined ? { eq: many(c.eq) } : {}),
    ...(c.f !== undefined ? { f: many(c.f) } : {}),
    ...(c.g !== undefined ? { g: one(c.g) } : {}),
  };
}

/**
 * G34: a sequence of Home lines on a fresh engine, each in its own angle mode. A `latex` step goes through our parser
 * with Home's options and an Ans chip built from the step before, by the session's rule (session.svelte.ts `finish`:
 * the exact text when there is one and it fits, else `full`; exact only when nothing was approximate or cut). An
 * inexact chip makes an "=" a "≈" (displayMode.ts markFor, decisions M4-4); `inexactInput` carries that to markOf.
 */
export async function runSteps(fresh: () => Promise<GiacApi>, steps: Step[], digits: number, consts: ConstTable | undefined): Promise<HomeResult & { inexactInput?: boolean }> {
  const host = new EngineHost(await fresh());
  let last: (HomeResult & { inexactInput?: boolean }) | undefined;
  let chips: ChipTable = {};
  // G49: every step's result as a chip by name (`pasr_<k>`, k from 1), with its facts, for the `input` steps.
  const named: Record<string, ChipFactsTable[string]> = {};
  for (const [k, st] of steps.entries()) {
    const s: HomeSettings = { ...defaultHomeSettings, angle: st.angle ?? "rad", digits };
    if (st.view === "cas") {
      host.cas(st.input!, { ...defaultCasSettings, angle: st.angle ?? "rad", digits });
      continue;
    }
    const p = st.latex !== undefined ? latexToGiacInfo(st.latex, { chips }) : { giac: st.input!, inexact: false };
    const r = (st.latex === undefined && (consts || k > 0) ? host.home(p.giac, s, consts, named) : host.home(p.giac, s)).result;
    last = p.inexact ? { ...r, inexactInput: true } : r;
    const full = r.exact !== undefined && r.exact.length <= 2048 ? r.exact : r.full || r.exact;
    if (r.ok && full && full.length <= 2048) {
      const cut = (r.exact !== undefined && full !== r.exact) || r.value?.re.sticky === true || r.value?.im.sticky === true;
      const exact = !r.approximate && !cut && (r.exact !== undefined || r.exactRational || !/\.|\d[eE][+-]?\d/.test(full));
      chips = { [ANS_KEY]: { value: full, exact } };
      // A named chip follows the session's rule (session.svelte.ts finish): the exact text only when the result is not
      // approximate and the input held no inexact constant or chip, else the confirmed decimal r.full (R65).
      const inexactIn = (consts !== undefined && inexactConstsIn(p.giac, consts).length > 0) || chipsIn(p.giac, named).some((j) => !named[j]!.exact);
      const inexact = r.approximate || inexactIn;
      const exactText = !inexact && r.exact !== undefined && r.exact.length <= 2048 ? r.exact : undefined;
      const value = exactText ?? (r.full || (inexact ? undefined : r.exact));
      if (value && value.length <= 2048) {
        named[String(k + 1)] = { value, reliableDigits: r.reliableDigits, ...(r.warn ? { warn: r.warn } : {}), exact: !inexact && (value === exactText || (r.exact === undefined && r.value?.re.sticky !== true && r.value?.im.sticky !== true && (r.exactRational || !/\.|\d[eE][+-]?\d/.test(value)))) };
      }
    }
  }
  return last!;
}

/** The mark of a sequence's last step: markOf, and never "=" after an inexact chip (displayMode.ts markFor). */
export function seqMark(r: HomeResult & { inexactInput?: boolean }, digits: number): MarkInfo | null {
  const m = markOf(r, { format: "STD", digits });
  return m?.mark === "=" && r.inexactInput ? { mark: "≈" } : m;
}

/** A mark as text: "=", "≈", "⚠", or "⚠11" (eleven confirmed digits). */
export function markText(m: MarkInfo | null): string | undefined {
  return m ? `${m.mark}${m.n ?? ""}` : undefined;
}


export const RATIONAL_TEXT = /^-?\d+(\/\d+)?$/;

/** One home.yaml case on `host` (a sequence on its own engine from `fresh`). */
export async function runHomeCase(c: Case, host: EngineHost, fresh: () => Promise<GiacApi>): Promise<HomeResult & { inexactInput?: boolean }> {
  if (c.steps) return runSteps(fresh, c.steps, c.settings?.digits ?? 12, c.consts);
  const s: HomeSettings = { ...defaultHomeSettings, angle: c.settings?.angle ?? "rad" };
  // A case written as `latex` goes through our parser with Home's options (no realOddRoots since R66), its `before` too
  const giacOf = (t: string): string => (c.latex !== undefined ? latexToGiac(t) : t);
  for (const b of c.before ?? []) host.home(giacOf(b), s);
  return host.home(c.latex !== undefined ? giacOf(c.latex) : c.input!, s).result;
}

/** What one precision.yaml case showed: the text, its mark, the Giac input, and a `uses` mismatch (kind cas). */
export interface PrecisionRun {
  shown: string;
  mark: MarkInfo | null;
  input: string;
  digits: number;
  problems: string[];
}

/** One precision.yaml case: on `shared`, or on its own engine when it stores names in the other view. */
export async function runPrecisionCase(c: Case, shared: EngineHost, fresh: () => Promise<GiacApi>): Promise<PrecisionRun> {
  const problems: string[] = [];
  let mark: MarkInfo | null;
  let shown: string;
  const host = c.beforeHome?.length || c.beforeCas?.length ? new EngineHost(await fresh()) : shared;
  const setting = c.settings?.digits ?? 12;
  // The digits the result is shown with: the setting, or what the input asked for (CAS evalf(x,n), M4-6).
  const digits = c.settings?.shown ?? setting;
  const giacOf = (t: string): string => (c.latex !== undefined ? latexToGiac(t) : t);
  const input = c.latex !== undefined ? latexToGiac(c.latex) : c.input!;
  if (c.kind === "cas") {
    const cs = { ...defaultCasSettings, angle: c.settings?.angle ?? "rad", digits: setting };
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
    // A rational text whose decision did not hold at P + 20 comes approximate (G38), so that is read first.
    mark = r.numeric ? markOf(r.numeric, { format: "STD", digits }) : r.ok && r.approximate ? (r.warn ? { mark: "⚠" } : { mark: "≈" }) : r.ok && RATIONAL_TEXT.test(r.text) ? { mark: "=" } : null;
  } else {
    const s: HomeSettings = { ...defaultHomeSettings, angle: c.settings?.angle ?? "rad", digits: setting };
    for (const b of c.beforeCas ?? []) host.cas(giacOf(b), { ...defaultCasSettings, angle: s.angle, digits: setting });
    for (const b of c.before ?? []) host.home(giacOf(b), s);
    const r = host.home(input, s).result;
    shown = r.ok ? r.display : `error: ${r.display}`;
    mark = markOf(r, { format: "STD", digits });
  }
  return { shown, mark, input, digits, problems };
}

/** One case's outcome on one side, for the desktop/WebView comparison (A20). */
export interface GoldenRecord {
  stage: "home" | "precision";
  id: string;
  /** The input text the case ran (Giac text, or the parser's result for a latex case). */
  input: string;
  display: string;
  /** The mark with its digits ("=", "≈", "⚠", "⚠11"), "" for none. */
  mark: string;
  /** The text the result copies (home only). */
  full?: string;
}

/** Home and precision cases in file order, one engine round (the stages' shared hosts). */
export async function goldenRecords(
  home: Case[],
  precision: Case[],
  fresh: () => Promise<GiacApi>,
  tick: (stage: string, id: string) => Promise<void> | void = () => {},
): Promise<GoldenRecord[]> {
  const out: GoldenRecord[] = [];
  const hh = new EngineHost(await fresh());
  for (const c of home) {
    await tick("home", c.id);
    const r = await runHomeCase(c, hh, fresh);
    out.push({ stage: "home", id: c.id, input: c.input ?? c.latex ?? c.steps?.at(-1)?.input ?? c.steps?.at(-1)?.latex ?? "", display: r.display, mark: markText(seqMark(r, c.settings?.digits ?? 12)) ?? "", full: r.full });
  }
  const ph = new EngineHost(await fresh());
  for (const c of precision) {
    await tick("precision", c.id);
    const r = await runPrecisionCase(c, ph, fresh);
    out.push({ stage: "precision", id: c.id, input: r.input, display: r.shown, mark: markText(r.mark) ?? "" });
  }
  return out;
}
