// SPDX-License-Identifier: GPL-3.0-or-later
// The engine side of the protocol: one Giac instance, synchronous calls. Runs inside the Web
// Worker (giac.worker.ts) and, for tests and the golden runner, directly in Node. Knows nothing
// about the UI. Only erasable TypeScript syntax, so Node runs this file directly.
import type { GiacBridge, GiacParse, GiacValue } from "./bridge.ts";
import type { Request, Response } from "./protocol.ts";
import type { AnalysisRequest, AnalysisResult, CasResult, CasSettings, HomeResult, HomeSettings, SolveOutcome, SolveRequest, TableRequest } from "./types.ts";
import {
  definitionsUsedBy,
  ENGINE_DEFINITIONS,
  WORKER_DEFINITION_NAMES,
  decideFloatTest,
  EQ_DIFF,
  EQ_INEXACT_FLAG,
  EQ_VERDICT,
  floatsAsEvalf,
  homeEval,
  homeSetupCommands,
  angleCommand,
  latexShown,
  onceUndecided,
  regrouped,
  resultFromFacts,
  safePrecision,
  symbolicWhy,
  testSides,
  toExactLiterals,
  unquote,
} from "./homeEval.ts";
import { eseriesDefinition } from "./eseries.ts";
import { askedLiterals } from "./asked.ts";
import { backInDegrees, needsDegrees } from "./degrees.ts";
import { resolveAngle } from "./angleMigration.ts";
import { mayPowerMatrix, nonSquarePower, type Bodies, type KnownBody } from "./nonsquare.ts";
import { mayAddToList, unaskedPoly } from "./polyvec.ts";
import { callsIn, floatBounds, giacPair, hasDefiniteIntegral, integratedNumerically, refusalOf } from "./converge.ts";
import { enEngine } from "../i18n/enEngine.ts";
import { dropAngleFactor } from "../input/angles.ts";
import { askedDigits, DOUBLE_DIGITS, doubleFormsIn, notBuiltin, floatsShown, unauditedIn, floatFacts, hasFloat, integratedFacts, numberLatex, shapeOfValue, valuePrecision, whyOf, withDigits } from "./numeric.ts";
import { namesIn } from "./giacPrint.ts";
import { decidedAtDouble, decideTwice, restsOnDecision } from "./decisions.ts";
import { assignmentIn, formIn, formOf, mayStore, programStores, STATE_HEADS, STRING_HEADS, wordsOf, writesThrough, type InputForm, type ProgramStores } from "./stores.ts";
import { fnFacts, inherited, nameFacts, readFacts, readsFacts, storedFacts, storeFacts, type FactsHost } from "./facts.ts";
import { changedPart, changesOf, namesOf, namesPart, parsePrinted, readsFrom, statePart, tableOf, type InputReads, type StoredName } from "./stateRead.ts";
import { applyDefChanges, keyOf, PREVIEW_MAX, replayOrder, type DefChange, type DefEntry, type NameFacts } from "./defs.ts";
import { SOLVE_HARD_TIMEOUT_S, solveRequest, unknownsOf } from "./solve.ts";
import { analyze, table } from "./analysis.ts";
import { UNIT_DEFINITIONS, unitEval } from "../units/evaluate.ts";
import { constUncDigits, inexactConstsIn, withConstValues, type ConstTable } from "./constUnc.ts";
import { chipCommand, chipNameFacts, chipsIn, CHIP_PREFIX, withChipValues, type ChipFactsTable } from "./chipFacts.ts";
import type { Quantity, UnitError, UnitJob } from "../units/types.ts";
import { contextDiff, hostContext, isFlagName, namesFlag, namesUnreadFlag } from "./flags.ts";
import { contextOf, gated, type GatedGiac } from "./ctxGate.ts";

/** G65: what the call after an input found: the names it read and stored (stateRead.ts), and Giac's settings. */
interface AfterInput {
  reads: InputReads;
  /** The table after the input (when the state was read) and the names that changed or went. */
  table: Map<string, StoredName> | null;
  changes: { changed: string[]; removed: string[] } | null;
  /** G104: the names VARS() listed that the table leaves out (ours, a name that holds itself), when the state was read. */
  skipped: Set<string> | null;
  /** A setting differed from the host's and was put back. */
  flagsChanged: boolean;
  /** …and the user's text set it (the result says it was not kept, G67). */
  reset: boolean;
}

/** G97: what Giac's pow prints for a base that is a list but not a square matrix (gen.cc:6881). */
const AMBIGUOUS_POWER = /\^ is ambiguous on non square matrices/;

const NO_READS: InputReads = { names: [], targets: [], fn: false };

/** G104: the state heads whose names are the tree's targets (a name they remove is gone from VARS() too). */
const PURGE_HEADS: ReadonlySet<string> = new Set(["purge", "DelVar", "del", "unassign"]);


/** What the host needs from a loaded Giac module (engine/giac/wasm/api.cc). */
export interface GiacApi {
  eval(input: string): string;
  /** giac_set_pow_limit: returns the previous limit. */
  setPowLimit(limit: number): number;
  /** Text Giac printed (Emscripten `print`) since the last clearMessages(). Parse errors arrive here. */
  messages(): string;
  clearMessages(): void;
}

export interface LoadedGiac {
  giac: GiacApi;
  /** G85's structured bridge (bridge.ts); the loader fails with NO_BRIDGE on an engine without it (G99). */
  bridge: GiacBridge;
  /** Fetch + compile + instantiate, measured by the loader. */
  instantiateMs: number;
}

export type GiacLoader = (baseUrl: string) => Promise<LoadedGiac>;

/** Read by Giac's EMCC hooks (gen.cc, maple.cc): no "=decimal" suffix on fractions, no WebGL 3D.
 *  Must be set before the module is instantiated. */
export function setGiacHostGlobals(): void {
  (globalThis as Record<string, unknown>).UI = {
    add_evalf: 0,
    js_bigint: 0,
    disable3d: -1,
    Datestart: Date.now(),
  };
}

/** Collects what the Emscripten module prints, for GiacApi.messages(). */
export function messageBuffer(): { print: (s: string) => void; messages: () => string; clear: () => void } {
  let buf: string[] = [];
  return {
    print: (s) => {
      if (buf.length < 50) buf.push(s);
    },
    messages: () => buf.join("\n"),
    clear: () => {
      buf = [];
    },
  };
}

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

function isTimeout(out: string): boolean {
  return isError(out) && /interrupt/i.test(out);
}

/** Commands that put Giac into CAS mode (D3). Home's are homeSetupCommands() in homeEval.ts. */
export function casSetupCommands(s: CasSettings): string[] {
  return [
    angleCommand(s.angle),
    `Digits:=${Math.trunc(s.digits)}`,
    `timeout ${Math.min(Math.max(s.hardTimeoutS, 0.001), 1439).toFixed(3)}`,
    "ckevery 10",
    // G82: Home's step budget off; the CAS view waits on its clock (a person waits on it, it chooses no path).
    "ckbudget 0",
  ];
}

/** Giac reports a parse error by printing "syntax error" and returning `undef`. */
class GiacSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GiacSyntaxError";
  }
}

type CasError = NonNullable<CasResult["error"]>;

/** Names in a printed value that are not user names (a value with only these in it does not depend on the order of the
 *  replay). */
const CONSTANT_NAMES: ReadonlySet<string> = new Set(["i", "pi", "e", "infinity", "inf", "undef", "euler_gamma", "true", "false"]);

