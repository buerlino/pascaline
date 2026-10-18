// SPDX-License-Identifier: GPL-3.0-or-later
// The builder of the unit view (P15, docs/04 4.2): a UnitRequest (the formula with a placeholder per slot and per
// constant, the slots as tokens) becomes a UnitJob, Giac text in which every unit is its exact SI factor from the
// Find index times the dimension symbols of dims.ts. Main thread, plain TS, no engine.
import { BASES, dimKeyOf, dimSymbols, isExponent, parseDimKey, unitProduct } from "./dims.ts";
import type { FactorTable, UnitFactor } from "./factors.ts";
import type { ShownUnit, UncVar, UnitError, UnitJob, UnitRequest, UnitSlot, UnitToken } from "./types.ts";

/** The logarithmic units: any unit with the Np dimension, and these. Each is a level of a ratio to a reference:
 *  `k`·log10 of the field ratio (dB 20, bel 2) or the power ratio (dBm, dBW 10), Np the ln of the field ratio; `ref`
 *  the reference in SI (1 mW for dBm). 1 Np = 20/ln(10) dB, as the field-quantity convention has it. */
const LOGARITHMIC: ReadonlyMap<string, { k: number | "ln"; ref: string }> = new Map([
  ["dB", { k: 20, ref: "1" }], ["bel", { k: 2, ref: "1" }], ["Np", { k: "ln", ref: "1" }],
  ["dBm", { k: 10, ref: "1/1000" }], ["dBW", { k: 10, ref: "1" }],
]);

class Refused extends Error {
  readonly why: UnitError;
  constructor(why: UnitError) {
    super(why.error);
    this.why = why;
  }
}

/** -p/q of an exponent text p/q. */
function negate(e: string): string {
  return e.startsWith("-") ? e.slice(1) : `-${e}`;
}

/** One token as Giac text: (prefix · factor · dimension symbols)^power. */
function tokenGiac(t: UnitToken, below: boolean, table: FactorTable): string {
  const u = table.units.get(t.unit);
  if (!u) throw new Refused({ error: "engine", detail: `no unit ${t.unit} in the index` });
  if (LOGARITHMIC.has(t.unit) || /Np/.test(u.dim ?? "")) throw new Refused({ error: "logarithmic", unit: u.symbol });
  if (!u.si || u.dim === undefined) throw new Refused({ error: "nofactor", unit: u.symbol });
  if (u.si.includes("+")) throw new Refused({ error: "temperature", unit: u.symbol });
  let factor = `(${u.si})`;
  if (t.prefix !== undefined) {
    const p = table.prefixes.get(t.prefix);
    if (!p) throw new Refused({ error: "engine", detail: `no prefix ${t.prefix} in the index` });
    factor = `(${p.si})*${factor}`;
  }
  const power = t.power ?? "1";
  if (!isExponent(power)) throw new Refused({ error: "engine", detail: `bad power ${power}` });
  const dims = dimSymbols(u.dim);
  const body = `(${factor}${dims ? `*${dims}` : ""})`;
  const p = below ? negate(power) : power;
  return p === "1" ? body : `${body}^(${p})`;
}

/** A slot as Giac text: the product of its tokens, those from `per` on below the ÷. */
export function slotGiac(slot: UnitSlot, table: FactorTable): string {
  if (!slot.tokens.length) throw new Refused({ error: "engine", detail: "an empty slot" });
  const per = slot.per ?? slot.tokens.length;
  if (slot.per !== undefined && (per < 1 || per >= slot.tokens.length)) throw new Refused({ error: "engine", detail: `bad ÷ place ${per}` });
  return `(${slot.tokens.map((t, i) => tokenGiac(t, i >= per, table)).join("*")})`;
}

const isAffine = (u: UnitFactor): boolean => u.si?.includes("+") === true;
const isLog = (id: string, u: UnitFactor): boolean => LOGARITHMIC.has(id) || /Np/.test(u.dim ?? "");

/** The first token of a slot that is an absolute temperature or a logarithmic unit, or null. */
function specialIn(slot: UnitSlot, table: FactorTable): { id: string; u: UnitFactor; bare: boolean } | null {
  for (const t of slot.tokens) {
    const u = table.units.get(t.unit);
    if (u && (isAffine(u) || isLog(t.unit, u)))
      return { id: t.unit, u, bare: slot.tokens.length === 1 && slot.per === undefined && t.prefix === undefined && (t.power ?? "1") === "1" };
  }
  return null;
}

const refuseSpecial = (id: string, u: UnitFactor): Refused => new Refused({ error: isLog(id, u) ? "logarithmic" : "temperature", unit: u.symbol });

