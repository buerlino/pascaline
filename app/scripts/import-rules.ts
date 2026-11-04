// SPDX-License-Identifier: GPL-3.0-or-later
// G147: the import direction between the main thread and the engine, checked by the gate's `rules` stage. Two rules:
//  1. What the start chunk reaches (static value imports from src/main.ts) may import from src/engine/ only START_ENGINE
//     (small, UI-free modules): the worker side (homeEval, host, numeric, ...) loads in the Worker, not at start (G30's
//     start-chunk overrun came from the entry holding homeEval's graph).
//  2. A file in src/engine/ imports nothing from views/, state/, keyboard/, entry/, apps/, render/ or input/, and from
//     units/ only what ENGINE_EXCEPTIONS names. So `input/` -> `engine/` is the only direction.
//  3. G163: the main-thread side holds no worker evaluator. No file under src/units/ except the worker's own
//     (UNIT_WORKER_FILES), and none under src/views/, src/state/ or src/apps/, reaches engine/homeEval, numeric, host,
//     converge or decisions (WORKER_ENGINE) by a chain of static value imports (type-only imports are erased): the unit view's chunks would carry the whole evaluator's graph (docs/04 8.2:
//     views see `Calc`; 8.1: format.ts is pure).
// Imports are read from the source text (import/export ... from, and bare `import "x"`); `import()` is lazy and not
// counted for rule 1. Tests (*.test.ts) are not checked.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix, relative } from "node:path";

export interface Import {
  spec: string;
  /** `import type` / `export type`: erased, so no weight for the start chunk, but still a direction. */
  type: boolean;
  line: number;
}