const IDENT_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Engine state and the synchronous operations on it. One per Giac instance. */
export class EngineHost implements FactsHost {
  private modeKey = "";
  /** G67: the Digits the current mode set (Giac's own 12 before any mode), which the settings check expects. */
  private modeDigits = 12;
  /** Read by facts.ts (FactsHost), as are byName, chipFacts and stored. */
  readonly giac: GatedGiac["giac"];
  /** G99: Giac's tree of an input (bridge-2) gives the names it reads and binds. */
  private readonly bridge: GiacBridge;
  /** The current input's tree, parsed once per Enter (usesOf and after share it). */
  private parsed: { text: string; tree: GiacParse } | null = null;
  /** `giac.eval` that throws GiacSyntaxError instead of quietly returning `undef` (which would
   *  otherwise leave the previous answer in place and show it again). */
  private readonly strict: { eval(input: string): string; value(text: string, precisions: readonly number[], tree?: boolean): GiacValue; ambiguousPower(): boolean; digits(d: number): void };
  /** G97: `giac.eval` that reads Giac's messages after each eval for ambiguousPower(), and throws nothing (Num's
   *  cells, where a syntax error is a cell's own error). Without it a power's shape walk would run on every cell. */
  private readonly watched: { eval(input: string): string; value(text: string, precisions: readonly number[], tree?: boolean): GiacValue; ambiguousPower(): boolean; digits(d: number): void };

  /** Our definitions already loaded into this Giac instance (ENGINE_DEFINITIONS, loaded on first use). */
  private readonly loaded = new Set<string>();
  /** UNIT_DEFINITIONS are loaded (the first units request). */
  private unitsLoaded = false;

  /** This engine's copy of the definitions log (defs.ts): what the user's names hold, and the mark facts of the
   *  variables that hold floats (decisions M4-7). */
  private log: DefEntry[] = [];
  byName = new Map<string, DefEntry>();
  /** G49: the chips the current Home input holds by name (`pasr_<k>`), with the facts they lend (as a stored float's). */
  readonly chipFacts = new Map<string, NameFacts>();
  /** G65: Giac's stored user names, read after every input that may store and after restore() (stateRead.ts). */
  stored = new Map<string, StoredName>();
  /** G104: the names Giac's VARS() listed at the last state read that `stored` leaves out (ours, an assumed name). */
  private skipped = new Set<string>();
  /** G65: the call after the current input, once it ran (home() and cas() make it when the run did not). */
  private post: AfterInput | null = null;

  /** G83: the user's functions restore() has not given to Giac yet, by name; loaded on first use (need). */
  private pending = new Map<string, DefEntry>();

  /** Loads the definitions `text` mentions that are not loaded yet: the user's pending functions (G83) and ours.
   *  Called before every input reaches Giac. */
  need(text: string): void {
    if (this.pending.size) this.loadPending(text);
    this.needOurs(text);
  }

  /** Our definitions (ENGINE_DEFINITIONS, eseries) that `text` mentions and that are not loaded yet. */
  private needOurs(text: string): void {
    for (const name of definitionsUsedBy(text)) {
      if (this.loaded.has(name)) continue;
      this.giac.eval(ENGINE_DEFINITIONS[name] ?? eseriesDefinition());
      this.loaded.add(name);
    }
  }

  /**
   * G83 (docs/04 6.2): every pending function whose name is a word in `text`, and, transitively, every pending function
   * named in such a body or in the stored value of a name the text reads (`S:=(g(x))` reads g), goes to Giac in one
   * batch. A text that lists or clears the names (VARS, expr, rm_all_vars, restart) loads them all.
   */
  private loadPending(text: string): void {
    const queue = LOAD_ALL.test(text) ? [...this.pending.keys()] : wordsOf(text);
    const seen = new Set<string>();
    const todo: DefEntry[] = [];
    while (queue.length) {
      const n = queue.pop()!;
      if (seen.has(n)) continue;
      seen.add(n);
      const e = this.pending.get(n) ?? this.byName.get(n);
      if (!e || e.kind === "assume") continue;
      if (this.pending.has(n)) todo.push(e);
      for (const c of e.cmds) for (const w of wordsOf(c)) if (!seen.has(w)) queue.push(w);
    }
    if (!todo.length) return;
    for (const e of todo) {
      this.pending.delete(e.name);
      this.needOurs(e.cmds[0]!);
    }
    for (let k = 0; k < todo.length; k += REPLAY_BATCH) {
      const part = todo.slice(k, k + REPLAY_BATCH);
      this.runBatch(part.map((e) => e.cmds[0]!), part.map((e) => e.name));
    }
    // The stored table learns the loaded names as Giac prints them, so the input's state part does not count them as
    // its stores (G65's changesOf would log them as vars with the input's facts).
    // G104: their entries only
    const node = parsePrinted(this.giac.eval(namesPart(this.modeDigits, todo.map((e) => e.name))));
    const table = node ? tableOf(node, (n) => this.byName.has(n)) : null;
    if (table) for (const e of todo) { const t = table.get(e.name); if (t) this.stored.set(e.name, t); }
    // the `// Success` notes and any error of the load are not the input's
    this.giac.clearMessages();
  }

  /**
   * G29: plain commands (`a:=1;b:=2;`) in one Giac call. One that printed an error or returned one is run again one
   * command at a time (values and functions can be set twice), so one bad entry never takes the others down (G19).
   */
  private runBatch(batch: readonly string[], names: readonly string[]): void {
    if (!batch.length) return;
    this.giac.clearMessages();
    const out = this.giac.eval(batch.join(";") + ";");
    // Any message or error result: a syntax error, or a reserved name that aborts the rest of the batch (`pi:=3`).
    if (batch.length > 1 && (/error|reserved word|not allowed/i.test(this.giac.messages()) || /^GIAC_ERROR/.test(out))) {
      // Errors only: a warning (`declared as global`) is no reason to run twice. The names are purged first, so a
      // rerun sees them as free again, as in the first run (G3: S:=(K*x+1) must not meet a K set by the aborted run).
      for (const n of names) this.giac.eval(`purge(${n})`);
      for (const c of batch) this.giac.eval(c);
    }
  }

  constructor(raw: GiacApi, rawBridge: GiacBridge) {
    // G102: Digits through bridge-1, a set waiting until the next Giac call (ctxGate.ts)
    const { giac, bridge } = gated(raw, rawBridge);
    this.giac = giac;
    this.bridge = bridge;
    // R64, G46: Giac in radians, and pasdeg (our parser's degree factor) set before any input: the units, raw eval and
    // replay paths have no mode setup of their own
    giac.eval(angleCommand("rad"));
    let ambiguous = false;
    let msg = "";
    // Giac's messages of one call (an eval, or G103's bridge-3 value)
    const heard = <T>(call: () => T): T => {
      giac.clearMessages();
      const out = call();
      msg = giac.messages();
      ambiguous = AMBIGUOUS_POWER.test(msg);
      return out;
    };
    const read = (input: string): string => heard(() => giac.eval(input));
    const value = (text: string, precisions: readonly number[], tree?: boolean): GiacValue => heard(() => bridge.value(text, precisions, tree));
    const syntax = (failed: boolean): void => {
      if (failed && /syntax error/.test(msg)) throw new GiacSyntaxError(msg.trim());
    };
    this.strict = {
      eval: (input) => {
        const out = read(input);
        syntax(out === "undef");
        return out;
      },
      value: (text, precisions, tree) => {
        const v = value(text, precisions, tree);
        syntax(v.kind === "error");
        return v;
      },
      ambiguousPower: () => ambiguous,
      digits: giac.digits,
    };
    this.watched = { eval: read, value, ambiguousPower: () => ambiguous, digits: giac.digits };
  }

