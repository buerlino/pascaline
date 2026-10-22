// SPDX-License-Identifier: GPL-3.0-or-later
// G86: the one rule that turns an engine result into what a history item keeps of it (docs/04 2.8): the chip text
// `full`, whether it is exact (`fullExact`), the text drawn when it differs (`drawn`), the value and its facts, and the
// chip a finished item gives. Pure TypeScript, no runes: the session (state/session.svelte.ts) and the golden runner
// (goldenRun.ts, run by Node) both call it, so the gate checks the app's own rule. Only erasable TypeScript syntax.
import type { ChipFactsTable } from "../engine/chipFacts.ts";
import { decimalFromRational, decimalFromString, type ComplexValue } from "../engine/format.ts";
import type { ValueFacts } from "../engine/types.ts";
import type { Chip, ChipTable } from "../input/chips.ts";
import type { Rational, ResultFacts } from "./displayMode.ts";

/** A chip carries at most this much text (docs/04 2.8); a longer result is inserted as it is drawn. */
export const FULL_LIMIT = 2048;
/** A numeric list or matrix keeps its elements in the history (to re-format it); beyond this the item shows no mark. */
export const ITEMS_LIMIT = 400;

/** Engine text with a decimal point or an E exponent is rounded digits, not an exact value. */
const isDigitsText = (t: string): boolean => /\.|\d[eE][+-]?\d/.test(t);
const RATIONAL = /^(-?\d+)(?:\/(\d+))?$/;
/** A plain integer or fraction text as a Rational; undefined for anything else (or a zero denominator). */
export function rationalOf(text: string | undefined): Rational | undefined {
  const m = text === undefined ? null : RATIONAL.exec(text.trim());
  if (!m || m[1] === undefined || (m[2] !== undefined && BigInt(m[2]) === 0n)) return undefined;
  return { n: m[1], d: m[2] ?? "1" };
}

/** What the rule reads of a result's facts: its ValueFacts, and a list's or matrix's elements. */
export interface FactsSource {
  facts: ValueFacts;
  items?: readonly { value?: ComplexValue; facts: ValueFacts }[];
  shape?: [number, number];
  digits?: number;
}
/** A Home result as the rule reads it (HomeOutcome of the port, HomeResult of the engine). */
export interface HomeIn extends FactsSource {
  ok: boolean;
  display: string;
  approximate: boolean;
  value?: ComplexValue;
  exact?: string;
  full: string;
}
/** A CAS result as the rule reads it (CasOutcome of the port, CasResult of the engine). */
export interface CasIn {
  ok: boolean;
  text: string;
  full?: string;
  approximate?: boolean;
  facts: ValueFacts;
  numeric?: HomeIn;
}

/** What a history item keeps of a result; a field that is absent is not set on the item. */
export interface ItemResult {
  approximate: boolean;
  value?: ComplexValue;
  facts?: ResultFacts;
  rational?: Rational;
  /** The chip value (docs/04 2.8): the exact text, or the confirmed decimal (R65). */
  full?: string;
  fullExact?: boolean;
  /** The text drawn when it differs from `full` (G46f1); Copy gives it. */
  drawn?: string;
}

/** The facts of an engine result, as kept in a history item: its ValueFacts whole (G76), with its elements'. Undefined:
 *  too large to keep. */
export function factsFrom(r: FactsSource): ResultFacts | undefined {
  const f: ResultFacts = { ...r.facts };
  if (r.digits !== undefined) f.digits = r.digits;
  if (r.items) {
    if (r.items.length > ITEMS_LIMIT) return undefined;
    f.items = r.items.map((it) => ({ ...it.facts, ...(it.value ? { value: it.value } : {}) }));
    if (r.shape) f.shape = r.shape;
  }
  return f;
}

/** A true or false: as approximate as an inexact chip it came from (R18f1; decisions M4-4). */
const isTruth = (t: string): boolean => /^(true|false)$/.test(t);

