// SPDX-License-Identifier: GPL-3.0-or-later
// Dimensions of the unit view (P15, docs/04 4.2): the base dimensions of the Find index's `dim` keys, the Giac symbol
// each becomes, and the key and text of a dimension. Plain TS, used on both sides of the worker. Only erasable
// TypeScript syntax, so Node runs this file directly (the golden gate).

export interface BaseDimension {
  /** The base unit in the index's dimension key ("kg1m1s-2"). */
  key: string;
  /** The Giac symbol it becomes in an evaluation (assumed positive, so √(m²) is m). */
  symbol: string;
  /** Its name in a message ("L", "Θ", "angle"). */
  name: string;
}

/** In the order a dimension is written (M·L²·T⁻²): the SI bases, then the plane angle (rad stays in the dimension,
 *  docs/04 4.3), then qalc's Np and bit. */
export const BASES: readonly BaseDimension[] = [
  { key: "kg", symbol: "pasdimM", name: "M" },
  { key: "m", symbol: "pasdimL", name: "L" },
  { key: "s", symbol: "pasdimT", name: "T" },
  { key: "A", symbol: "pasdimI", name: "I" },
  { key: "K", symbol: "pasdimK", name: "Θ" },
  { key: "mol", symbol: "pasdimN", name: "N" },
  { key: "cd", symbol: "pasdimJ", name: "J" },
  { key: "rad", symbol: "pasdimA", name: "angle" },
  { key: "Np", symbol: "pasdimNp", name: "Np" },
  { key: "bit", symbol: "pasdimB", name: "bit" },
];

const BY_KEY = new Map(BASES.map((b) => [b.key, b]));

/** An exponent: an integer or a fraction p/q in lowest terms ("2", "-1", "-5/2"). */
const EXPONENT = /^-?\d+(?:\/\d+)?$/;

export function isExponent(s: string): boolean {
  return EXPONENT.test(s);
}

/** A dimension key ("kg1m1s-2", "A-1kg1m2s-5/2", "" for a pure number) as exponents by base key. Throws on a base
 *  the evaluator does not know. */
export function parseDimKey(key: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /([A-Za-z]+?)(-?\d+(?:\/\d+)?)/g;
  let at = 0;
  for (let m = re.exec(key); m; m = re.exec(key)) {
    if (m.index !== at) break;
    if (!BY_KEY.has(m[1]!)) throw new Error(`unknown base dimension ${m[1]} in ${key}`);
    if (m[2] !== "0") out.set(m[1]!, m[2]!);
    at = re.lastIndex;
  }
  if (at !== key.length) throw new Error(`bad dimension key ${key}`);
  return out;
}

/** The dimension key of exponents in BASES order (as Giac returns them), sorted as the index's generator sorts it
 *  (tools/find-index/generate.mjs dimKey: by base, case-insensitive). */
export function dimKeyOf(exponents: readonly string[]): string {
  return BASES.map((b, i) => [b.key, exponents[i] ?? "0"] as const)
    .filter(([, e]) => e !== "0")
    .sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()) || a[0].localeCompare(b[0]))
    .map(([k, e]) => `${k}${e}`)
    .join("");
}

const SUPER: Readonly<Record<string, string>> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

/** An exponent as text after a unit symbol: "²", "⁻¹"; a fraction as "^(−5/2)" in plain characters. */
export function powerText(e: string): string {
  if (e === "1") return "";
  if (e.includes("/")) return `^(${e})`;
  return [...e].map((c) => SUPER[c] ?? c).join("");
}

/** A dimension as text for a message: "M·L²·T⁻²", "L·T⁻¹", "1" for a pure number; a fractional power as "T^(-5/2)". */
export function dimensionText(key: string): string {
  const exps = parseDimKey(key);
  const parts = BASES.filter((b) => exps.has(b.key)).map((b) => {
    const e = exps.get(b.key)!;
    if (e === "1") return b.name;
    if (e.includes("/")) return `${b.name}^(${e})`;
    return b.name + [...e].map((c) => SUPER[c] ?? c).join("");
  });
  return parts.length ? parts.join("·") : "1";
}

/** The Giac product of dimension symbols for a key ("pasdimM^1*pasdimL^1*pasdimT^(-2)"), "" for a pure number. */
export function dimSymbols(key: string): string {
  const exps = parseDimKey(key);
  return BASES.filter((b) => exps.has(b.key))
    .map((b) => `${b.symbol}^(${exps.get(b.key)!})`)
    .join("*");
}

/** The named coherent SI units, by dimension key (the Find index's keys; N, J, W… have factor 1). */
const NAMED: Readonly<Record<string, string>> = {
  "s-1": "Hz", "kg1m1s-2": "N", "kg1m-1s-2": "Pa", "kg1m2s-2": "J", "kg1m2s-3": "W", "A1s1": "C", "A-1kg1m2s-3": "V",
  "A2kg-1m-2s4": "F", "A-2kg1m2s-3": "Ω", "A2kg-1m-2s3": "S", "A-1kg1m2s-2": "Wb", "A-1kg1s-2": "T", "A-2kg1m2s-2": "H",
};

/** Base units that take an SI prefix on their own (kg through its gram: `exp10` is the gram's power of ten in kg). */
const PREFIXABLE: Readonly<Record<string, { symbol: string; exp10: number }>> = {
  kg: { symbol: "g", exp10: -3 }, m: { symbol: "m", exp10: 0 }, s: { symbol: "s", exp10: 0 }, A: { symbol: "A", exp10: 0 },
  K: { symbol: "K", exp10: 0 }, mol: { symbol: "mol", exp10: 0 }, cd: { symbol: "cd", exp10: 0 },
};

/** The coherent SI unit of a dimension as text ("N", "m/s", "kg·m²/s³"). `prefixable` is the symbol an SI prefix goes
 *  before and that symbol's factor to the unit as a power of ten ("g", −3 for kg); absent for a unit that takes none
 *  (a product of bases, a pure number). */
export function siUnit(key: string): { text: string; prefixable?: { symbol: string; exp10: number } } {
  const named = NAMED[key];
  if (named) return { text: named, prefixable: { symbol: named, exp10: 0 } };
  const exps = parseDimKey(key);
  const only = exps.size === 1 ? [...exps][0]! : null;
  if (only && only[1] === "1" && PREFIXABLE[only[0]]) return { text: only[0], prefixable: PREFIXABLE[only[0]]! };
  return { text: unitProduct(BASES.filter((b) => exps.has(b.key)).map((b) => [b.key, exps.get(b.key)!] as const)) };
}

/** Unit symbols with exponents as text: the positive ones joined by "·", the negative ones after a "/" ("kg·m²/s³",
 *  "1/s"). */
export function unitProduct(factors: readonly (readonly [string, string])[]): string {
  const part = (list: (readonly [string, string])[], flip: boolean): string =>
    list.map(([sym, e]) => sym + powerText(flip ? (e.startsWith("-") ? e.slice(1) : e) : e)).join("·");
  const pos = factors.filter(([, e]) => !e.startsWith("-"));
  const neg = factors.filter(([, e]) => e.startsWith("-"));
  if (!neg.length) return part(pos, false);
  const down = part(neg, true);
  return `${pos.length ? part(pos, false) : "1"}/${down}`;
}