  /** Replays definitions (a fresh engine: at init, or the stored log on first launch) and adds them to the log.
   *  Symbolic values first, while every name in them is still free (defs.ts). Returns the time it took. */
  restore(stored: readonly DefEntry[]): number {
    const t0 = performance.now();
    const entries = this.withoutFlags(this.migrated(stored));
    // G83: a function (one balanced command) waits in `pending` until an input names it (need). One whose name Giac
    // already holds is replayed now: a loaded body that calls it would otherwise meet the old definition.
    const plain = (e: DefEntry): boolean => (e.kind === "var" || e.kind === "fn") && e.cmds.length === 1 && balanced(e.cmds[0]!);
    for (const e of entries) {
      if (e.kind !== "other") this.pending.delete(e.name);
      if (e.kind === "fn" && plain(e) && !this.byName.has(e.name)) this.pending.set(e.name, e);
    }
    // G29: values go to Giac REPLAY_BATCH at a time (`a:=1;b:=2;`), which halves the per-call cost. Assumptions and
    // inputs kept as typed go alone.
    let batch: string[] = [];
    let names: string[] = [];
    const flush = (): void => {
      this.runBatch(batch, names);
      batch = [];
      names = [];
    };
    for (const e of replayOrder(entries)) {
      if (this.pending.get(e.name) === e) continue;
      // A replayed command may use one of ours, or a pending function (G83). A symbolic value is set while every
      // name in it is still free (G3), so it loads only ours.
      for (const c of e.cmds) {
        if (e.early) this.needOurs(c);
        else this.need(c);
      }
      if (plain(e)) {
        batch.push(e.cmds[0]!);
        names.push(e.name);
        if (batch.length >= REPLAY_BATCH) flush();
      } else {
        flush();
        for (const c of e.cmds) this.giac.eval(c);
      }
    }
    flush();
    this.record(entries.map((e) => ({ set: e })));
    // G67: a replayed body or command may have changed a Giac setting; G65: the table of stored names, in the same call
    const post = this.after("", false, "full");
    this.commit(post);
    this.otherToNames(entries, post);
    return performance.now() - t0;
  }

  /** G67: the entries without a Giac setting (a log stored before G67 holds `approx_mode:=(1)`, `Digits:=(14)`): a named
   *  one goes from the client's log too (a purge in takeMigrated), one kept as typed is only not replayed. */
  private withoutFlags(entries: readonly DefEntry[]): readonly DefEntry[] {
    const flagged = entries.filter((e) => (e.kind === "other" ? e.cmds.some(namesFlag) : isFlagName(e.name)));
    if (!flagged.length) return entries;
    const names = flagged.filter((e) => e.kind !== "other").map((e) => e.name);
    if (names.length) this.migratedChanges.push({ purge: names });
    return entries.filter((e) => !flagged.includes(e));
  }

  /**
   * G67, G65, G102: after an input, Giac's settings through bridge-1 (`giac_ctx_get`, or the answer of a Digits set
   * still waiting, ctxGate.ts) compared field by field with the host's (flags.ts hostContext); on a difference one
   * `giac_ctx_set` of the whole context, and the mode setup runs again on the next call. An input that names a setting
   * bridge-1 cannot see (timeout, ckevery) gets the mode setup again too. Then the names the input reads, from its tree
   * (G99, bridge-2; `read`: skipped after a syntax error; `shown`: its result's text, see readsOf), and, when `state`,
   * the stored user names, both with the settings back. G104: the entries of the input's candidates (candidatesOf) and
   * of the names new in VARS() are read, every other stays from `stored` (stateRead.ts changedPart); every entry when
   * the candidates are unknown or `state` is "full" (restore; statePart).
   * `reset`: the user's text set one (the input names a setting, or calls a stored function whose definition does; the
   * result says it was not kept). Giac leaks some by itself, put back without a word: a `throw` in a program leaves
   * eval_level at 1 (our refusals in pasmedian, eseries), and `(-32)^(1/5)` leaves epsilon at 1e-60 (probe 2026-10-20).
   */
  private after(input: string, read: boolean, state: boolean | "full", shown?: string): AfterInput {
    if (namesUnreadFlag(input)) this.modeKey = "";
    const want = hostContext(this.modeDigits);
    const flagsChanged = contextDiff(this.bridge.ctxGet(), want).length > 0;
    if (flagsChanged) {
      contextOf(this.bridge.ctxSet(want));
      this.modeKey = "";
    }
    // G99: the names come from Giac's tree; parsed only when they can matter (mayLend)
    const reads = read && (state || this.mayLend(input)) ? this.readsOf(input, shown) : NO_READS;
    const typed = new Set(namesIn(input));
    // G104: a name the text names is read again too (the table holds a `pas` name the text names, isOurs)
    const cands = state === true ? this.candidatesOf(input) : null;
    const known = cands ? [...this.stored.keys(), ...this.skipped].filter((n) => !cands.has(n) && !typed.has(n)) : [];
    const stateNode = state ? parsePrinted(this.giac.eval(cands ? changedPart(this.modeDigits, known) : statePart(this.modeDigits))) : null;
    const reset = flagsChanged && (namesFlag(input) || [...input.matchAll(/[A-Za-z][A-Za-z0-9_]*/g)].some((m) => this.byName.get(m[0])?.cmds.some(namesFlag) === true));
    const table = state && stateNode ? tableOf(stateNode, (n) => this.byName.has(n) || typed.has(n), this.stored) : null;
    const skipped = table && stateNode ? new Set(namesOf(stateNode).filter((n) => !table.has(n))) : null;
    this.post = { reads, table, changes: table ? changesOf(this.stored, table) : null, skipped, flagsChanged, reset };
    return this.post;
  }

  /**
   * G104: the names whose stored entry `input` may change: the targets of its tree and the kept stores (G100) of the
   * programs its words name, walked through the programs they read. A name it removes is gone from VARS(), a name new
   * there is read as well (after). Null, so every entry is read, when they are unknown: a word that lists or clears the
   * names (LOAD_ALL), a text Giac's parser refused, a state head other than a purge or a head that evaluates a string,
   * in the input or in a program it reaches.
   */
  private candidatesOf(input: string): Set<string> | null {
    const tree = this.treeOf(input);
    const unknown = (h: string): boolean => STRING_HEADS.has(h) || (STATE_HEADS.has(h) && !PURGE_HEADS.has(h));
    // LOAD_ALL's words: VARS (its tree's head or read), expr, rm_all_vars and restart (string and state heads)
    if (!tree.ok || tree.heads.some(unknown) || [...tree.heads, ...tree.reads].includes("VARS")) return null;
    const out = new Set(tree.targets);
    const seen = new Set<string>();
    const queue = [...wordsOf(input), ...tree.reads];
    while (queue.length) {
      const n = queue.pop()!;
      if (seen.has(n)) continue;
      seen.add(n);
      const k = this.keptOf(n);
      if (!k) continue;
      for (const w of k.writes) {
        if (!w.endsWith("(")) out.add(w);
        else if (unknown(w.slice(0, -1))) return null;
      }
      queue.push(...k.calls);
    }
    return out;
  }

  /** G100 (stores.ts): how `input` stores. Its tree decides, parsed only when the text can hold a store (mayStore); a
   *  stored program it names counts by its kept stores, walked through the programs it reads. */
  private formFor(input: string): InputForm {
    return formOf(input, mayStore(input) ? this.treeOf(input) : null, (names) => writesThrough(names, (n) => this.keptOf(n)));
  }

  /** G100: the kept stores of a parsed program text, by text (a restored entry: the stored log keeps none, validDefs). */
  private readonly keptByText = new Map<string, ProgramStores>();

  /**
   * G100: what the program `name` stores when it runs: the stores its log entry keeps (read when it was defined), else
   * read once from its definition (a restored entry) or from the program Giac holds under the name (one a body defined).
   * A value that is no program counts by the tree of its stored text, so a program inside it (`L:=[g]` holds g's
   * program, F81) counts, and goes on through the names in it (`h:=g`). Null for a name the host does not hold.
   */
  private keptOf(name: string): ProgramStores | null {
    const e = this.byName.get(name);
    if (e?.stores) return e.stores;
    if (e?.kind === "fn") return this.keptFrom(e.cmds[0]!);
    const t = this.stored.get(name);
    if (!t) return null;
    const k = this.keptFrom(t.text);
    return t.fn ? k : { writes: k.writes, calls: [...new Set([...k.calls, ...t.names])] };
  }

  /** G101 (nonsquare.ts): the function `name` when its body is known: a program that stores nothing and evaluates no
   *  string, nor do the programs it reads (G100's kept stores), and declares no local (its parameters and the names it
   *  binds come from its tree, bridge-2; nonsquare.ts walks it only when they are its parameters alone). Null: a
   *  stored program whose body is not known; undefined: no stored program. */
  private readonly bodyOf = (name: string): KnownBody | null | undefined => {
    const t = this.stored.get(name);
    if (!t?.fn) return undefined;
    if (writesThrough([name], (n) => this.keptOf(n))) return null;
    const tree = this.treeFrom(t.text);
    return tree.ok && tree.heads[0] === "program" && !tree.heads.includes("local") ? { params: tree.bound, reads: tree.reads, heads: tree.heads } : null;
  };