/** The static imports and re-exports of a source text. Comments at a line's start (`*`, `//`) are never matched. */
export function importsOf(source: string): Import[] {
  const out: Import[] = [];
  const lineAt = (i: number): number => source.slice(0, i).split("\n").length;
  for (const m of source.matchAll(/^[ \t]*(?:import|export)\s+(type\s+)?[^'";]*?\s*from\s*["']([^"']+)["']/gm)) out.push({ spec: m[2]!, type: m[1] !== undefined, line: lineAt(m.index ?? 0) });
  for (const m of source.matchAll(/^[ \t]*import\s*["']([^"']+)["']/gm)) out.push({ spec: m[1]!, type: false, line: lineAt(m.index ?? 0) });
  return out;
}

/** Rule 1: the engine modules the start chunk may import (value imports). Types and helpers with no further imports of
 *  their own into the worker side: types.ts, format.ts, defs.ts, giacPrint.ts (Giac text, no imports), workerEngine.ts and
 *  protocol.ts (the main-thread client), homeDefaults.ts (Home's defaults, R103) and pasdeg.ts (the degree factor's name, R103). */
export const START_ENGINE: ReadonlySet<string> = new Set(["types", "format", "defs", "giacPrint", "workerEngine", "protocol", "homeDefaults", "pasdeg"].map((n) => `src/engine/${n}.ts`));

/** Rule 2: folders src/engine/ may not import from. */
export const ENGINE_FORBIDDEN = ["views", "state", "keyboard", "entry", "apps", "render", "input", "units"] as const;

/** Rule 2's named exceptions: "<file> -> <module>" and why. An exception nothing uses fails the check ("now passing"). */
export const ENGINE_EXCEPTIONS: Readonly<Record<string, string>> = {
  "src/engine/types.ts -> src/units/types.ts": "the unit job and quantity types (type-only): the unit view's types are the units folder's own",
  "src/engine/protocol.ts -> src/units/types.ts": "likewise (type-only)",
  "src/engine/workerEngine.ts -> src/units/types.ts": "likewise (type-only)",
  "src/engine/host.ts -> src/units/types.ts": "likewise (type-only)",
  "src/engine/host.ts -> src/units/evaluate.ts": "the unit evaluator runs in the Giac worker beside Home (P15, docs/04 4.2) and imports engine/homeEval.ts and numeric.ts back; moving it into engine/ is a package of its own (G147 'Not done')",
  "src/engine/stateRead.ts -> src/units/evaluate.ts": "reads UNIT_DEFINITIONS: the same unit evaluator (see host.ts above)",
};

/** Rule 3: the engine modules that run in the Giac worker (the evaluator and its decision code). */
export const WORKER_ENGINE: ReadonlySet<string> = new Set(["homeEval", "numeric", "host", "converge", "decisions"].map((n) => `src/engine/${n}.ts`));

/** Rule 3: the files of src/units/ that run in the worker beside Home (units/evaluate.ts and what it builds on) and may import them. */
export const UNIT_WORKER_FILES: ReadonlySet<string> = new Set(["evaluate", "build", "dims", "types", "uncertainty"].map((n) => `src/units/${n}.ts`));

/** Rule 3: the main-thread folders whose files may not import WORKER_ENGINE (src/units/ with UNIT_WORKER_FILES left out). */
const MAIN_THREAD_DIRS = ["src/units/", "src/views/", "src/state/", "src/apps/"] as const;

/** Rule 3: from main-thread file `from`, the shortest chain of static value imports (type-only imports are erased, as in
 *  startReach) to each WORKER_ENGINE module it reaches, with the line of `from`'s own first import on the chain. The walk
 *  goes through every file, the unit worker's own too: a chunk that imports them carries their graph. */
function workerChains(sources: Sources, from: string): { path: string[]; line: number }[] {
  const parent = new Map<string, { via: string; line: number }>();
  const queue = [from];
  const seen = new Set([from]);
  const out: { path: string[]; line: number }[] = [];
  while (queue.length > 0) {
    const f = queue.shift()!;
    for (const i of importsOf(sources[f]!)) {
      if (i.type) continue;
      const to = resolveImport(sources, f, i.spec);
      if (to === null || seen.has(to)) continue;
      seen.add(to);
      parent.set(to, { via: f, line: i.line });
      if (WORKER_ENGINE.has(to)) {
        const path = [to];
        for (let p = parent.get(to)!; ; p = parent.get(p.via)!) {
          path.unshift(p.via);
          if (p.via === from) break;
        }
        out.push({ path, line: parent.get(path[1]!)!.line });
      } else if (!isTest(to)) queue.push(to);
    }
  }
  return out;
}

/** Source files (relative to app/, forward slashes) -> text: the .ts and .svelte files of src/. */
export type Sources = Readonly<Record<string, string>>;

const isTest = (p: string): boolean => /\.(test|spec)\.ts$/.test(p);

/** `spec` imported from `from`, as a key of `sources`, or null when it is not a relative import of a file we hold. */
function resolveImport(sources: Sources, from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const p = posix.normalize(posix.join(posix.dirname(from), spec));
  for (const c of [p, `${p}.ts`, `${p}/index.ts`]) if (Object.hasOwn(sources, c)) return c;
  return null;
}

/** The files the start chunk loads: src/main.ts and everything it imports by a static value import, transitively. */
export function startReach(sources: Sources, entry = "src/main.ts"): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const f = stack.pop()!;
    if (seen.has(f) || !Object.hasOwn(sources, f)) continue;
    seen.add(f);
    for (const i of importsOf(sources[f]!)) {
      if (i.type) continue;
      const to = resolveImport(sources, f, i.spec);
      if (to !== null) stack.push(to);
    }
  }
  return seen;
}

export interface Verdict {
  ok: boolean;
  detail: string;
  failures: string[];
}

/** Both rules over `sources`. */
export function checkDirection(sources: Sources, entry = "src/main.ts"): Verdict {
  const failures: string[] = [];
  const used = new Set<string>();
  const reach = startReach(sources, entry);
  for (const f of [...reach].sort()) {
    for (const i of importsOf(sources[f]!)) {
      if (i.type) continue;
      const to = resolveImport(sources, f, i.spec);
      if (to !== null && to.startsWith("src/engine/") && !START_ENGINE.has(to) && !isTest(to)) {
        failures.push(`${f}:${i.line}: the start chunk reaches ${to}, which is worker-side (allowed from src/engine/: ${[...START_ENGINE].map((p) => p.replace("src/engine/", "")).join(", ")}); import it with import(), or move what is needed into an allowed module`);
      }
    }
  }
  for (const f of Object.keys(sources).sort()) {
    if (!f.startsWith("src/engine/") || isTest(f)) continue;
    for (const i of importsOf(sources[f]!)) {
      const to = resolveImport(sources, f, i.spec);
      const dir = to?.match(/^src\/([^/]+)\//)?.[1];
      if (to === null || dir === undefined || !(ENGINE_FORBIDDEN as readonly string[]).includes(dir)) continue;
      const key = `${f} -> ${to}`;
      if (Object.hasOwn(ENGINE_EXCEPTIONS, key)) used.add(key);
      else failures.push(`${f}:${i.line}: src/engine/ imports ${to}: the direction is ${dir}/ -> engine/ only (move what the engine needs into src/engine/, or pass it in)`);
    }
  }
  for (const f of Object.keys(sources).sort()) {
    if (isTest(f) || UNIT_WORKER_FILES.has(f) || !MAIN_THREAD_DIRS.some((d) => f.startsWith(d))) continue;
    for (const chain of workerChains(sources, f)) failures.push(`${f}:${chain.line}: ${chain.path.join(" -> ")}: reaches ${chain.path.at(-1)}, the worker's evaluator, by value imports (the main thread loads none of it; move what is needed into a pure module such as src/engine/format.ts or exactLiterals.ts)`);
  }
  for (const key of Object.keys(ENGINE_EXCEPTIONS)) if (!used.has(key)) failures.push(`ENGINE_EXCEPTIONS lists "${key}", which nothing uses any more: remove it (import-rules.ts)`);
  const note = `${reach.size} files reached from start, ${Object.keys(ENGINE_EXCEPTIONS).length} named exceptions`;
  return failures.length > 0 ? { ok: false, detail: `${failures.length} failed: ${failures.slice(0, 3).join("; ")}`, failures } : { ok: true, detail: `import direction holds (${note})`, failures };
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|svelte)$/.test(name) && !isTest(name)) out.push(p);
  }
  return out;
}

/** The sources of app/src (tests left out), keyed by path relative to `app`. */
export function readSources(app: string): Sources {
  const out: Record<string, string> = {};
  for (const f of walk(join(app, "src"))) out[relative(app, f).split("\\").join("/")] = readFileSync(f, "utf8");
  return out;
}

export const checkImportDirection = (app: string): Verdict => checkDirection(readSources(app));
