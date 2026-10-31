// SPDX-License-Identifier: GPL-3.0-or-later
// G26 (deep-dive item 17): the digits a constant's uncertainty leaves. A Home input may hold constants as names
// (`pasc_<id>`, R40's parser switch) with a table of their values and CODATA standard uncertainties. The values are
// put in and the input evaluates as before; then the first-order σ of the result (G18's rule, units/evaluate.ts):
// σ = sqrt(Σ (∂f/∂xᵢ · σᵢ)²) over independent inputs, exactly with Giac's diff at their values. G81: an inexact
// constant with a basis (G80: its value over the measured leaves it is computed from, `pasl_<leaf>`) enters as that
// basis, so constants sharing a leaf (μ₀, ε₀ and Z₀ share α) are correlated: the value is evaluated through the basis
// (μ₀·ε₀·c² is exactly 1) and σ is taken over the leaves; a constant without one is an input of its own, as before.
// `uncDigits` is the number of significant digits of the shown value before the digit position of σ's first digit:
// the digits from there on are uncertain. Synchronous, UI-free. Only erasable TypeScript syntax.
import { decimalFromString, isZero, roundSignificant, type DecimalValue } from "./format.ts";
import { toExactLiterals, type HomeResult } from "./homeEval.ts";
import type { Giac } from "./numeric.ts";
import { mapNames, names } from "./giacPrint.ts";
import { basisOf, isZeroText, LEAF_PREFIX, mapLeaves } from "./constBasis.ts";
import type { ValueFacts } from "./types.ts";

/** A constant the input holds by name: its value as Giac text (`6.67430E-11`), and its standard uncertainty in the
 *  same unit (`0.00015E-11`), absent or zero when the constant is exact. Keyed by the id after `pasc_`. */
export interface ConstEntry {
  value: string;
  unc?: string;
  /** G86: the facts the constant carries (R69 reads them), set only by `constTable` (from `constFacts`). `unc` alone
   *  decides whether the constant is inexact; these facts are read, never trusted over it. */
  facts?: ValueFacts;
  /** G81 (from Find's item, G80): the value over `pasl_<leaf>` names and exact numbers; inexact constants only. */
  basis?: string;
  /** G81: the leaves `basis` uses, each with its value and standard uncertainty. */
  basisLeaves?: Readonly<Record<string, { value: string; unc: string }>>;
}
export type ConstTable = Readonly<Record<string, ConstEntry>>;

/** The prefix of a constant sent by name. */
export const CONST_PREFIX = "pasc_";


/** An inexact constant has a nonzero uncertainty text (the one rule; constFacts states it as facts). */
function inexact(e: ConstEntry | undefined): e is ConstEntry & { unc: string } {
  return e?.unc !== undefined && !isZeroText(e.unc);
}

/** The facts a constant carries (G86), from its uncertainty: exact when it has none (or zero); else not exact, its
 *  digits not limited by the agreement check, and `inexact` (never `=`, decisions M4-4). */
export function constFacts(e: ConstEntry): ValueFacts {
  return !inexact(e) ? { exact: true, reliableDigits: null } : { exact: false, reliableDigits: null, inexact: true };
}

/** A constant table with every entry carrying its facts (G86): where a table is built (the golden sequences, G49). */
export function constTable(entries: Readonly<Record<string, ConstEntry>>): ConstTable {
  return Object.fromEntries(Object.entries(entries).map(([id, e]) => [id, { ...e, facts: constFacts(e) }]));
}

/**
 * `input` with every constant of `table` replaced by its value in brackets; when `keep` is given, the constants it
 * holds stay names. Names not in the table are left alone. G81: a constant with a basis is replaced by its basis, its
 * leaves as their values, or as `pasl_<leaf>` names when `leaves` is "names" (for σ).
 */
export function withConstValues(input: string, table: ConstTable, keep?: ReadonlySet<string>, leaves: "values" | "names" = "values"): string {
  return mapNames(input, ({ name }) => {
    const id = name.slice(CONST_PREFIX.length);
    const e = name.startsWith(CONST_PREFIX) && id !== "" && Object.hasOwn(table, id) ? table[id] : undefined;
    if (!e || keep?.has(id)) return null;
    const b = basisOf(e);
    if (b === undefined) return `(${e.value})`;
    return `(${leaves === "names" ? b : mapLeaves(b, (l) => `(${e.basisLeaves![l]!.value})`)})`;
  }, "typed");
}