  /** G101: the stored functions `input` reads (its tree, G99) and their bodies, for nonsquare.ts. */
  private bodiesFor(input: string): Bodies {
    return { reads: () => this.treeOf(input).reads, of: this.bodyOf };
  }

  /** G100/G101: the tree of a stored text (bridge-2), parsed once per text. */
  private readonly treeByText = new Map<string, GiacParse>();
  private treeFrom(text: string): GiacParse {
    let t = this.treeByText.get(text);
    if (!t) this.treeByText.set(text, (t = this.bridge.parse(text)));
    return t;
  }

  private keptFrom(text: string): ProgramStores {
    let k = this.keptByText.get(text);
    if (!k) this.keptByText.set(text, (k = programStores(this.treeFrom(text))));
    return k;
  }

  /** Giac's tree of a text (bridge-2), never evaluated: what a library file's bodies store (library.ts parseLibrary). */
  readonly parse = (text: string): GiacParse => this.bridge.parse(text);

  /** Giac's tree of `input` (bridge-2), parsed once per Enter. */
  private treeOf(input: string): GiacParse {
    if (this.parsed?.text !== input) this.parsed = { text: input, tree: this.bridge.parse(input) };
    return this.parsed.tree;
  }

  /**
   * G99: the names `input` reads, from its tree. A name it binds (diff's x) that its result `shown` still names is read
   * too: the shown value is that result evaluated with the stored x (after x:=3, diff(x^3,x) is 3*x^2, Home shows 27).
   * The result is parsed only when a bound name is one the host holds.
   */
  private readsOf(input: string, shown: string | undefined): InputReads {
    const tree = this.treeOf(input);
    const reads = readsFrom(tree);
    const held = tree.bound.filter((b) => !reads.names.includes(b) && (this.stored.has(b) || this.chipFacts.has(b)));
    if (!held.length || shown === undefined) return reads;
    const named = this.bridge.parse(shown).reads;
    const more = held.filter((b) => named.includes(b));
    return more.length ? { ...reads, names: [...reads.names, ...more] } : reads;
  }

  /** Whether a name `input` reads can lend facts (facts.ts usedBy): a name its tree reads is a word of its text, so an
   *  input without a word that is a chip or a stored name with facts reads none that lends any. */
  private mayLend(input: string): boolean {
    return wordsOf(input).some((w) => this.chipFacts.has(w) || (this.stored.has(w) && nameFacts(this, w, new Set()) !== null));
  }

  /** The table the last call read becomes the host's (after the input's facts were taken from the one before). */
  private commit(post: AfterInput): void {
    if (post.table) this.stored = post.table;
    if (post.skipped) this.skipped = post.skipped;
    this.post = null;
  }

  /** F58, for a log stored before G65: an "other" entry (`x:=y:=3`) outlives purge(x), purge(y). After the replay it
   *  becomes var entries for the names the replay set that no entry holds (their names come from the table), and goes
   *  from the log (a purge of `#<cmds>`, defs.ts); passed on through migratedChanges. One that set no new name stays. */
  private otherToNames(entries: readonly DefEntry[], post: AfterInput): void {
    const others = entries.filter((e) => e.kind === "other" && e.cmds.some((c) => this.formFor(c).stores));
    if (!others.length || !post.table) return;
    const base = { preview: "", view: "cas" as const, time: Date.now() };
    const sets: DefChange[] = [];
    for (const name of post.changes?.changed ?? []) {
      if (this.byName.has(name) || isFlagName(name)) continue;
      const snap = this.snapshot(name, 12);
      if (snap) sets.push({ set: { name, kind: "var", cmds: [snap.cmd], ...base, ...(snap.early ? { early: true } : {}) } });
    }
    if (!sets.length) return;
    const changes: DefChange[] = [{ purge: others.map((e) => keyOf(e)) }, ...sets];
    this.record(changes);
    this.migratedChanges.push(...changes);
  }

  /** G46: what the last restore() changed in the entries it was given (flagged values resolved), for the client to
   *  keep and store; taken once. */
  private migratedChanges: DefChange[] = [];
  /** G46: the flagged values whose preview matched neither reading; kept as they were (R14 section 7). */
  unmatched: string[] = [];

  takeMigrated(): DefChange[] {
    const out = this.migratedChanges;
    this.migratedChanges = [];
    return out;
  }

  /** The entries with every flagged value (`migrate: "angle"`, angleMigration.ts) read both ways against its preview. */
  private migrated(entries: readonly DefEntry[]): readonly DefEntry[] {
    if (!entries.some((e) => e.migrate)) return entries;
    const changes: DefChange[] = [];
    const out = entries.map((e) => {
      if (!e.migrate) return e;
      const { migrate: _, ...rest } = e;
      const r = e.cmds.length === 1 ? resolveAngle(this.giac, e.cmds[0]!, e.preview) : null;
      if (!r) this.unmatched.push(e.name);
      const next: DefEntry = r ? { ...rest, cmds: [r.cmd], ...(r.angle ? { angle: r.angle } : {}) } : rest;
      changes.push({ set: next });
      return next;
    });
    this.migratedChanges.push(...changes);
    return out;
  }

  private record(changes: readonly DefChange[]): void {
    if (!changes.length) return;
    this.log = applyDefChanges(this.log, changes);
    this.byName = new Map(this.log.filter((e) => e.kind !== "other").map((e) => [e.name, e]));
  }

  eval(input: string): { output: string; ok: boolean; engineMs: number; defs: DefChange[] } {
    this.parsed = null;
    this.need(input);
    const t0 = performance.now();
    const output = this.giac.eval(input);
    const ok = !isError(output);
    let defs: DefChange[] = [];
    if (ok && this.formFor(input).stores) {
      const post = this.after(input, true, true);
      defs = this.defsAfter(input, [input], output, null, null, "home", 12, undefined, post);
      this.commit(post);
    }
    return { output, ok, engineMs: performance.now() - t0, defs };
  }

