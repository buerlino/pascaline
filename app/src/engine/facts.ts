// SPDX-License-Identifier: GPL-3.0-or-later
// The mark facts that stored names lend (decisions M4-7; G48, G49, G51; G65): which names a result read comes from
// Giac's parse of the input and the host's table of Giac's stored names (stateRead.ts); the facts of each name are
// the log's (defs.ts). Functions that take the host (cleanup 2026-10-20, item 13). Only erasable TypeScript syntax, so
// Node runs this file directly.
import type { HomeResult } from "./homeEval.ts";
import { resultFromFacts } from "./homeEval.ts";
import { perturbedDigits, valuePrecision, type ElementFacts, type Giac, type Shape } from "./numeric.ts";
import type { DefEntry, NameFacts } from "./defs.ts";
import type { InputReads, StoredName } from "./stateRead.ts";
import { callsOf, isName } from "./giacPrint.ts";

/** What the facts functions read from the engine host. */
export interface FactsHost {
  readonly giac: Giac;
  /** The definitions log by name: each name's facts. */
  readonly byName: ReadonlyMap<string, DefEntry>;
  /** G49: the chips the current Home input holds by name (`pasr_<k>`), with the facts they lend. */
  readonly chipFacts: ReadonlyMap<string, NameFacts>;
  /** G65: Giac's stored user names (stateRead.ts tableOf). */
  readonly stored: ReadonlyMap<string, StoredName>;
}


/** Facts that together cap a value: the fewest confirmed digits, the strongest warn, never exact (G49f1). Null when
 *  `all` is empty. */
export function mergedFacts(all: readonly NameFacts[]): NameFacts | null {
  if (!all.length) return null;
  const capped = all.filter((f) => f.reliableDigits !== null).map((f) => f.reliableDigits!);
  const warn = all.some((f) => f.warn === "unaudited") ? "unaudited" : all.some((f) => f.warn === "unchecked") ? "unchecked" : undefined;
  return { exact: false, reliableDigits: capped.length ? Math.min(...capped) : null, ...(warn ? { warn } : {}), inexact: true };
}

/** The facts a stored variable keeps (M4-7, G49): a float's as they are (its value shows it is not exact), a value that
 *  prints exactly only when they say it is not exact. */
export function storedFacts(facts: NameFacts | null, float: boolean): { facts?: NameFacts } {
  if (!facts) return {};
  if (!float) return facts.inexact ? { facts } : {};
  const { inexact: _, ...rest } = facts;
  return { facts: rest };
}

/**
 * The facts a read of `name` lends: a chip's; a stored name's own (the log's, fixed when it was stored) merged with
 * those of the names its value holds now, followed through the table (a program's body, a symbolic value's names:
 * S:=y+pA0 lends pA0's facts once pA0 is set). `seen` ends the walk. Null when nothing on the way has facts.
 */
export function nameFacts(host: FactsHost, name: string, seen: Set<string>): NameFacts | null {
  if (seen.has(name)) return null;
  seen.add(name);
  const chip = host.chipFacts.get(name);
  if (chip) return chip;
  const s = host.stored.get(name);
  if (!s) return null;
  const own = host.byName.get(name)?.facts;
  const inner = s.names.flatMap((n) => {
    const f = nameFacts(host, n, seen);
    return f ? [f] : [];
  });
  return inner.length ? mergedFacts([...(own ? [own] : []), ...inner]) : (own ?? null);
}

/** One name an input read that lends facts. `own`: a variable's or chip's own facts (it may be moved by the
 *  perturbation check); a program is never moved. */
interface Used {
  name: string;
  facts: NameFacts;
  own: NameFacts | undefined;
}

function usedBy(host: FactsHost, reads: InputReads): Used[] {
  return reads.names.flatMap((name): Used[] => {
    const chip = host.chipFacts.get(name);
    if (chip) return [{ name, facts: chip, own: chip }];
    const s = host.stored.get(name);
    const facts = s ? nameFacts(host, name, new Set()) : null;
    return s && facts ? [{ name, facts, own: s.fn ? undefined : host.byName.get(name)?.facts }] : [];
  });
}

/** The merged facts of the names an input read, and the names that lent them. */
export function readsFacts(host: FactsHost, reads: InputReads): { facts: NameFacts | null; names: string[] } {
  const used = usedBy(host, reads);
  return { facts: mergedFacts(used.map((u) => u.facts)), names: used.map((u) => u.name) };
}

/**
 * G51: the facts a CAS result without a float takes from what its input read, and the names behind a warn (for
 * why.inherited). Null when nothing it read is inexact, and for inputs that store no value (a function definition,
 * purge, assume): those read names without showing a value from them.
 */
