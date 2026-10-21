// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S4, docs/archive/r10-connector.md): the proposed function-library file, checked against the real engine host.
//   node tools/probes/library.ts check <file>   # read, check, define (through cas(), as if typed in CAS), run the tests
//   node tools/probes/library.ts replay          # replay time of 200 definitions: the ?bench=defs mix and 200 programs
//   node tools/probes/library.ts export          # define a sample as typed, write the log back out as a library, re-check it
// A prototype of the rules in r10 section 1, not the app's code: the import itself is a package after the owner's yes.
// Engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl (app/src/engine/nodeGiac.ts).
import { readFileSync } from "node:fs";
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { ENGINE_DEFINITIONS, definedBy, isStateful, simpleAssignment } from "../../app/src/engine/homeEval.ts";
import { defaultCasSettings } from "../../app/src/engine/types.ts";
import { applyDefChanges, MAX_DEFS, type DefEntry } from "../../app/src/engine/defs.ts";
import { DATA_VERSION } from "../../app/src/state/storage.ts";

/** r10 section 1: the limits. */
const MAX_BYTES = 256 * 1024;
const MAX_FILE_DEFS = 200;
const DESC_MAX = 120;
const HEADER = /^\/\/ pascaline library (\d+)$/;
const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
/** Words that change the engine's state when a body runs (probe 2026-10-18: `Digits:=5` inside a body stays set after
 *  the call; `purge(beam)` inside a body removes beam from the engine while the log still lists it; `read("f")` aborts
 *  the module). */
const STATE_WORDS = /\b(Digits|angle_radian|purge|restart|reset|rm_all_vars|assume|additionally|read|write|sto|cas_setup|DIGITS|HAngle|complex_mode)\b|=>/;

export interface LibDef { name: string; kind: "fn" | "var"; text: string; desc: string; tests: string[]; line: number }
export interface LibFile { version: number; defs: LibDef[] }
export class LibError extends Error {
  line: number;
  constructor(line: number, msg: string) {
    super(line ? `line ${line}: ${msg}` : msg);
    this.line = line;
  }
}

/** Top-level ";" (outside brackets, braces and strings): a second statement on a definition's line. */
function topLevelSemicolon(s: string): boolean {
  let depth = 0, str = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') str = !str;
    else if (str) continue;
    else if ("([{".includes(c!)) depth++;
    else if (")]}".includes(c!)) depth--;
    else if (c === ";" && depth === 0 && s.slice(i + 1).trim() !== "") return true;
  }
  return false;
}

function balanced(s: string): boolean {
  let d = 0;
  for (const c of s.replace(/"[^"]*"/g, "")) d += "([{".includes(c) ? 1 : ")]}".includes(c) ? -1 : 0;
  return d <= 0;
}

/** A name a body assigns that is neither a parameter nor declared `local`: a global the call would change. */
function globalAssigned(text: string): string | undefined {
  const head = /^\s*[A-Za-z][A-Za-z0-9_]*\s*\(([^()]*)\)\s*:=/.exec(text);
  if (!head) return undefined;
  const body = text.slice(head[0].length);
  const own = new Set(head[1]!.split(",").map((p) => p.trim()).filter(Boolean));
  for (const m of body.matchAll(/\blocal\s+([^;]+);/g)) for (const n of m[1]!.split(",")) own.add(n.trim().split(/\s|:=/)[0]!);
  for (const m of body.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)\s*:=/g)) if (!own.has(m[1]!)) return m[1]!;
  // for loops: `for (k:=…` is an assignment too, caught above
  return undefined;
}

