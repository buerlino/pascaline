// SPDX-License-Identifier: GPL-3.0-or-later
// The library file (S4, decisions.md "S4", docs/archive/r10-connector.md): a UTF-8 text file of Giac definitions, each
// with a one-line description and optional `// test:` lines. Read and checked as a whole, refused as a whole, defined
// through the engine's cas() as if typed (so the defs log gets its entries from the one existing path), then tested.
// Loaded lazily by whoever imports (dynamic import); nothing in the start chunk imports it. The engine is reached through
// the small LibraryEngine interface, so this file runs in the Worker, in Node and in tests alike. Only erasable syntax.
import { applyDefChanges, DESC_MAX, MAX_DEFS, replayOrder, type DefChange, type DefEntry } from "./defs.ts";
import { ENGINE_DEFINITIONS, WORKER_DEFINITION_NAMES } from "./homeEval.ts";
import type { GiacParse } from "./bridge.ts";
import { assignmentIn, bodyStores } from "./stores.ts";
import { COMPLEX_DEFINITIONS } from "./numeric.ts";
import { defaultCasSettings, type CasResult } from "./types.ts";
import { DATA_VERSION, migratedText } from "../state/storage.ts";
import { renameOurCalls, writeUserNames } from "./ourNames.ts";
import { dropAngleFactor, PASDEG, rewriteAngles } from "../input/angles.ts";
import { isFlagName } from "./flags.ts";

/** r10 section 1.2: the limits of one file. */
export const LIB_MAX_BYTES = 256 * 1024;
export const LIB_MAX_DEFS = 200;
const HEADER = /^\/\/ pascaline library (\d+)$/;
const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
export interface LibTest {
  expr: string;
  /** 1-based line in the file. */
  line: number;
}
export interface LibDef {
  name: string;
  kind: "fn" | "var";
  /** The definition as written (several lines for a program). */
  text: string;
  /** A value's right side as written (`name:=<value>`), for comparing it with the log's entry. */
  value?: string;
  desc: string;
  tests: LibTest[];
  line: number;
}
export interface LibFile {
  /** The version in the stamp line (already accepted: at most DATA_VERSION). */
  version: number;
  defs: LibDef[];
}

/** A refusal: the first problem in the file, with its line (0: the file as a whole) and plain words. */
export class LibError extends Error {
  line: number;
  constructor(line: number, msg: string) {
    super(line ? `line ${line}: ${msg}` : msg);
    this.name = "LibError";
    this.line = line;
  }
}

/** Top-level ";" (outside brackets, braces and strings) with something after it: a second statement. */
function topLevelSemicolon(s: string): boolean {
  let depth = 0;
  let str = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '"') str = !str;
    else if (str) continue;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === ";" && depth === 0 && s.slice(i + 1).trim() !== "") return true;
  }
  return false;
}

const NOSTR = (s: string): string => s.replace(/"[^"]*"/g, '""');