/** A Home result as a history item keeps it; `inexactInput`: an inexact chip or constant went into the input. */
export function homeItem(r: HomeIn, inexactInput: boolean): ItemResult {
  const out: ItemResult = { approximate: r.approximate || (inexactInput && isTruth(r.display)) };
  if (r.value) out.value = r.value;
  if (r.ok) {
    const f = factsFrom(r);
    if (f) out.facts = f;
  }
  const q = r.value ? rationalOf(r.exact) : undefined;
  if (q) out.rational = q;
  // The chip value (docs/04 2.8): an exact result's exact text when it fits in 2 kB, else the engine's `full` (the
  // confirmed decimal), never nothing for a number (R44, F37). A result that is not exact (a float, or from an inexact
  // chip or constant) carries its confirmed decimal, never the rational of more digits (R65, D1, D2).
  const inexact = r.approximate || inexactInput;
  const exactText = !inexact && r.exact !== undefined && r.exact.length <= FULL_LIMIT ? r.exact : undefined;
  const full = exactText ?? (r.full || (inexact ? undefined : r.exact));
  if (r.ok && full && full.length <= FULL_LIMIT) {
    out.full = full;
    // A decimal cut from a longer exact text, or from a value with more digits, is not exact, though the value is.
    const cut = r.exact !== undefined || r.value?.re.sticky === true || r.value?.im.sticky === true;
    out.fullExact = !inexact && (full === exactText || (!cut && (r.facts.exact || !isDigitsText(full))));
    // G46f1: a symbolic result whose chip text (radian) differs from the text drawn (DEG) copies the drawn text.
    if (!r.value && !r.items && full !== r.display && r.display.length <= FULL_LIMIT) out.drawn = r.display;
  }
  return out;
}

/** A CAS result as a history item keeps it; `inexactInput` as for homeItem. */
export function casItem(r: CasIn, inexactInput: boolean): ItemResult {
  const out: ItemResult = { approximate: false };
  if (!r.ok) return out;
  // A plain number (3/4, 2.5): the Format key can show it in the other forms.
  const q = rationalOf(r.text);
  const dec = q ? decimalFromRational(BigInt(q.n), BigInt(q.d)) : decimalFromString(r.text);
  if (dec) out.value = { re: dec, im: decimalFromRational(0n, 1n) };
  if (q) out.rational = q;
  // A float result: every confirmed digit the engine gave (r.text is drawn at the shown digits only).
  const nf = r.numeric?.full;
  const full = nf !== undefined && nf.length > 0 ? nf : (r.full ?? r.text); // G46: the radian text, not the DEG drawing
  if (full.length <= FULL_LIMIT) {
    out.full = full;
    out.fullExact = !inexactInput && !r.approximate && !isDigitsText(full); // R65 (D2): an inexact chip's result never is; nor a float's (G86f1)
  }
  if (r.full !== undefined && r.full !== r.text && !r.numeric?.value && r.text.length <= FULL_LIMIT) out.drawn = r.text; // G46f1
  // A true or false that rests on a float, or on an inexact chip, is marked approximate (R18f1); a non-number with a
  // float in it comes approximate and unchecked, so ⚠ (G27)
  if (r.approximate || (inexactInput && isTruth(r.text))) {
    out.approximate = true;
    out.facts = { ...(r.numeric ? {} : r.facts), exact: false, reliableDigits: null };
  }
  // A result with a float in it comes with its value and facts (docs/04 2.9): drawn by our formatter, marked.
  const n = r.numeric;
  if (n?.value) {
    out.value = n.value;
    const f = factsFrom(n);
    if (f) out.facts = f;
    if (n.full.length <= FULL_LIMIT) {
      out.full = n.full;
      out.fullExact = false;
    }
  }
  return out;
}

/** What chipOf reads of a history item. */
export interface ChipSource {
  status: string;
  full?: string;
  fullExact?: boolean;
  facts?: ValueFacts;
}

/** The chip a finished result gives when it is tapped, picked or read as Ans (docs/04 2.8); undefined: insert it as
 *  drawn. */
export function chipOf(item: ChipSource): Chip | undefined {
  if (item.status !== "done" || item.full === undefined) return undefined;
  if (item.fullExact === true) return { value: item.full, exact: true };
  // R65 (deep check D1): a chip that is not exact carries the facts it was shown with, so the next line keeps them
  const f = item.facts;
  return { value: item.full, exact: false, ...(f ? { reliableDigits: f.reliableDigits } : {}), ...(f?.warn ? { warn: f.warn } : {}) };
}

/** The chips an input holds by name (`pasr_<k>`), as the engine takes them (G49): the value and the facts. */
export function chipFactsOf(named: ChipTable): ChipFactsTable {
  const out: Record<string, ChipFactsTable[string]> = {};
  for (const [k, c] of Object.entries(named))
    out[k] = { value: c.value, reliableDigits: c.reliableDigits ?? null, exact: c.exact, ...(c.warn ? { warn: c.warn } : {}) };
  return out;
}