/** Reads a library file: encoding, size, header, blocks. Refuses with the first problem (line number, plain words). */
export function parseLibrary(bytes: Uint8Array): LibFile {
  if (bytes.length > MAX_BYTES) throw new LibError(0, `the file is over ${MAX_BYTES / 1024} kB`);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new LibError(0, "the file is not UTF-8 text");
  }
  const lines = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  const h = HEADER.exec(lines[0]!.trim());
  if (!h) throw new LibError(1, "the first line must be `// pascaline library " + DATA_VERSION + "`");
  const version = Number(h[1]);
  if (version > DATA_VERSION) throw new LibError(1, `made by a newer Pascaline (version ${version}; this one reads up to ${DATA_VERSION})`);
  const defs: LibDef[] = [];
  let lastComment: { text: string; line: number } | null = null;
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]!;
    const t = raw.trim();
    if (t === "") { lastComment = null; continue; }
    if (t.startsWith("//")) {
      const test = /^\/\/\s*test:\s*(.+)$/.exec(t);
      if (test) {
        const d = defs[defs.length - 1];
        if (!d) throw new LibError(i + 1, "a test line before any definition");
        d.tests.push(test[1]!.trim());
      } else lastComment = { text: t.replace(/^\/\/\s*/, ""), line: i + 1 };
      continue;
    }
    if (/^\s/.test(raw)) throw new LibError(i + 1, "an indented line outside a definition");
    // a definition: this line, plus following lines while brackets are open or the line is indented / a closing brace
    const start = i;
    let block = raw;
    while (i + 1 < lines.length && (!balanced(block) || /^(\s+\S|[}\]\)])/.test(lines[i + 1]!))) block += "\n" + lines[++i];
    if (!balanced(block)) throw new LibError(start + 1, "a bracket is never closed");
    const def = definedBy(block);
    const asg = simpleAssignment(block);
    if (!def) throw new LibError(start + 1, "only definitions may stand in a library (`name(args):=…` or `name:=…`)");
    if (topLevelSemicolon(block)) throw new LibError(start + 1, "one definition per block: a second statement follows `;`");
    if (asg && isStateful(asg.rhs)) throw new LibError(start + 1, "a value must not itself define or change anything");
    if (STATE_WORDS.test(block.replace(/^[^:]*:=/, ""))) throw new LibError(start + 1, `the body changes the engine's state (${STATE_WORDS.exec(block.replace(/^[^:]*:=/, ""))![0]})`);
    const g = def.kind === "fn" ? globalAssigned(block) : undefined;
    if (g) throw new LibError(start + 1, `the body assigns ${g}, which is not local: declare it with \`local ${g};\``);
    if (!NAME.test(def.name)) throw new LibError(start + 1, "a name is letters, digits and _ (ASCII), starting with a letter");
    if (def.name in ENGINE_DEFINITIONS || def.name.startsWith("pasc_") || def.name.endsWith("_")) throw new LibError(start + 1, `${def.name} is one of Pascaline's own names`);
    if (defs.some((d) => d.name === def.name)) throw new LibError(start + 1, `${def.name} is defined twice in this file`);
    if (!lastComment || lastComment.line !== start) throw new LibError(start + 1, `${def.name} needs its one-line description on the line above`);
    if (lastComment.text.length > DESC_MAX) throw new LibError(lastComment.line, `the description is over ${DESC_MAX} characters`);
    defs.push({ name: def.name, kind: def.kind, text: block, desc: lastComment.text, tests: [], line: start + 1 });
    lastComment = null;
  }
  if (defs.length > MAX_FILE_DEFS) throw new LibError(0, `more than ${MAX_FILE_DEFS} definitions`);
  return { version, defs };
}

export interface ImportPlan { added: string[]; same: string[]; replaced: string[] }

/** Checks a parsed library against an engine host that already holds `log`, defines it and runs its tests.
 *  Returns the plan (what is new, unchanged, replaced) or throws; the caller restarts the engine on a throw. */
export function defineLibrary(host: EngineHost, giac: { eval(s: string): string }, lib: LibFile, log: readonly DefEntry[]): { plan: ImportPlan; log: DefEntry[] } {
  const byName = new Map(log.filter((e) => e.kind !== "other").map((e) => [e.name, e]));
  const plan: ImportPlan = { added: [], same: [], replaced: [] };
  for (const d of lib.defs) {
    const old = byName.get(d.name);
    if (old) (old.cmds.join("\n") === d.text ? plan.same : plan.replaced).push(d.name);
    else {
      if (giac.eval(`type(${d.name})`) === "func") throw new LibError(d.line, `${d.name} is a built-in function`);
      plan.added.push(d.name);
    }
  }
  if (log.length + plan.added.length > MAX_DEFS) throw new LibError(0, `the definitions would pass ${MAX_DEFS} (now ${log.length}, new ${plan.added.length}); the oldest would be dropped`);
  let out = [...log];
  for (const d of lib.defs) {
    if (plan.same.includes(d.name)) continue;
    const r = host.cas(d.text, defaultCasSettings);
    if (!r.result.ok) throw new LibError(d.line, `${d.name}: ${r.result.error ?? "the engine refused it"}`);
    out = applyDefChanges(out, r.defs);
  }
  for (const d of lib.defs) {
    for (const t of d.tests) {
      const v = giac.eval(t);
      if (v !== "true" && v !== "1") throw new LibError(d.line, `test failed: ${t} gave ${v}`);
    }
  }
  return { plan, log: out };
}