function balanced(s: string): boolean {
  let d = 0;
  for (const c of s.replace(/"[^"]*"/g, "")) d += "([{".includes(c) ? 1 : ")]}".includes(c) ? -1 : 0;
  return d <= 0;
}

/** G100: what a definition or a test changes when it runs, from Giac's tree (bridge-2): the first head of the state
 *  family (purge, assume, a setting, a file reader, a string Giac evaluates; stores.ts) or a setting it reads, and the first global target (a
 *  name stored that is neither the defined name, a parameter nor a local). */
function changes(tree: GiacParse, own: readonly string[]): { head?: string; target?: string } {
  const b = bodyStores(tree, own);
  // a setting read is refused too (G67: a library may not use one, flags.ts)
  const head = b.heads[0] ?? tree.reads.find(isFlagName);
  return { ...(head !== undefined ? { head } : {}), ...(b.targets[0] !== undefined ? { target: b.targets[0] } : {}) };
}

/** A tree Giac's parser could not read cleanly holds `undef` where it gave up (`++a` is `undef++; a`): no name of the
 *  user's, so no target. */
function readable(tree: GiacParse): GiacParse {
  return tree.ok ? tree : { ...tree, targets: tree.targets.filter((t) => t !== "undef") };
}

/** A block that defines one name: Giac's tree is one top-level store into it, written `name(args):=…` (a function) or
 *  `name:=…` (a value, a function written with an arrow too). */
function definitionOf(block: string, tree: GiacParse): { name: string; kind: "fn" | "var" } | undefined {
  if (tree.heads[0] !== "sto") return undefined;
  // `Beta(x):=…` names a built-in: Giac's tree has no target (the call is no name), the import refuses the name
  const call = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*\(/.exec(block)?.[1];
  if (tree.top.length === 0 && call !== undefined && tree.heads.includes(call)) return { name: call, kind: "fn" };
  if (tree.top.length !== 1) return undefined;
  const name = tree.top[0]!;
  if (tree.program && call === name) return { name, kind: "fn" };
  return assignmentIn(block, tree) ? { name, kind: "var" } : undefined;
}

/** Reads a library file: encoding, size, stamp, blocks, every rule that needs no evaluation (r10 section 1.3). Throws a
 *  LibError for the first problem. A string is taken as the text of a file already decoded. `parse`: Giac's tree of a
 *  text (bridge-2, never evaluated), which says what a body or a test stores (G100). */
export function parseLibrary(input: Uint8Array | string, parse: (text: string) => GiacParse): LibFile {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  if (bytes.length > LIB_MAX_BYTES) throw new LibError(0, `the file is over ${LIB_MAX_BYTES / 1024} kB`);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new LibError(0, "the file is not UTF-8 text");
  }
  const lines = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  const h = HEADER.exec(lines[0]!.trim());
  if (!h) throw new LibError(1, `the first line must be \`// pascaline library ${DATA_VERSION}\``);
  const version = Number(h[1]);
  if (version > DATA_VERSION) throw new LibError(1, `made by a newer Pascaline (version ${version}; this one reads up to ${DATA_VERSION})`);
  // The same migration steps as the stored defs (storage.ts), on the text below the stamp.
  const body = migratedText("library", lines.slice(1).join("\n"), version);
  const rest = body.split("\n");
  const defs: LibDef[] = [];
  let lastComment: { text: string; line: number } | null = null;
  for (let i = 0; i < rest.length; i++) {
    const lineNo = i + 2; // rest[0] is file line 2
    const raw = rest[i]!;
    const t = raw.trim();
    if (t === "") {
      lastComment = null;
      continue;
    }
    if (t.startsWith("//")) {
      const test = /^\/\/\s*test:\s*(.+)$/.exec(t);
      if (test) {
        const d = defs[defs.length - 1];
        if (!d) throw new LibError(lineNo, "a test line before any definition");
        const expr = test[1]!.trim();
        const tree = readable(parse(asGiac(expr)));
        const c = changes(tree, []);
        if (c.head) throw new LibError(lineNo, `the test changes the engine's state (${c.head})`);
        if (c.target) throw new LibError(lineNo, `a test must not assign a name (it assigns ${c.target})`);
        if (!tree.ok) throw new LibError(lineNo, "Giac cannot read the test (a syntax error)");
        if (topLevelSemicolon(expr)) throw new LibError(lineNo, "one expression per test: a second statement follows `;`");
        d.tests.push({ expr, line: lineNo });
      } else lastComment = { text: t.replace(/^\/\/\s*/, ""), line: lineNo };
      continue;
    }
    if (/^\s/.test(raw)) throw new LibError(lineNo, "an indented line outside a definition");
    // A definition: this line, plus the following ones while a bracket is open or the line is indented / a closing bracket.
    const start = i;
    let block = raw;
    while (i + 1 < rest.length && (!balanced(block) || /^(\s+\S|[}\]\)])/.test(rest[i + 1]!))) block += "\n" + rest[++i];
    const at = start + 2;
    if (!balanced(block)) throw new LibError(at, "a bracket is never closed");
    if (topLevelSemicolon(block)) throw new LibError(at, "one definition per block: a second statement follows `;`");
    const tree = readable(parse(asGiac(block)));
    const def = definitionOf(block, tree);
    // what a body Giac cannot read stores is still checked on the part it read (a global target is the plainer reason)
    if (!def && !tree.ok) {
      const c = changes(tree, tree.top);
      if (c.head) throw new LibError(at, `the body changes the engine's state (${c.head})`);
      if (c.target) throw new LibError(at, `the body assigns ${c.target}, which is not local: declare it with \`local ${c.target};\``);
      throw new LibError(at, "Giac cannot read this definition (a syntax error)");
    }
    if (!def) throw new LibError(at, "only definitions may stand in a library (`name(args):=…` or `name:=…`)");
    const c = changes(tree, [def.name]);
    if (c.head) throw new LibError(at, `the body changes the engine's state (${c.head})`);
    if (c.target && tree.program) throw new LibError(at, `the body assigns ${c.target}, which is not local: declare it with \`local ${c.target};\``);
    if (c.target) throw new LibError(at, `the value assigns ${c.target}, which is not local: a value must not itself define or change anything`);
    if (!tree.ok) throw new LibError(at, "Giac cannot read this definition (a syntax error)");
    const value = def.kind === "var" ? assignmentIn(block, tree)?.rhs : undefined;
    if (!NAME.test(def.name)) throw new LibError(at, "a name is letters, digits and _ (ASCII), starting with a letter");
    if (isFlagName(def.name)) throw new LibError(at, `${def.name} is one of the engine's settings, which a library may not change`);
    if (def.name in ENGINE_DEFINITIONS || def.name in COMPLEX_DEFINITIONS || WORKER_DEFINITION_NAMES.includes(def.name) || def.name.startsWith("pasc_") || def.name === PASDEG || def.name.endsWith("_")) throw new LibError(at, `${def.name} is one of Pascaline's own names`);
    // R64: the degree factor is ours; a body that names it (a `local pasdeg`, say) would change every angle in it
    if (new RegExp(`(?<![A-Za-z0-9_])${PASDEG}(?![A-Za-z0-9_])`).test(NOSTR(block))) throw new LibError(at, `${PASDEG} is one of Pascaline's own names`);
    if (defs.some((d) => d.name === def.name)) throw new LibError(at, `${def.name} is defined twice in this file`);
    if (!lastComment || lastComment.line !== at - 1) throw new LibError(at, `${def.name} needs its one-line description on the line above`);
    if (lastComment.text.length > DESC_MAX) throw new LibError(lastComment.line, `the description is over ${DESC_MAX} characters`);
    defs.push({ name: def.name, kind: def.kind, text: block, ...(value !== undefined ? { value } : {}), desc: lastComment.text, tests: [], line: at });
    lastComment = null;
  }
  if (defs.length > LIB_MAX_DEFS) throw new LibError(0, `more than ${LIB_MAX_DEFS} definitions`);
  return { version, defs };
}

