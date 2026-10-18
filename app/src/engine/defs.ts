// SPDX-License-Identifier: GPL-3.0-or-later
// The definitions log (docs/04 section 6.2): what the user defined, kept outside the engine so that a fresh one (after
// Cancel, a crash or a relaunch) gets the same state. Plain data and pure functions, used on both sides: the engine
// host (host.ts) builds the entries, WorkerEngine keeps the log and stores it. Only erasable TypeScript syntax.
//
// One entry per name, the last definition kept (at most MAX_DEFS). A variable is kept as its VALUE, not as the command
// that defined it: `B:=A*2` replayed after `A:=5` would give B a different value than it had (the log keeps one entry
// per name, so the order of the commands is gone). Functions are kept as their definition (the body is not evaluated
// when it is defined, so order does not matter). Inputs whose effect has no single name are kept as typed, in order.
import type { PrecisionWarn } from "./format.ts";

/** How far a variable that holds a float can be trusted (decisions M4-7): the facts of the result it was stored from. */
export interface NameFacts {
  /** Significant digits confirmed when it was stored; null: not limited (only `warn` applies). */
  reliableDigits: number | null;
  warn?: PrecisionWarn;
}

/** var: a value (`A:=…`, `…▶A`, `L[2]:=…`); fn: `f(x):=…`; assume: `assume`/`additionally` on a name; other: a
 *  stateful input with no single name (`a,b:=1,2`, `(A:=5)+1`), replayed as typed. */
export type DefKind = "var" | "fn" | "assume" | "other";

export interface DefEntry {
  /** The defined name; "" for kind "other". */
  name: string;
  kind: DefKind;
  /** Giac commands that recreate it in a fresh engine. */
  cmds: string[];
  /** A variable holding a float: its mark facts (M4-7). Absent for exact values. */
  facts?: NameFacts;
  /** The value as shown when it was defined (Vars and Find previews, docs/04 3.4). */
  preview: string;
  view: "home" | "cas";
  /** When it was defined (ms since 1970). */
  time: number;
  /** Replay before every other entry: a symbolic value (names in it must still be unassigned when it is set again). */
  early?: boolean;
  /** One line saying what it is (a library's comment above the definition, G33), at most DESC_MAX characters. */
  desc?: string;
}

export type DefChange = { set: DefEntry } | { purge: string[] };

/** The log's size limit (docs/04 section 6.2): the oldest entries go first. */
export const MAX_DEFS = 500;
/** Longest preview kept. */
export const PREVIEW_MAX = 200;
/** Longest description kept. */
export const DESC_MAX = 120;

/** Entries with the same key replace each other: the name, or the command itself for kind "other". */
export function keyOf(e: DefEntry): string {
  return e.kind === "other" ? `#${e.cmds.join("\n")}` : e.name;
}

/** The log after `changes`: a new definition of a name replaces the old one and moves to the end; purge drops it. */
export function applyDefChanges(log: readonly DefEntry[], changes: readonly DefChange[]): DefEntry[] {
  let out = [...log];
  for (const c of changes) {
    if ("purge" in c) {
      const names = new Set(c.purge);
      out = out.filter((e) => e.kind === "other" || !names.has(e.name));
    } else {
      const k = keyOf(c.set);
      out = out.filter((e) => keyOf(e) !== k);
      out.push(c.set);
    }
  }
  return out.length > MAX_DEFS ? out.slice(out.length - MAX_DEFS) : out;
}

/** The commands to replay, in order: symbolic values first (while every name in them is still free), then the rest. */
export function replayOrder(log: readonly DefEntry[]): DefEntry[] {
  return [...log.filter((e) => e.early), ...log.filter((e) => !e.early)];
}

const KINDS: readonly DefKind[] = ["var", "fn", "assume", "other"];

function validFacts(x: unknown): NameFacts | undefined | null {
  if (x === undefined) return undefined;
  if (!x || typeof x !== "object") return null;
  const f = x as Record<string, unknown>;
  const d = f["reliableDigits"];
  if (!(d === null || (typeof d === "number" && Number.isFinite(d)))) return null;
  const w = f["warn"];
  if (w !== undefined && w !== "unaudited" && w !== "unchecked") return null;
  return { reliableDigits: d, ...(w ? { warn: w } : {}) };
}

/** Stored entries read back (IndexedDB): the ones with the right shape, at most MAX_DEFS. */
export function validDefs(x: unknown): DefEntry[] {
  if (!Array.isArray(x)) return [];
  const out: DefEntry[] = [];
  for (const it of x) {
    if (!it || typeof it !== "object") continue;
    const e = it as Record<string, unknown>;
    const cmds = e["cmds"];
    const kind = e["kind"];
    const facts = validFacts(e["facts"]);
    if (typeof e["name"] !== "string" || !KINDS.includes(kind as DefKind) || facts === null) continue;
    if (!Array.isArray(cmds) || cmds.length === 0 || !cmds.every((c) => typeof c === "string")) continue;
    if (kind !== "other" && !/^[A-Za-z][A-Za-z0-9_]*$/.test(e["name"])) continue;
    out.push({
      name: e["name"],
      kind: kind as DefKind,
      cmds: cmds as string[],
      ...(facts ? { facts } : {}),
      preview: typeof e["preview"] === "string" ? e["preview"].slice(0, PREVIEW_MAX) : "",
      view: e["view"] === "cas" ? "cas" : "home",
      time: typeof e["time"] === "number" && Number.isFinite(e["time"]) ? e["time"] : 0,
      ...(e["early"] === true ? { early: true } : {}),
      ...(typeof e["desc"] === "string" && e["desc"] ? { desc: e["desc"].slice(0, DESC_MAX) } : {}),
    });
  }
  return out.slice(-MAX_DEFS);
}

/** A user's name as Vars and Find list it (docs/04 section 3.4). */
export interface UserName {
  name: string;
  kind: "var" | "fn";
  preview: string;
  view: "home" | "cas";
  time: number;
  facts?: NameFacts;
  desc?: string;
}

export function userNamesOf(log: readonly DefEntry[]): UserName[] {
  const out: UserName[] = [];
  for (const e of log) {
    if (e.kind !== "var" && e.kind !== "fn") continue;
    out.push({ name: e.name, kind: e.kind, preview: e.preview, view: e.view, time: e.time, ...(e.facts ? { facts: e.facts } : {}), ...(e.desc ? { desc: e.desc } : {}) });
  }
  return out;
}