export function readFacts(host: FactsHost, input: string, reads: InputReads): { facts: NameFacts; causes: string[] } | null {
  if (reads.fn || callsOf(input.trimStart(), ["purge", "assume", "additionally"])[0]?.at === 0) return null;
  const used = usedBy(host, reads);
  const facts = mergedFacts(used.map((u) => u.facts));
  if (!facts) return null;
  return { facts, causes: used.filter((u) => u.facts.warn !== undefined).map((u) => u.name) };
}

/** G49f1: the facts a function keeps: those of the inexact chips and constants its definition held (`lent`, put in as
 *  values) and of the names its body reads. Null when nothing in it is inexact. */
export function fnFacts(lent: readonly NameFacts[], read: NameFacts | null): NameFacts | null {
  return mergedFacts([...lent, ...(read ? [read] : [])]);
}

/** G48 (rule 2): the facts a stored name takes: those of its value (`own`) merged with the weakest facts of the names
 *  and chips (`lent`) its input read, whatever the value prints as. */
export function storeFacts(own: NameFacts | null, lent: readonly NameFacts[], read: NameFacts | null): NameFacts | null {
  const all = [...lent, ...(read ? [read] : [])];
  return all.length ? mergedFacts([...(own ? [own] : []), ...all]) : own;
}

/** The shape of a numeric result (scalar, list, matrix), from its fields. */
function shapeOfResult(r: HomeResult): Shape {
  if (!r.items) return { kind: "scalar" };
  return r.shape ? { kind: "matrix", rows: r.shape[0], cols: r.shape[1] } : { kind: "list", n: r.items.length };
}

/**
 * Decisions M4-7: a numeric result computed from stored names with facts (floats, inexact values, G49), or from chips
 * named in the input (G49), inherits their facts. Its confirmed digits are at most theirs, its warn is theirs, and it
 * is never exact; when the input can be run again (`expr`, decimals exact) and is more than the bare name, it is
 * checked once more with each variable moved in its last confirmed digit, which catches a cancellation (B-0.7468 with
 * B known to 13 digits). A program is never moved.
 */
export function inherited(host: FactsHost, r: HomeResult, reads: InputReads, expr: string | null, digits: number, restoreDigits: number): HomeResult {
  if (!r.ok || (!r.value && !r.items)) return r;
  const used = usedBy(host, reads);
  if (!used.length) return r;
  const P = valuePrecision(digits);
  const els = r.items ?? [r];
  const cap = used.reduce((n, u) => (u.facts.reliableDigits === null ? n : Math.min(n, u.facts.reliableDigits)), P);
  const warn = used.some((u) => u.facts.warn === "unaudited") ? "unaudited" : used.some((u) => u.facts.warn === "unchecked") ? "unchecked" : undefined;
  const moved = used.filter((u) => u.own !== undefined && u.own.reliableDigits !== null).map((u) => ({ name: u.name, n: u.own!.reliableDigits! }));
  const shape = shapeOfResult(r);
  let pert: number[] | null | undefined;
  let once = false;
  if (expr !== null && moved.length && !isName(expr.trim(), true)) {
    pert = perturbedDigits(host.giac, expr, shape, els.map((e) => e.value!), moved, digits, restoreDigits);
  }
  const facts: ElementFacts[] = els.map((e, k) => {
    let n = Math.min(e.facts.reliableDigits ?? P, cap);
    if (pert) n = Math.min(n, pert[k]!);
    const w = warn ?? e.facts.warn ?? (pert === null ? "unchecked" : undefined);
    if (pert === null && !warn && !e.facts.warn) once = true;
    return { value: e.value!, exact: false, reliableDigits: n, ...(w ? { warn: w } : {}), big: false };
  });
  const b = resultFromFacts(facts, shape, digits, r.path, true, r.totalMs);
  // Only the names behind a ⚠: one with a warning, or one known to fewer digits than the setting shows.
  const lost = pert ? pert.some((d) => d < digits) : false;
  const causes = used
    .filter((u) => u.facts.warn !== undefined || (u.facts.reliableDigits !== null && (u.facts.reliableDigits < digits || lost)))
    .map((u) => u.name);
  const why = { ...(r.facts.why ?? {}), ...(causes.length ? { inherited: causes } : {}), ...(once ? { once: true as const } : {}) };
  return {
    ...b,
    ...(Object.keys(why).length ? { facts: { ...b.facts, why } } : {}),
    ...(r.exact !== undefined ? { exact: r.exact } : {}),
    ...(r.rational ? { rational: r.rational } : {}),
    ...(r.defined ? { defined: r.defined } : {}),
    ...(r.digits !== undefined ? { digits: r.digits } : {}),
    exactMs: r.exactMs,
  };
}