/** What the import needs of an engine: EngineHost has both (in the Worker, cas() and eval() answer synchronously). */
export interface LibraryEngine {
  cas(input: string, s: typeof defaultCasSettings): { result: Pick<CasResult, "ok" | "error">; defs: DefChange[] };
  eval(input: string): { output: string; ok: boolean };
}

/** Names the file would add, leave as they are (same commands) or replace (different commands, the user's own). */
export interface ImportPlan {
  added: string[];
  same: string[];
  replaced: string[];
}

export interface TestFailure {
  line: number;
  expr: string;
  /** What the expression gave. */
  got: string;
}

export type ImportResult =
  | {
      ok: true;
      plan: ImportPlan;
      /** The changes for the defs log (descriptions included); the caller applies and stores them. */
      changes: DefChange[];
      /** The log after the changes. */
      log: DefEntry[];
      tests: number;
      ms: number;
    }
  | {
      ok: false;
      /** First reason, in plain words (with its line where there is one). */
      error: string;
      line: number;
      plan?: ImportPlan;
      /** Own names the file would replace; set when that is the (only) reason: nothing was defined. Import again with
       *  `replace: true` once the user has seen the list. */
      clashes?: string[];
      failures?: TestFailure[];
      /** The engine was changed before the problem showed: the caller restarts it from the unchanged log
       *  (WorkerEngine.cancel path) and does not store anything. */
      dirty: boolean;
    };

function fail(error: string, line: number, extra: Partial<Extract<ImportResult, { ok: false }>> = {}): ImportResult {
  return { ok: false, error, line, dirty: false, ...extra };
}

/** G54, G46: library text is the user's, in radians: our names for Giac's functions (ourNames.ts) and the degree factor
 *  go in before Giac sees it, as the parser does for typed input. */
export function asGiac(text: string): string {
  return rewriteAngles(renameOurCalls(text));
}

/** One `// pascaline library` import into an engine that holds `log`. Checks the rest against the engine (built-in
 *  names, own names, the log's size), defines every definition through cas(), runs the tests, and returns the changes. */