/** The inexact constants of `table` that `input` holds, in order of first appearance. */
export function inexactConstsIn(input: string, table: ConstTable): string[] {
  const ids: string[] = [];
  for (const { name } of names(input, "typed")) {
    const id = name.slice(CONST_PREFIX.length);
    if (name.startsWith(CONST_PREFIX) && id !== "" && !ids.includes(id) && Object.hasOwn(table, id) && inexact(table[id])) ids.push(id);
  }
  return ids;
}

/** An independent input of σ: a Giac name, its value and its standard uncertainty. */
interface SigmaInput {
  name: string;
  value: string;
  unc: string;
}

/** G81: the independent inputs of the inexact constants `ids`: a constant without a basis is one (`keep` gets its id);
 *  one with a basis brings its uncertain leaves, each once (the first constant that names a leaf gives its numbers;
 *  every basis comes from the same index). */
function sigmaInputs(table: ConstTable, ids: readonly string[]): { keep: Set<string>; inputs: SigmaInput[] } {
  const keep = new Set<string>();
  const inputs: SigmaInput[] = [];
  for (const id of ids) {
    const e = table[id]!;
    const b = basisOf(e);
    if (b === undefined) {
      keep.add(id);
      inputs.push({ name: `${CONST_PREFIX}${id}`, value: e.value, unc: e.unc! });
      continue;
    }
    mapLeaves(b, (l) => {
      const leaf = e.basisLeaves![l]!;
      const name = `${LEAF_PREFIX}${l}`;
      if (!isZeroText(leaf.unc) && !inputs.some((v) => v.name === name)) inputs.push({ name, value: leaf.value, unc: leaf.unc });
      return null;
    });
  }
  return { keep, inputs };
}

/** The Giac text of the first-order σ of `body` over the inexact constants `ids` (decimals as exact rationals): over
 *  the constants themselves, or over their leaves where they have a basis (G81). */
export function sigmaExpr(body: string, table: ConstTable, ids: readonly string[]): string {
  const { keep, inputs } = sigmaInputs(table, ids);
  if (!inputs.length) return "0";
  const f = toExactLiterals(withConstValues(body, table, keep, "names"));
  const at = `[${inputs.map((v) => `${v.name}=(${toExactLiterals(v.value)})`).join(",")}]`;
  const terms = inputs.map((v) => `(subst(diff(${f},${v.name}),${at})*(${toExactLiterals(v.unc)}))^2`);
  return `sqrt(${terms.join("+")})`;
}

/** Significant digits of `value` shown at `digits` that lie before the position of σ's first digit (≥ 0). Null for
 *  a σ of zero (no digit is uncertain). A value of zero has no digit to keep: 0. */
export function uncDigitsOf(value: DecimalValue, sigma: DecimalValue, digits: number): number | null {
  if (isZero(sigma)) return null;
  if (isZero(value)) return 0;
  return Math.max(0, roundSignificant(value, digits).exp - sigma.exp);
}

/**
 * The `uncDigits` of a Home result computed from `body` (the input with its constants as names): absent when no
 * inexact constant of `table` is in it, when the result is not one real number, or when σ cannot be computed (a
 * function Giac cannot differentiate, the budget ran out).
 */
export function constUncDigits(giac: Giac, body: string, table: ConstTable, r: HomeResult, digits: number): number | undefined {
  const ids = inexactConstsIn(body, table);
  if (!ids.length || !r.ok || !r.value || r.items || !isZero(r.value.im)) return undefined;
  const out = giac.eval(`evalf(${sigmaExpr(body, table, ids)},20)`);
  if (out.startsWith("GIAC_ERROR")) return undefined;
  const sigma = decimalFromString(out);
  if (!sigma) return undefined;
  return uncDigitsOf(r.value.re, sigma, digits) ?? undefined;
}