  /**
   * What an input that may store changed, as entries for the definitions log (defs.ts), recorded in this engine's copy
   * too. G65: the names come from Giac's state (`post`, the call after the input): every name whose stored text changed
   * or appeared, and every name a top-level store sets (its value may print as before: sto(F,pB) over pB:=899450126402),
   * is a variable set again from its value (`snapshot`), or the function `f(x):=…` defines (replayed as `ran`); a name
   * that went, or that `purge(…)` names, is purged. `facts`: what a variable takes (storedFacts' rule), `fn`: what the
   * function takes; `angle`: the mode a variable was stored in (G34), recorded with it when known.
   */
  private defsAfter(input: string, ran: string[], preview: string, facts: NameFacts | null, fn: NameFacts | null, view: "home" | "cas", digits: number, angle: "rad" | "deg" | undefined, post: AfterInput): DefChange[] {
    const base = { preview: dropAngleFactor(preview.trim()).slice(0, PREVIEW_MAX), view, time: Date.now() };
    const purge = /^\s*purge\s*\(([^()]*)\)\s*$/.exec(input);
    const purged = purge ? purge[1]!.split(",").map((x) => x.trim()).filter((n) => IDENT_NAME.test(n)) : [];
    const gone = [...new Set([...purged, ...(post.changes?.removed ?? [])])];
    const assume = /^\s*(assume|additionally)\s*\(\s*([A-Za-z][A-Za-z0-9_]*)/.exec(input);
    // G100: the input's tree (parsed for the state read): the function `f(x):=…` defines, and the stores a program keeps
    const tree = this.treeOf(input);
    const def = formOf(input, tree, () => false).defined;
    const kept = tree.program && tree.top.length === 1 ? programStores(tree) : undefined;
    // A state that could not be read: the names the parse says it sets.
    const changed = post.table
      ? [...new Set([...(post.changes?.changed ?? []), ...post.reads.targets.filter((n) => post.table!.has(n))])]
      : [...new Set([...post.reads.targets, ...(def ? [def.name] : [])])];
    let changes: DefChange[] = gone.length ? [{ purge: gone }] : [];
    if (assume) {
      const name = assume[2]!;
      const prev = this.byName.get(name);
      const cmds = assume[1] === "additionally" && prev?.kind === "assume" ? [...prev.cmds, ...ran] : ran;
      changes.push({ set: { name, kind: "assume", cmds, ...base } });
    }
    for (const name of changed) {
      if (def?.kind === "fn" && def.name === name) {
        changes.push({ set: { name, kind: "fn", cmds: ran, ...(fn ? { facts: fn } : {}), ...(kept ? { stores: kept } : {}), ...base } });
        continue;
      }
      const snap = this.snapshot(name, digits);
      changes.push(
        snap
          ? { set: { name, kind: "var", cmds: [snap.cmd], ...storedFacts(facts, snap.float), ...(kept && def?.name === name ? { stores: kept } : {}), ...base, ...(snap.early ? { early: true } : {}), ...(angle ? { angle } : {}) } }
          : { purge: [name] },
      );
    }
    // G67: a Giac setting is never a user's name, in any form (`approx_mode:=(1)`, `Digits:=(14)`, `purge(epsilon)`), and
    // an input kept as typed that sets one is not kept (the check after the call has put the setting back)
    changes = changes.flatMap((c): DefChange[] => {
      if ("purge" in c) {
        const kept = c.purge.filter((n) => !isFlagName(n));
        return kept.length ? [{ purge: kept }] : [];
      }
      return isFlagName(c.set.name) || (c.set.kind === "other" && namesFlag(input)) ? [] : [c];
    });
    // G83: a new definition or a purge of a pending name: the old definition never comes back
    for (const c of changes) for (const n of "purge" in c ? c.purge : [c.set.name]) this.pending.delete(n);
    this.record(changes);
    return changes;
  }

  /**
   * A variable's value as a command that sets it again: `B:=(<value>)`, floats as `evalf(<exact>,k)` with the digits
   * they print with (doubles: 14). `early`: the value has names in it, so it must be set before any of them is.
   * Null when the name holds nothing.
   */
  private snapshot(name: string, digits: number): { cmd: string; float: boolean; early: boolean } | null {
    const t = withDigits(this.giac, DOUBLE_DIGITS, digits, () => this.giac.eval(name)).trim();
    if (t === "" || t === name || isError(t)) return null;
    const float = hasFloat(t);
    const early = namesIn(t).some((n) => !CONSTANT_NAMES.has(n));
    return { cmd: `${name}:=(${float ? floatsAsEvalf(t) : t})`, float, early };
  }

  /** The mark facts a variable keeps when it is set from result `r` (decisions M4-7). */
  private static factsOf(r: HomeResult | undefined, digits: number): NameFacts | null {
    if (!r || !r.ok) return null;
    if (!r.value && !r.items) return { exact: false, reliableDigits: null, warn: "unchecked" }; // a symbolic value with a float in it
    return { exact: false, reliableDigits: r.facts.reliableDigits, ...(r.facts.warn ? { warn: r.facts.warn } : {}) };
  }

  /**
   * `consts` (G26): the constants the input holds by name (`pasc_<id>`) with their values and uncertainties. The
   * values are put in and the input evaluates as without the table; a numeric result from an inexact constant then
   * carries `uncDigits` (constUnc.ts). `chips` (G49): the chips it holds by name (`pasr_<k>`, chipFacts.ts). An exact
   * chip is put in as its value; any other is a Giac variable for this run, and its facts pass on as a stored float's
   * (M4-7). An input kept as typed in the log (`f(x):=…`, `a,b:=…`) gets every chip as its value, since the name
   * would outlive the run. A value stored from an input with an inexact constant or chip keeps `inexact` facts.
   * Without the tables, nothing changes.
   */
  home(typed: string, s: HomeSettings, consts?: ConstTable, chips?: ChipFactsTable): { result: HomeResult; defs: DefChange[] } {
    this.post = null;
    this.parsed = null;
    // G91: a precision with no name in it (`approx(e,2*10)`) is read as the literal it gives
    const input = askedLiterals(this.giac, typed, () => this.useHomeMode(s));
    const out = this.homeTabled(input, s, consts, chips);
    // G67, G65: the call after the input, if the run did not make it (an error: a syntax error ran nothing)
    const post = this.post ?? this.after(input, false, out.result.error !== "syntax" && this.formFor(input).stores);
    this.commit(post);
    return post.reset ? { ...out, result: { ...out.result, settingReset: true } } : out;
  }

  private homeTabled(input: string, s: HomeSettings, consts?: ConstTable, chips?: ChipFactsTable): { result: HomeResult; defs: DefChange[] } {
    if (!consts && !chips) return this.homeRun(input, s, false);
    const form = this.formFor(input);
    const asg = form.assignment;
    const stateful = form.stores;
    const held = chips ? chipsIn(input, chips) : [];
    const keep = new Set(stateful && form.defined?.kind !== "var" ? [] : held.filter((k) => !chips![k]!.exact));
    const named = chips ? withChipValues(input, chips, keep) : input;
    // G49f1: the facts an inexact chip or constant lends to a function defined from it (its value is put in).
    const lent: NameFacts[] = [
      ...held.filter((k) => !chips![k]!.exact).map((k) => chipNameFacts(chips![k]!)),
      ...(consts !== undefined && inexactConstsIn(input, consts).length > 0 ? [{ exact: false, reliableDigits: null, inexact: true as const }] : []),
    ];
    const inexactIn = lent.length > 0;
    for (const k of keep) {
      this.giac.eval(chipCommand(k, chips![k]!));
      this.chipFacts.set(`${CHIP_PREFIX}${k}`, chipNameFacts(chips![k]!));
    }
    try {
      const ran = consts ? withConstValues(named, consts) : named;
      const out = this.homeRun(ran, s, inexactIn, lent, formIn(form, ran));
      // A setting the input changed was put back after its run: it is not run again (G67).
      if (!consts || (stateful && !asg) || this.post?.flagsChanged) return out;
      const body = asg ? (formIn(form, named).assignment?.rhs ?? named) : named;
      const n = constUncDigits(this.giac, body, consts, out.result, Math.trunc(out.result.digits ?? s.digits));
      return n === undefined ? out : { ...out, result: { ...out.result, facts: { ...out.result.facts, uncDigits: n } } };
    } finally {
      if (keep.size) this.giac.eval(`purge(${[...keep].map((k) => CHIP_PREFIX + k).join(",")})`);
      this.chipFacts.clear();
    }
  }

  /** `inexactIn` (G49): the input held a constant or chip that is not exact, so a value it stores is not exact.
   *  `lent` (G49f1): the facts of those chips and constants, for a function defined from them. */
  private homeRun(input: string, s: HomeSettings, inexactIn: boolean, lent: readonly NameFacts[] = [], given?: InputForm): { result: HomeResult; defs: DefChange[] } {
    this.need(input);
    this.useHomeMode(s);
    const t0 = performance.now();
    let result: HomeResult;
    // G100: a chip's or constant's input brings the form of its typed text (homeTabled), the value cut from this one
    const form = given ?? this.formFor(input);
    try {
      result = homeEval(this.strict, input, s, undefined, form, this.bodiesFor(input));
    } catch (e) {
      if (!(e instanceof GiacSyntaxError)) throw e;
      const ms = performance.now() - t0;
      return {
        result: { ok: false, display: e.message, path: "float-error", approximate: false, tieRisk: false, exactMs: ms, totalMs: ms, error: "syntax", ...safePrecision(e.message) },
        defs: [],
      };
    }
    if (!result.ok) return { result: { ...result, error: result.error ?? "engine" }, defs: [] };
    // M4-7: a value computed from stored floats keeps their marks. An assignment's right side is what ran; a
    // self-reference (B:=B*2) already overwrote B, and other stateful inputs cannot run again, so neither is moved.
    const asg = form.assignment;
    const body = asg ? asg.rhs : input;
    const stateful = form.stores;
    const once = asg ? namesIn(asg.rhs).includes(asg.name) : stateful;
    const storing = !once && form.once;
    // G65: the call after the input: Giac's settings, the names it read, and the stored names when it may have stored
    const post = this.after(input, true, stateful || storing, result.exact);
    const rerun = !once && !storing && !post.flagsChanged;
    const digits = Math.trunc(s.digits);
    result = inherited(this, result, post.reads, rerun ? toExactLiterals(body) : null, digits, digits);
    let defs: DefChange[] = [];
    if (stateful || storing) {
      // Replay the form that actually ran: exact for the exact paths, floats for the fallbacks.
      const ran =
        result.path === "exact" || result.path === "exact-big"
          ? [toExactLiterals(input)]
          : [`Digits:=${s.workDigits}`, input, `Digits:=${s.digits}`];
      // G49: an inexact input, or a result shown with ⚠ (G38's decision that did not hold), stores a value that is not
      // exact even when it prints as an exact rational. G65: a stored name also takes the facts of what the input read.
      const read = readsFacts(this, post.reads).facts;
      const fn = post.reads.fn;
      const facts = fn ? fnFacts(lent, read) : EngineHost.factsOf(result, digits);
      const inexact = !fn && facts !== null && (inexactIn || result.facts.warn !== undefined);
      // G48: a symbolic value's facts count only when they say it is not exact (a float in it, a ⚠).
      const own = inexact ? { ...facts, inexact: true as const } : result.value || result.items ? facts : null;
      defs = this.defsAfter(input, ran, result.display, storeFacts(own, lent, read), fn ? facts : null, "home", digits, s.angle, post);
    }
    return { result, defs };
  }

  /** The stored variables a CAS input reads (F28): the names its tree reads (G99: a bound name is no read) that the log
   *  holds as values. An assignment lists its own target when its right side reads it (`x:=x+1`).
   *  Taken before the input runs, since it may change the log. */
  private usesOf(input: string): NonNullable<CasResult["uses"]> {
    if (!wordsOf(input).some((w) => this.byName.get(w)?.kind === "var")) return [];
    // a store's tree reads its stored side only, as asg.rhs alone; G48: the names any other top-level store sets (a
    // list assignment, f(x):=…, L[k]:=…, v=>a) are not read either
    const tree = this.treeOf(input);
    const set = assignmentIn(input, tree) ? [] : tree.top;
    return tree.reads
      .filter((n) => !set.includes(n))
      .flatMap((n) => {
        const e = this.byName.get(n);
        return e?.kind === "var" ? [{ name: n, preview: e.preview, view: e.view }] : [];
      });
  }

  cas(typed: string, s: CasSettings): { result: CasResult; defs: DefChange[] } {
    this.parsed = null;
    // G91: as in Home
    const input = askedLiterals(this.giac, typed, () => this.useCasMode(s));
    const used = this.usesOf(input);
    this.post = null;
    const out = this.casRun(input, s);
    if (used.length && out.result.ok) out.result.uses = used;
    // G67, G65: the call after the input, if the run did not make it (an error or a refusal)
    const post = this.post ?? this.after(input, false, out.result.error !== "syntax" && this.formFor(input).stores);
    this.commit(post);
    if (post.reset) out.result.settingReset = true;
    return out;
  }

  private casRun(input: string, s: CasSettings): { result: CasResult; defs: DefChange[] } {
    this.need(input);
    this.useCasMode(s);
    const t0 = performance.now();
    const fail = (text: string, error: CasError): { result: CasResult; defs: DefChange[] } => ({
      result: { ok: false, text, latex: "", timedOut: error === "timeout", error, engineMs: performance.now() - t0, facts: { exact: false, reliableDigits: null } },
      defs: [],
    });
    // P9 (docs/04 section 2.9): typed decimals are exact rationals, as in Home; approx() gives decimals.
    const exactInput = toExactLiterals(input);
    const test = input.includes(EQ_INEXACT_FLAG);
    if (test) this.giac.eval(`purge(${EQ_INEXACT_FLAG},${EQ_DIFF})`);
    // G39: `a:=sum(cos(k),k,1,inf)` must store nothing when its value is refused, so an assignment whose value holds a
    // definite integral, a series or a limit runs its right-hand side first, is checked, and only then stored.
    // G100: how the input stores, from its tree (stores.ts); the value is cut from the exact text
    const form = this.formFor(input);
    const asg0 = formIn(form, exactInput).assignment;
    // G57: so does one whose value rests on a decision, which may be refused as undecided.
    // G97: and one whose value may be a power of a non-square matrix, which is refused; G106: or a list plus a number.
    // G106: whether a name holds a list is read from Giac's print in the stored table (G65's state read, already made):
    // the assignment must be routed before it runs, and asking the engine would cost a call on every assignment. This
    // text gate moves to bridge-3 with the poly1 check when G103 reads a value's kind (docs/04 6.1).
    const isList = (n: string): boolean => this.stored.get(n)?.text.startsWith("[") === true;
    const guarded =
      asg0 && !form.once && (callsIn(asg0.rhs).length || mayPowerMatrix(asg0.rhs) || mayAddToList(asg0.rhs, isList) || restsOnDecision(asg0.rhs, "", notBuiltin(this.giac))) ? asg0 : null;
    // G38 (docs/04 2.4 rule 2): Giac decides signs, comparisons and floor at Digits, so the evaluation runs at P; the
    // mode's Digits stays the setting, which prints the floats of a non-number.
    const digitsSet = Math.trunc(s.digits);
    const body = guarded ? guarded.rhs : exactInput;
    const run = (): string => withDigits(this.giac, valuePrecision(digitsSet), digitsSet, () => this.strict.eval(`pcasans:=(${body})`));
    let text: string;
    let ambiguous: boolean;
    try {
      text = run();
      ambiguous = this.strict.ambiguousPower();
    } catch (e) {
      if (e instanceof GiacSyntaxError) return fail(e.message, "syntax");
      throw e;
    }
    if (isError(text)) {
      // G71 (F59): no MPFR value at P (a decision over BesselJ): an expression that stores nothing is decided at the double,
      // with ⚠, as in Home. An assignment keeps the error (its definitions-log entry would hold a double).
      const dbl = isTimeout(text) || asg0 || form.stores ? null : decidedAtDouble(this.giac, "pcasans", body, digitsSet);
      if (dbl === null) return fail(text, isTimeout(text) ? "timeout" : "engine");
      const why = { unaudited: unauditedIn(body) };
      const engineMs = performance.now() - t0;
      if ("text" in dbl) return { result: { ok: true, text: dbl.text, latex: dbl.text, timedOut: false, engineMs, approximate: true, facts: { exact: false, reliableDigits: null, warn: "unaudited", why } }, defs: [] };
      const r = resultFromFacts(dbl.facts, dbl.shape, digitsSet, "numeric", true, engineMs);
      const numeric = { ...r, facts: { ...r.facts, why } };
      return { result: { ok: true, text: numeric.display, latex: numberLatex(numeric.display), timedOut: false, engineMs, numeric, facts: numeric.facts }, defs: [] };
    }
    // A call to a stored function that stores (inc(x):={c:=c+1;c}) must not run again either, assigned or not (form.once).
    const single = form.stores;
    // An == or ≠ test on a float side: decided by its own digits, as in Home (R18f2).
    const inexactTest = test && this.giac.eval(EQ_INEXACT_FLAG) === "1";
    const decided = inexactTest && !single ? decideFloatTest(this.giac, exactInput, digitsSet) : null;
    if (decided) {
      text = run();
      ambiguous = this.strict.ambiguousPower();
      this.giac.eval(`purge(${EQ_VERDICT})`);
    }
    // G38: a result that rests on a numeric decision is decided again at P + 20 (and P + 40), as in Home; an exact
    // == or ≠ test too, only one with a float side is decideFloatTest's.
    // A plain name:=value decides its value (the right-hand side) and stores the agreed one, as Home does; other
    // stateful inputs (f(x):=…, purge, assume, =>) must not run twice.
    const asg = form.assignment;
    const once = asg ? form.once : form.stores;
    // G48: an input that runs once and rests on a decision is ⚠, as in Home (it cannot be decided again).
    let undecided = once && !inexactTest && onceUndecided(this.giac, form, exactInput, text);
    const decisionExpr = asg ? toExactLiterals(asg.rhs) : exactInput;
    // G57: a decision the precisions do not agree on, or a tie Giac cannot prove, is refused as in Home (nothing is stored).
    let refusedCut = false;
    if (!once && !inexactTest && !hasFloat(text) && restsOnDecision(decisionExpr, text, notBuiltin(this.giac))) {
      const d = decideTwice(this.giac, decisionExpr, text, digitsSet, digitsSet);
      if ("undecided" in d) undecided = true;
      if ("undecided" in d && d.refused) refusedCut = true;
      if (!("undecided" in d) && d.from !== undefined) {
        if (this.giac.eval(`pcasans:=${d.from};purge(${d.from})`).startsWith("GIAC_ERROR")) this.giac.eval(`purge(${d.from})`);
        if (asg && !guarded) this.giac.eval(`${asg.name}:=pcasans`);
        text = d.text;
      }
    }
    // G39: a divergent integral or series, or no limit, is refused as in Home; Giac's [exact, numeric] pair of a
    // definite integral is shown as Giac's text (both answers) with ⚠, never as a numeric list.
    const refused = guarded ? refusalOf(this.giac, guarded.rhs, text) : single ? null : refusalOf(this.giac, exactInput, text);
    if (refused && refused !== "unchecked") return fail(enEngine[`error.${refused}`], refused);
    if (refusedCut) return fail(enEngine["error.undecided"], "undecided");
    // G97 (F69): a power, inverse or division of a non-square matrix is Giac's elementwise answer, refused as in Home.
    const builtin = notBuiltin(this.giac);
    const userFn = (name: string): boolean => builtin(name) && !(name in ENGINE_DEFINITIONS) && !WORKER_DEFINITION_NAMES.includes(name);
    if ((guarded || !single) && nonSquarePower(this.giac, body, text, ambiguous, () => false, performance.now() - t0, userFn, this.bodiesFor(input))) return fail(enEngine["error.notSquare"], "notSquare");
    // G106 (F78): Giac's polynomial of a list plus a number (`[1,4]+1` = poly1[1,5]), which the input did not ask for.
    if (unaskedPoly(this.giac, "pcasans", asg0 ? asg0.rhs : exactInput, text, userFn)) return fail(enEngine["error.listPlusNumber"], "listPlusNumber");
    if (guarded) {
      const stored = this.giac.eval(`${guarded.name}:=pcasans`);
      if (isError(stored)) return fail(stored, isTimeout(stored) ? "timeout" : "engine");
    }
    // A check that could not finish: the result stands with ⚠ (its numeric facts, or the text's mark).
    const unverified = refused === "unchecked";
    const pair = !single && hasDefiniteIntegral(exactInput) && giacPair(text) !== null;
    // G65: the call after the input (its checks above ran it again; nothing after this does but print the result).
    const after = (): AfterInput => this.after(input, true, single, text);
    // G49f3: a function defined here keeps the facts of the names its body holds, as in Home (fnFacts).
    const defsOf = (post: AfterInput, preview: string, facts: NameFacts | null): DefChange[] => {
      if (!single) return [];
      const read = readsFacts(this, post.reads).facts;
      const fn = post.reads.fn ? fnFacts(facts ? [facts] : [], read) : null;
      return this.defsAfter(input, [exactInput], preview, storeFacts(facts, [], read), fn, "cas", Math.trunc(s.digits), s.angle, post);
    };
    // A number with a float in it: checked like Home (the value as `numeric`, its text and LaTeX from our formatter).
    // `evalf(e,n)` alone is shown with the n digits it asks for, checked at that precision (decisions M4-6).
    // G103: its shape from bridge-3's kind and elements (one call, only for a text with a float)
    const shape = hasFloat(text) && !pair ? shapeOfValue(this.giac.value("pcasans", [])) : null;
    if (shape) {
      const asked = askedDigits(input);
      const digits = asked ?? Math.trunc(s.digits);
      // G90: evalf of an integral whose exact answer keeps Giac's integrate(…) is its numeric integration of the typed
      // integrand (float bounds), ⚠ without a count, as in Home.
      const integrated = !single && integratedNumerically(this.giac, exactInput, text);
      const read = floatFacts(this.giac, "pcasans", single ? null : integrated ? floatBounds(exactInput) : exactInput, shape, digits, Math.trunc(s.digits), exactInput);
      const facts = read && integrated ? integratedFacts(read) : read;
      if (facts) {
        let numeric = resultFromFacts(facts, shape, digits, "numeric", true, performance.now() - t0);
        if (unverified) numeric.facts = { ...numeric.facts, warn: numeric.facts.warn ?? "unchecked" };
        if (asked !== null) numeric.digits = asked;
        const body = asg ? asg.rhs : input;
        const why = whyOf(facts, single ? null : exactInput);
        if (why) numeric.facts = { ...numeric.facts, why };
        const post = after();
        numeric = inherited(this, numeric, post.reads, single || post.flagsChanged ? null : exactInput, digits, Math.trunc(s.digits));
        return {
          result: { ok: true, text: numeric.display, latex: numberLatex(numeric.display), timedOut: false, engineMs: performance.now() - t0, numeric, facts: numeric.facts },
          defs: defsOf(post, numeric.display, EngineHost.factsOf(numeric, Math.trunc(s.digits))),
        };
      }
    }
    // G38: a float in a non-number prints with the precision it was computed at (P). pcasans keeps the P result; the
    // text prints its floats at the setting (floatsShown), never by running the input again (that redid decisions).
    const atN = hasFloat(text) ? floatsShown(this.giac, text, digitsSet, "pasfl") : null;
    const slot = atN === null ? "pcasans" : "pasfl";
    if (atN !== null) text = atN;
    // This build leaves x*x unevaluated (no top-level "regroup" autosimplify), and latex() then draws x·x as "xx".
    if (text.includes("*")) text = regrouped(this.giac, slot, text);
    // An == or ≠ test on a side with a float in it (input/emit.ts equalityTest): its true or false is approximate.
    // A float in a non-number (x-0.54764225985): nobody checked its digits, so ⚠ without a count (G27, docs/04 2.4),
    // as the definitions log records it.
    const unchecked = hasFloat(text) || undecided || unverified;
    // G51: a result without a float that read a stored name, or called a function, with facts takes their warn and
    // why.inherited, as `inherited` does for a number; one built from exact names stays unmarked.
    const post = after();
    const read = readFacts(this, input, post.reads);
    // G71 (N7): Giac's two-argument round and trunc work in a double; the integer trunc(x,0) prints is not exact.
    const doubled = doubleFormsIn(exactInput).length > 0;
    const approximate = (test && this.giac.eval(EQ_INEXACT_FLAG) === "1") || unchecked || doubled || read !== null;
    const own = decided?.warn ?? (doubled ? "unaudited" : unchecked ? "unchecked" : undefined);
    const warn = own === "unaudited" || read?.facts.warn === "unaudited" ? "unaudited" : (own ?? read?.facts.warn);
    const symWhy = symbolicWhy(own, testSides(exactInput));
    // G38: "decided at limited precision"; the value was computed, not compared, so `once` is not said.
    const why0 = pair ? { differ: true } : undecided ? { ...(symWhy && !symWhy.once ? symWhy : {}), decided: true } : symWhy;
    const why = read?.causes.length ? { ...(why0 ?? {}), inherited: read.causes } : why0;
    // G46 (S14 option 2): in DEG the radian text is drawn and copied as a DEG engine prints it; Ans, chips (`full`) and
    // pcasans keep the radian text, which means the same in every mode.
    const deg = s.angle === "deg" && needsDegrees(text) ? backInDegrees(this.giac, text) : null;
    const shown = deg ?? text;
    const tex = deg !== null ? this.giac.eval(`latex(quote(${deg}))`) : latexShown(this.giac, slot, text);
    if (atN !== null) this.giac.eval("purge(pasfl)");
    if (isError(tex)) return fail(tex, isTimeout(tex) ? "timeout" : "engine");
    return {
      result: {
        ok: true,
        text: shown,
        ...(shown !== text ? { full: text } : {}),
        latex: unquote(tex),
        timedOut: false,
        engineMs: performance.now() - t0,
        ...(approximate ? { approximate } : {}),
        facts: { exact: false, reliableDigits: null, ...(warn ? { warn } : {}), ...(why ? { why } : {}) },
      },
      defs: defsOf(post, shown, unchecked ? { exact: false, reliableDigits: null, warn: "unchecked", inexact: true } : null),
    };
  }

  solve(req: SolveRequest, s: HomeSettings): SolveOutcome {
    // G83f1: the request's expressions only (its keys and JSON would name a pending function or match LOAD_ALL)
    this.need(expressionsOf(req.kind === "poly" ? [req.equation] : req.equations, req.knowns?.map((k) => k.value)));
    this.useSolveMode(s);
    // G65: no read of the stored names after it: Solve puts back the very values it freed (solve.ts withUnassigned)
    return solveRequest(this.giac, req, s);
  }

  unknowns(equations: string[]): string[] {
    this.need(equations.join(";"));
    return unknownsOf(this.giac, equations);
  }

  analyze(req: AnalysisRequest, s: HomeSettings): AnalysisResult {
    const r = req as Partial<Record<"f" | "g" | "x0" | "lo" | "hi" | "a" | "b", string>>;
    this.need(expressionsOf([r.f, r.g, r.x0, r.lo, r.hi, r.a, r.b]));
    this.useSolveMode(s);
    // G65: it stores only our own pas* names, so the table of stored names stays as it is
    return analyze(this.giac, req, s);
  }

  /** The unit view (G16, docs/04 4.2): in Home's mode (angle, budget, digits), with our unit definitions loaded on the
   *  first request. A syntax error or a timeout is an engine error, never a value. */
  units(job: UnitJob, s: HomeSettings): Quantity | UnitError {
    this.need(expressionsOf([job.expr, job.check, job.end]));
    if (!this.unitsLoaded) {
      for (const d of UNIT_DEFINITIONS) this.giac.eval(d);
      this.unitsLoaded = true;
    }
    this.useHomeMode(s);
    try {
      return unitEval(this.strict, job, s);
    } catch (e) {
      if (e instanceof GiacSyntaxError) return { error: "engine", detail: e.message };
      throw e;
    }
  }

  /** Num table cells are Home evaluations, in Home mode (same budget per cell). */
  table(req: TableRequest, s: HomeSettings): HomeResult[][] {
    this.need(expressionsOf(req.fns));
    this.useHomeMode(s);
    return table(this.watched, req, s, (cell) => this.formFor(cell));
  }

  private useCasMode(s: CasSettings): void {
    this.useMode(`cas${JSON.stringify(s)}`, s.digits, () => {
      for (const c of casSetupCommands(s)) this.giac.eval(c);
      this.giac.setPowLimit(s.powLimit);
    });
  }

  private useHomeMode(s: HomeSettings): void {
    this.useMode(`home${JSON.stringify(s)}`, s.digits, () => {
      for (const c of homeSetupCommands(s)) this.giac.eval(c);
      this.giac.eval(`Digits:=${Math.trunc(s.digits)}`);
      this.giac.setPowLimit(s.powLimit);
    });
  }

  private useSolveMode(s: HomeSettings): void {
    this.useMode(`solve${JSON.stringify(s)}`, s.digits, () => {
      this.giac.eval(angleCommand(s.angle));
      this.giac.eval(`timeout ${SOLVE_HARD_TIMEOUT_S}`);
      this.giac.eval("ckevery 10");
      this.giac.eval("ckbudget 0"); // G82: Solve keeps its clock
      this.giac.eval(`Digits:=${Math.trunc(s.digits)}`);
      this.giac.setPowLimit(s.powLimit);
    });
  }

  private useMode(key: string, digits: number, apply: () => void): void {
    if (key === this.modeKey) return;
    apply();
    this.modeKey = key;
    this.modeDigits = Math.trunc(digits);
  }
}

/** Commands per Giac call in a replay (G29; tools/probes/replay-cost.mjs: 10–50 are as fast, 200 in one call is not). */
export const REPLAY_BATCH = 25;

/** G83: inputs that list or clear the user's names: every pending function is loaded first. */
const LOAD_ALL = /\b(VARS|expr|rm_all_vars|restart)\b/;

/** G83f1: the expression strings of a request, for need(): one per line, the absent ones left out. */
function expressionsOf(...lists: (readonly (string | undefined)[] | undefined)[]): string {
  return lists.flatMap((l) => l ?? []).filter((t): t is string => t !== undefined).join("\n");
}

/** Brackets and quotes pair up: a command with a stray one would swallow what follows it in a batch. */
function balanced(cmd: string): boolean {
  let depth = 0;
  let quote = false;
  for (const ch of cmd) {
    if (ch === '"') quote = !quote;
    else if (quote) continue;
    else if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") if (--depth < 0) return false;
  }
  return depth === 0 && !quote;
}

/** G24: a failed allocation reaches us as a C++ exception (`WebAssembly.Exception`, from `new`) or as an abort
 *  (GMP, or the heap at its cap). The engine is not trusted after either: the client restarts it. */
function isMemoryFailure(e: unknown): boolean {
  if (typeof WebAssembly !== "undefined" && "Exception" in WebAssembly && e instanceof (WebAssembly as unknown as { Exception: new () => object }).Exception) return true;
  return /\bOOM\b|out of memory|cannot enlarge memory|^Aborted/i.test(e instanceof Error ? e.message : String(e));
}

/** Builds the message handler used by the worker: init loads Giac, then requests go to EngineHost. */
export function createRequestHandler(load: GiacLoader, post: (r: Response) => void): (req: Request) => Promise<void> {
  // Calls that arrive while init is still loading the engine wait for it, in arrival order (a Plot
  // view restored at launch asks for the trace before the engine is up).
  let starting: Promise<EngineHost> | null = null;
  return async (req) => {
    try {
      if (req.type === "init") {
        starting = (async () => {
          const loaded = await load(req.baseUrl);
          const t1 = performance.now();
          loaded.giac.eval("0");
          const host = new EngineHost(loaded.giac, loaded.bridge);
          const t2 = performance.now();
          const replayMs = host.restore(req.replay);
          post({ id: req.id, type: "ready", instantiateMs: loaded.instantiateMs, initMs: t2 - t1, replayMs });
          return host;
        })();
        await starting;
        return;
      }
      if (!starting) throw new Error("engine not initialised");
      const host = await starting;
      switch (req.type) {
        case "define":
          post({ id: req.id, type: "defined", replayMs: host.restore(req.defs), defs: host.takeMigrated() });
          break;
        case "eval":
          post({ id: req.id, type: "result", ...host.eval(req.input) });
          break;
        case "home":
          post({ id: req.id, type: "home", ...host.home(req.input, req.settings, req.consts, req.chips) });
          break;
        case "cas":
          post({ id: req.id, type: "cas", ...host.cas(req.input, req.settings) });
          break;
        case "solve":
          post({ id: req.id, type: "solve", result: host.solve(req.req, req.settings) });
          break;
        case "unknowns":
          post({ id: req.id, type: "unknowns", result: host.unknowns(req.equations) });
          break;
        case "analyze":
          post({ id: req.id, type: "analyze", result: host.analyze(req.req, req.settings) });
          break;
        case "table":
          post({ id: req.id, type: "table", result: host.table(req.req, req.settings) });
          break;
        case "units":
          post({ id: req.id, type: "units", result: host.units(req.job, req.settings) });
          break;
      }
    } catch (e) {
      post({ id: req.id, type: "fatal", message: e instanceof Error ? e.message : String(e), ...(isMemoryFailure(e) ? { memory: true as const } : {}) });
    }
  };
}