export function importLibrary(engine: LibraryEngine, lib: LibFile, log: readonly DefEntry[], opts: { replace?: boolean } = {}): ImportResult {
  const t0 = performance.now();
  const byName = new Map(log.filter((e) => e.kind !== "other").map((e) => [e.name, e]));
  const plan: ImportPlan = { added: [], same: [], replaced: [] };
  for (const d of lib.defs) {
    const old = byName.get(d.name);
    if (old) {
      if (sameDefinition(engine, d, old)) plan.same.push(d.name);
      else plan.replaced.push(d.name);
    } else {
      if (engine.eval(`type(${d.name})`).output.trim() === "func") return fail(`line ${d.line}: ${d.name} is a built-in function`, d.line, { plan });
      plan.added.push(d.name);
    }
  }
  if (log.length + plan.added.length > MAX_DEFS) {
    return fail(`the definitions would pass ${MAX_DEFS} (now ${log.length}, new ${plan.added.length}); the oldest would be dropped`, 0, { plan });
  }
  if (plan.replaced.length && !opts.replace) {
    return fail(`${plan.replaced.length} of your own names would be replaced: ${plan.replaced.join(", ")}`, 0, { plan, clashes: plan.replaced });
  }
  let out = [...log];
  const changes: DefChange[] = [];
  for (const d of lib.defs) {
    const old = byName.get(d.name);
    let mine: DefChange[];
    if (plan.same.includes(d.name)) {
      // Unchanged commands; only a changed description is news.
      if (!old || old.desc === d.desc) continue;
      mine = [{ set: { ...old, desc: d.desc } }];
    } else {
      // G46: a library file is Giac text in radians, written without our degree factor; it goes in here, so a body's
      // sin(x) follows the mode at call time as a typed one does (S14 R14 section 5)
      const r = engine.cas(asGiac(d.text), defaultCasSettings);
      if (!r.result.ok) return fail(`line ${d.line}: ${d.name}: ${r.result.error ?? "the engine refused it"}`, d.line, { plan, dirty: true });
      mine = r.defs.map((c) => ("set" in c && c.set.name === d.name ? { set: { ...c.set, desc: d.desc } } : c));
    }
    changes.push(...mine);
    out = applyDefChanges(out, mine);
  }
  const failures: TestFailure[] = [];
  let tests = 0;
  // G46: a test runs in radians whatever the user's mode, with the factor put in as for a definition.
  inRadians(engine, () => {
    for (const d of lib.defs) {
      for (const t of d.tests) {
        tests++;
        const v = engine.eval(asGiac(t.expr));
        const got = v.output.trim();
        if (!v.ok || (got !== "true" && got !== "1")) failures.push({ line: t.line, expr: t.expr, got });
      }
    }
  });
  if (failures.length) {
    const f = failures[0]!;
    const more = failures.length > 1 ? ` (and ${failures.length - 1} more)` : "";
    return fail(`line ${f.line}: test failed: ${f.expr} gave ${f.got}${more}`, f.line, { plan, failures, dirty: true });
  }
  return { ok: true, plan, changes, log: out, tests, ms: performance.now() - t0 };
}

/** `fn` with our degree factor at 1 (Giac always runs in radians, G46), and the mode's factor put back afterwards: the
 *  engine's mode setup does not run again for the same settings. */
function inRadians<T>(engine: LibraryEngine, fn: () => T): T {
  const before = engine.eval(PASDEG).output.trim();
  engine.eval(`${PASDEG}:=1`);
  try {
    return fn();
  } finally {
    engine.eval(`${PASDEG}:=${before === PASDEG || before === "" || /GIAC_ERROR/.test(before) ? "1" : before}`);
  }
}

/** A library value or function that is the same as the log's entry: the same commands (a function), or a value that
 *  evaluates to what the log holds (the log keeps `B:=(10)`, not `B:=A*2`). */
function sameDefinition(engine: LibraryEngine, d: LibDef, old: DefEntry): boolean {
  if (old.cmds.join("\n") === d.text || old.cmds.join("\n") === asGiac(d.text)) return true;
  if (d.kind !== "var" || old.kind !== "var" || d.value === undefined) return false;
  const rhs = d.value;
  // a value in a file is in radians (G46): read with the factor 1, as the import's cas() in RAD reads it
  const v = inRadians(engine, () => engine.eval(asGiac(rhs)));
  return v.ok && !/\bundef\b/.test(v.output) && old.cmds.length === 1 && old.cmds[0] === `${d.name}:=(${v.output.trim()})`;
}

/** A function typed on the phone has no description: its name and arguments stand for it. */
function describe(e: DefEntry): string {
  const text = e.desc ?? (e.kind === "fn" ? (/^\s*([A-Za-z][A-Za-z0-9_]*\s*\([^()]*\))/.exec(e.cmds[0]!)?.[1] ?? e.name) : e.preview ? `${e.name} = ${e.preview}` : e.name);
  return text.replace(/\s+/g, " ").trim().slice(0, DESC_MAX) || e.name;
}

/** The log's functions and exact values as a library file (the same text `parseLibrary` reads). Left out, with the
 *  reason: assumptions and inputs kept as typed (no single name), and values that hold a float (their mark facts have no
 *  place in a library; the backup carries them). Tests are not kept on the phone. */
export function exportLibrary(log: readonly DefEntry[]): { text: string; skipped: { name: string; why: string }[] } {
  const out = [`// pascaline library ${DATA_VERSION}`];
  const skipped: { name: string; why: string }[] = [];
  for (const e of replayOrder(log)) {
    if (e.kind === "assume" || e.kind === "other") {
      if (e.kind === "assume") skipped.push({ name: e.name, why: "an assumption, not a definition" });
      continue;
    }
    if (e.facts) {
      skipped.push({ name: e.name, why: "a decimal value with its mark facts, in the backup only" });
      continue;
    }
    // G46: the file is in radians, as typed: a body is written without our degree factor (the import puts it in)
    out.push("", `// ${describe(e)}`, e.cmds.map((c) => writeUserNames(dropAngleFactor(c))).join("\n"));
  }
  return { text: out.join("\n") + "\n", skipped };
}
