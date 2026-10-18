// SPDX-License-Identifier: GPL-3.0-or-later
// The builder of the unit view (P15, docs/04 4.2): a UnitRequest (the formula with a placeholder per slot and per
// constant, the slots as tokens) becomes a UnitJob, Giac text in which every unit is its exact SI factor from the
// Find index times the dimension symbols of dims.ts. Main thread, plain TS, no engine.
import { dimSymbols, isExponent } from "./dims.ts";
import type { FactorTable } from "./factors.ts";
import type { UnitError, UnitJob, UnitRequest, UnitSlot, UnitToken } from "./types.ts";

/** The logarithmic units (G17 writes their rules): any unit with the Np dimension, and these. */
const LOGARITHMIC: ReadonlySet<string> = new Set(["dB", "bel", "Np", "dBm", "dBW"]);

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

/** A constant as Giac text: its value times its dimension symbols (the worker makes the decimal exact). */
function constGiac(id: string, table: FactorTable): { giac: string; inexact: boolean } {
  const c = table.consts.get(id);
  if (!c) throw new Refused({ error: "engine", detail: `no constant ${id} in the index` });
  if (c.dim === undefined) throw new Refused({ error: "nofactor", unit: c.symbol });
  const dims = dimSymbols(c.dim);
  return { giac: `((${c.value})${dims ? `*${dims}` : ""})`, inexact: c.unc !== undefined };
}

const PLACEHOLDER = /\bpas([uk])(\d+)\b/g;

/** The UnitJob for a request, or why it is refused before Giac sees it. */
export function buildJob(req: UnitRequest, table: FactorTable): UnitJob | UnitError {
  try {
    const slots = req.slots.map((s) => slotGiac(s, table));
    const consts = (req.consts ?? []).map((id) => constGiac(id, table));
    const used = new Set<string>();
    const expr = req.formula.replace(PLACEHOLDER, (all, kind: string, n: string) => {
      const k = Number(n) - 1;
      const out = kind === "u" ? slots[k] : consts[k]?.giac;
      if (out === undefined) throw new Refused({ error: "engine", detail: `${all} has no slot or constant` });
      used.add(all);
      return out;
    });
    if (used.size !== slots.length + consts.length) throw new Refused({ error: "engine", detail: "a slot or constant is not in the formula" });
    if (/\bpas/.test(expr.replace(/\bpasdim[A-Za-z]+\b/g, ""))) throw new Refused({ error: "engine", detail: "a reserved name in the formula" });
    return {
      expr,
      ...(req.end ? { end: slotGiac(req.end, table) } : {}),
      inexact: consts.some((c) => c.inexact),
    };
  } catch (e) {
    if (e instanceof Refused) return e.why;
    throw e;
  }
}