/** The log's functions and values written as a library file (export, r10 section 3). */
export function exportLibrary(log: readonly DefEntry[], desc: (e: DefEntry) => string): string {
  const out = [`// pascaline library ${DATA_VERSION}`];
  for (const e of log) {
    if (e.kind !== "fn" && e.kind !== "var") continue;
    out.push("", `// ${desc(e).replace(/\s+/g, " ").slice(0, DESC_MAX)}`, e.cmds.join("\n"));
  }
  return out.join("\n") + "\n";
}

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

async function fresh(): Promise<{ host: EngineHost; giac: { eval(s: string): string } }> {
  const { giac } = await loadNodeGiac();
  return { host: new EngineHost(giac), giac };
}

async function replayMs(make: (i: number) => string, n: number, runs = 5): Promise<{ ms: number[]; entries: number }> {
  const { host } = await fresh();
  let log: DefEntry[] = [];
  for (let i = 1; i <= n; i++) log = applyDefChanges(log, host.cas(make(i), defaultCasSettings).defs);
  const ms: number[] = [];
  for (let r = 0; r < runs; r++) ms.push((await fresh()).host.restore(log));
  return { ms, entries: log.length };
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === "check") {
  const lib = parseLibrary(readFileSync(arg!));
  const { host, giac } = await fresh();
  const t0 = performance.now();
  const { plan, log } = defineLibrary(host, giac, lib, []);
  const ms = performance.now() - t0;
  for (const d of lib.defs) console.log(`${d.kind} ${d.name}: ${d.desc} (${d.tests.length} tests)`);
  console.log(JSON.stringify({ version: lib.version, defs: lib.defs.length, tests: lib.defs.reduce((s, d) => s + d.tests.length, 0), entries: log.length, plan, ms: +ms.toFixed(1) }));
} else if (cmd === "replay") {
  const bench = await replayMs((i) => (i <= 150 ? `dv${i}:=${i}/7+${i}` : `df${i - 150}(x):=x^2+${i - 150}*x+sin(${i - 150})`), 200);
  console.log("bench mix (150 values, 50 functions, as ?bench=defs):", bench.entries, "entries, median", median(bench.ms).toFixed(1), "ms", bench.ms.map((m) => m.toFixed(1)).join(" "));
  const prog = await replayMs((i) => `lib${i}(a,b):={\n  local s,k;\n  s:=0;\n  for (k:=1;k<=b;k++) { s:=s+a^k/k; }\n  return s+${i};\n}`, 200);
  console.log("200 library programs (local, for loop):", prog.entries, "entries, median", median(prog.ms).toFixed(1), "ms", prog.ms.map((m) => m.toFixed(1)).join(" "));
  const one = await replayMs((i) => `lf${i}(q,L):=q*L^2/8+${i}`, 200);
  console.log("200 one-line functions:", one.entries, "entries, median", median(one.ms).toFixed(1), "ms", one.ms.map((m) => m.toFixed(1)).join(" "));
} else if (cmd === "export") {
  const { host } = await fresh();
  let log: DefEntry[] = [];
  for (const s of ["beam(q,L):=q*L^2/8", "A:=5", "B:=A*2", "f(x):={\n  local a;\n  a:=x^2;\n  return a+1;\n}", "assume(x>0)", "C:=evalf(sqrt(2))"]) log = applyDefChanges(log, host.cas(s, defaultCasSettings).defs);
  const file = exportLibrary(log, (e) => e.preview || e.name);
  console.log(file);
  const lib = parseLibrary(new TextEncoder().encode(file));
  const back = await fresh();
  const r = defineLibrary(back.host, back.giac, lib, []);
  console.log("round trip:", JSON.stringify(r.plan), "values:", ["beam(2,4)", "B", "f(3)", "C"].map((s) => `${s}=${back.giac.eval(s)}`).join(" "));
} else {
  console.error("usage: node tools/probes/library.ts check <file> | replay | export");
  process.exit(2);
}