/** The number part of a formula that is only `number*pasuN` (or `pasuN`): a unit-free factor with no +/- outside
 *  parentheses (2+3*pasu1 is not (2+3)*pasu1), else null. */
function aloneNumber(formula: string, n: number): string | null {
  const m = /^\s*(?:(.+?)\s*\*\s*)?pasu(\d+)\s*$/.exec(formula);
  if (!m || Number(m[2]) !== n) return null;
  const num = m[1]?.trim() ?? "1";
  // E notation (1.5e-3, as the parser writes it): a digit, e or E, an optional sign, digits.
  const E = /(\d)[eE][+-]?\d+/g;
  if (!/^[0-9.+\-*/^()\s]+$/.test(num.replace(/\bpi\b/g, "1").replace(E, "$1"))) return null;
  let depth = 0;
  for (let i = 0; i < num.length; i++) {
    const c = num[i]!;
    if (c === "(") depth++;
    else if (c === ")" && --depth < 0) return null;
    else if (depth === 0 && (c === "+" || c === "-") && num.slice(0, i).trim() !== "" && !/[*/^(]\s*$/.test(num.slice(0, i)) && !/\d[eE]$/.test(num.slice(0, i))) return null;
  }
  return depth === 0 ? num : null;
}

/** A source quantity that is alone and absolute: °C, °F by K = a·x + b, a logarithmic unit by its level's ratio. */
function specialSource(id: string, u: UnitFactor, num: string): string {
  const dims = dimSymbols(u.dim ?? "");
  const rule = LOGARITHMIC.get(id);
  if (isLog(id, u)) {
    if (!rule) throw refuseSpecial(id, u);
    const ratio = rule.k === "ln" ? `exp(${num})` : `pasup((${num})/${rule.k})`;
    return `((${ratio})*(${rule.ref})${dims ? `*${dims}` : ""})`;
  }
  const [a, b] = u.si!.split("+");
  return `(((${a})*(${num})+(${b}))${dims ? `*${dims}` : ""})`;
}

/** The end slot °C, °F or a logarithmic unit: its factor (a, or the reference) and the offset or the level rule. */
function specialEnd(id: string, u: UnitFactor): { end: string; endOffset?: string; endLog?: string } {
  const dims = dimSymbols(u.dim ?? "");
  const rule = LOGARITHMIC.get(id);
  if (isLog(id, u)) {
    if (!rule) throw refuseSpecial(id, u);
    return { end: `((${rule.ref})${dims ? `*${dims}` : ""})`, endLog: rule.k === "ln" ? "ln(pasux)" : `${rule.k}*log10(pasux)` };
  }
  const [a, b] = u.si!.split("+");
  return { end: `((${a})${dims ? `*${dims}` : ""})`, endOffset: b! };
}

/** A constant as Giac text: its value times its dimension symbols (the worker makes the decimal exact). A constant
 *  with a CODATA uncertainty is an uncertain input: its number is the symbol `uncVar` names, once per constant. */
function constGiac(id: string, table: FactorTable, vars: UncVar[], seen: Map<string, string>): { giac: string; inexact: boolean } {
  const c = table.consts.get(id);
  if (!c) throw new Refused({ error: "engine", detail: `no constant ${id} in the index` });
  if (c.dim === undefined) throw new Refused({ error: "nofactor", unit: c.symbol });
  const dims = dimSymbols(c.dim);
  let number = `(${c.value})`;
  if (c.unc !== undefined) {
    let name = seen.get(id);
    if (name === undefined) {
      name = `pasv${vars.length + 1}`;
      vars.push({ name, value: c.value, sigma: c.unc });
      seen.set(id, name);
    }
    number = name;
  }
  return { giac: `(${number}${dims ? `*${dims}` : ""})`, inexact: c.unc !== undefined };
}

/** `pasupm(value,sigma)` calls of a formula (G18) become the symbols pasv<n>, appended to `vars`. */
function uncertainValues(formula: string, vars: UncVar[]): string {
  const CALL = "pasupm(";
  let out = "";
  let i = 0;
  for (;;) {
    const at = formula.indexOf(CALL, i);
    if (at < 0) return out + formula.slice(i);
    out += formula.slice(i, at);
    let depth = 1;
    let comma = -1;
    let j = at + CALL.length;
    for (; j < formula.length && depth > 0; j++) {
      const c = formula[j];
      if (c === "(") depth++;
      else if (c === ")") depth--;
      else if (c === "," && depth === 1 && comma < 0) comma = j;
    }
    if (depth > 0 || comma < 0) throw new Refused({ error: "engine", detail: "a bad ± in the formula" });
    const value = formula.slice(at + CALL.length, comma).trim();
    const sigma = formula.slice(comma + 1, j - 1).trim();
    if (!value || !sigma || /pas/.test(value + sigma) || /,/.test(sigma)) throw new Refused({ error: "engine", detail: "a bad ± in the formula" });
    const name = `pasv${vars.length + 1}`;
    vars.push({ name, value, sigma });
    out += name;
    i = j;
  }
}

/** A slot as text, in the order typed: positive powers, then the ones below the ÷ ("km/h", "cm²"). */
export function slotText(slot: UnitSlot, table: FactorTable): string {
  const per = slot.per ?? slot.tokens.length;
  return unitProduct(slot.tokens.map((t, i) => [tokenSymbol(t, table), signed(t.power ?? "1", i >= per)] as const));
}

function tokenSymbol(t: UnitToken, table: FactorTable): string {
  return (t.prefix !== undefined ? table.prefixes.get(t.prefix)?.symbol ?? "" : "") + (table.units.get(t.unit)?.symbol ?? t.unit);
}

const signed = (power: string, below: boolean): string => (below ? negate(power) : power);

/** The end slot's part of a job. */
function endJob(req: UnitRequest, table: FactorTable): Pick<UnitJob, "end" | "endOffset" | "endLog" | "endUnit"> {
  if (!req.end) return {};
  const x = specialIn(req.end, table);
  const endUnit = slotText(req.end, table);
  if (!x) return { end: slotGiac(req.end, table), endUnit };
  if (!x.bare) throw refuseSpecial(x.id, x.u);
  return { ...specialEnd(x.id, x.u), endUnit };
}

/** One unit of a product of typed tokens: the same prefix and unit from different slots add their powers. */
interface Factor {
  token: UnitToken;
  power: bigint;
}

const RATIONAL = /^(\d+)(?:\/(\d+))?$/;

/** The units of some slots as one ShownUnit, or null: a fractional power, a unit with no exact factor or dimension, or
 *  nothing left. `accept` decides from the merged factors and whether the factor to SI is exactly 1. */
function shownOf(slots: readonly UnitSlot[], table: FactorTable, accept: (n: number, one: boolean, prefixed: number) => boolean): ShownUnit | null {
  const merged = new Map<string, Factor>();
  for (const slot of slots) {
    const per = slot.per ?? slot.tokens.length;
    for (const [i, t] of slot.tokens.entries()) {
      const p = signed(t.power ?? "1", i >= per);
      if (!/^-?\d+$/.test(p)) return null;
      const key = `${t.prefix ?? ""}:${t.unit}`;
      const f = merged.get(key) ?? { token: { ...(t.prefix !== undefined ? { prefix: t.prefix } : {}), unit: t.unit }, power: 0n };
      f.power += BigInt(p);
      merged.set(key, f);
    }
  }
  const factors = [...merged.values()].filter((f) => f.power !== 0n);
  if (!factors.length) return null;
  const exps = new Map<string, bigint>();
  let rat: { p: bigint; q: bigint } | null = { p: 1n, q: 1n };
  const giac: string[] = [];
  for (const f of factors) {
    const u = table.units.get(f.token.unit);
    const pfx = f.token.prefix !== undefined ? table.prefixes.get(f.token.prefix) : undefined;
    if (!u?.si || u.dim === undefined || u.si.includes("+") || (f.token.prefix !== undefined && !pfx)) return null;
    for (const [b, e] of parseDimKey(u.dim)) {
      if (!/^-?\d+$/.test(e)) return null;
      exps.set(b, (exps.get(b) ?? 0n) + BigInt(e) * f.power);
    }
    const sis = pfx ? [pfx.si, u.si] : [u.si];
    giac.push(`(${sis.map((x) => `(${x})`).join("*")})^(${f.power})`);
    const rs = sis.map((x) => RATIONAL.exec(x));
    if (rat && rs.every((m) => m)) {
      for (const m of rs) {
        const [a, b] = [BigInt(m![1]!), BigInt(m![2] ?? "1")];
        const [n, d] = f.power > 0n ? [a ** f.power, b ** f.power] : [b ** -f.power, a ** -f.power];
        rat = { p: rat.p * n, q: rat.q * d };
      }
    } else rat = null;
  }
  const one = rat !== null && rat.p === rat.q;
  if (!accept(factors.length, one, factors.filter((f) => f.token.prefix !== undefined).length)) return null;
  const dim = dimKeyOf(BASES.map((b) => `${exps.get(b.key) ?? 0n}`));
  const factor = rat ? (rat.q === 1n ? `${rat.p}` : `${rat.p}/${rat.q}`) : giac.join("*");
  const text = unitProduct(factors.map((f) => [tokenSymbol(f.token, table), `${f.power}`] as const));
  return { text, dim, factor };
}

/** The typed units a result without an end slot may be shown in, best first (G25): all slots together when they come
 *  to one unit, to a product with factor 1 (N·m), to a product with at most one prefixed token (kN·m, kW·h, lbf·ft; not kΩ·nF) or are the only slot; then each slot alone (a sum of km and km). */
function shownUnits(req: UnitRequest, table: FactorTable): ShownUnit[] {
  const out: ShownUnit[] = [];
  const all = shownOf(req.slots, table, (n, one, prefixed) => n === 1 || one || prefixed <= 1 || req.slots.length === 1);
  if (all) out.push(all);
  if (req.slots.length > 1) for (const s of req.slots) {
    const one = shownOf([s], table, () => true);
    if (one && !out.some((o) => o.text === one.text)) out.push(one);
  }
  return out;
}

const PLACEHOLDER = /\bpas([uk])(\d+)\b/g;

/** The UnitJob for a request, or why it is refused before Giac sees it. */
export function buildJob(req: UnitRequest, table: FactorTable): UnitJob | UnitError {
  try {
    // An absolute temperature or a logarithmic unit is allowed only alone, as the whole quantity.
    const sp = req.slots.map((s) => specialIn(s, table));
    const alone = sp.findIndex((x) => x !== null);
    if (alone >= 0) {
      const x = sp[alone]!;
      const lone = x.bare && req.slots.length === 1 && !req.consts?.length;
      // A single pasupm(value,sigma) is the lone number of °C and °F (G18f1): K = a·x + b gives σ = a·σx, the offset drops out.
      const uvars: UncVar[] = [];
      const withPm = lone && !isLog(x.id, x.u) && req.formula.includes("pasupm(");
      const symbolic = withPm ? uncertainValues(req.formula, uvars) : "";
      const pm = withPm && uvars.length === 1 && new RegExp(`^\\s*pasv1\\s*\\*\\s*pasu${alone + 1}\\s*$`).test(symbolic);
      const num = pm ? "pasv1" : lone && !withPm ? aloneNumber(req.formula, alone + 1) : null;
      if (num === null) throw refuseSpecial(x.id, x.u);
      // No end slot: °C, °F give K, dBm, dBW give W; a dB, bel or Np ratio has no SI unit (20 dB is not 10).
      if (isLog(x.id, x.u) && !req.end && x.id !== "dBm" && x.id !== "dBW") throw refuseSpecial(x.id, x.u);
      const abs = isAffine(x.u) ? { absTemp: true as const } : {};
      if (pm) {
        const v = uvars[0]!;
        return { expr: specialSource(x.id, x.u, `(${v.value})`), ...endJob(req, table), ...abs, inexact: true, unc: { expr: specialSource(x.id, x.u, "pasv1"), vars: uvars } };
      }
      return { expr: specialSource(x.id, x.u, num), ...endJob(req, table), ...abs, inexact: false };
    }
    const slots = req.slots.map((s) => slotGiac(s, table));
    const vars: UncVar[] = [];
    const formula = uncertainValues(req.formula, vars);
    const seen = new Map<string, string>();
    const consts = (req.consts ?? []).map((id) => constGiac(id, table, vars, seen));
    const used = new Set<string>();
    const sym = formula.replace(PLACEHOLDER, (all, kind: string, n: string) => {
      const k = Number(n) - 1;
      const out = kind === "u" ? slots[k] : consts[k]?.giac;
      if (out === undefined) throw new Refused({ error: "engine", detail: `${all} has no slot or constant` });
      used.add(all);
      return out;
    });
    if (used.size !== slots.length + consts.length) throw new Refused({ error: "engine", detail: "a slot or constant is not in the formula" });
    if (/\bpas/.test(sym.replace(/\bpas(?:dim[A-Za-z]+|v\d+)\b/g, ""))) throw new Refused({ error: "engine", detail: "a reserved name in the formula" });
    // The value of every uncertain input goes in; the worker differentiates the symbolic text for σ.
    const expr = vars.length ? sym.replace(/\bpasv(\d+)\b/g, (_, n: string) => `(${vars[Number(n) - 1]!.value})`) : sym;
    const shows = req.end ? [] : shownUnits(req, table);
    return {
      expr,
      ...endJob(req, table),
      ...(shows.length ? { shows } : {}),
      inexact: vars.length > 0 || consts.some((c) => c.inexact),
      ...(vars.length ? { unc: { expr: sym, vars } } : {}),
    };
  } catch (e) {
    if (e instanceof Refused) return e.why;
    throw e;
  }
}
