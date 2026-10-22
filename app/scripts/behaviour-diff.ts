// SPDX-License-Identifier: GPL-3.0-or-later
// A behaviour diff between two source trees (G55, night check 2026-10-19 section 2.4): the same fixed inputs run through
// each tree's own EngineHost on ONE engine build, and every input whose display, mark, warn or why differs is printed.
// It reports and does not judge: it always exits 0.
//   node scripts/behaviour-diff.ts <treeA> <treeB>      # tree = a checkout/worktree root (its app/src/engine is imported)
// A tree needs its own app/node_modules reachable (link it into a scratch worktree). Engine: $GIAC_MJS, else
// $GIAC_OUT/giac.mjs, else this repo's engine/giac/_out/gsl (a scratch worktree has no engine build of its own).
// Inputs: the single-input cases of home.yaml, precision.yaml and bench.yaml (read from THIS repo), tests/golden/corpus.yaml,
// each in Home and CAS, at 12 and 30 digits, in RAD and DEG; then corpus.yaml's sequences in Home. Each configuration gets
// a fresh engine per tree, so stored names carry over only within it.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "yaml";

const [ta, tb] = process.argv.slice(2);
if (!ta || !tb) {
  console.error("usage: node scripts/behaviour-diff.ts <treeA> <treeB>");
  process.exit(0);
}
const here = fileURLToPath(new URL("../../", import.meta.url));
const mjs = process.env.GIAC_MJS ?? (process.env.GIAC_OUT ? `${process.env.GIAC_OUT}/giac.mjs` : `${here}engine/giac/_out/gsl/giac.mjs`);

/* eslint-disable @typescript-eslint/no-explicit-any */
type Mod = Record<string, any>;
interface Tree {
  host: Mod;
  home: Mod;
  fmt: Mod;
  types: Mod;
  node: Mod;
  angles: Mod | null;
}

async function loadTree(dir: string): Promise<Tree> {
  const src = resolve(dir, "app/src");
  const imp = (f: string): Promise<Mod> => import(pathToFileURL(`${src}/${f}`).href) as Promise<Mod>;
  const [host, home, fmt, types, node] = await Promise.all([imp("engine/host.ts"), imp("engine/homeEval.ts"), imp("engine/format.ts"), imp("engine/types.ts"), imp("engine/nodeGiac.ts")]);
  const angles = existsSync(`${src}/input/angles.ts`) ? await imp("input/angles.ts") : null;
  return { host, home, fmt, types, node, angles };
}

type Angle = "rad" | "deg";
const markText = (t: Tree, f: unknown, digits: number): string => {
  try {
    // G76: a tree whose results carry `facts` gives markOf their precisionFacts; an older one, the result itself.
    const p = typeof t.home.precisionFacts === "function" ? t.home.precisionFacts(f) : f;
    const m = t.fmt.markOf(p, { format: "STD", digits }) as { mark: string; n?: number } | null;
    return m ? `${m.mark}${m.n ?? ""}` : "-";
  } catch {
    return "?";
  }
};
const json = (x: unknown): string => (x === undefined ? "" : JSON.stringify(x));
/** A result's warn and why, wherever its tree keeps them (G76: in `facts`; before, on the result). */
const factsOf = (r: Mod | undefined): Mod | undefined => (r === undefined ? undefined : (r["facts"] ?? r));

interface Row {
  display: string;
  mark: string;
  warn: string;
  why: string;
}

/** A fresh EngineHost on the shared engine build, in this tree's code. */
async function freshHost(t: Tree): Promise<Mod> {
  const g = (await t.node.loadNodeGiac(mjs)).giac;
  if (typeof t.home.pasdegCommand === "function") g.eval(t.home.pasdegCommand("rad"));
  return new t.host.EngineHost(g);
}

function run(t: Tree, host: Mod, view: "home" | "cas", input: string, digits: number, angle: Angle): Row {
  try {
    const typed = t.angles?.rewriteAngles ? (t.angles.rewriteAngles(input) as string) : input;
    if (view === "home") {
      const s = { ...t.home.defaultHomeSettings, angle, digits, workDigits: Math.max(30, digits + 10) };
      const r = host.home(typed, s).result;
      return { display: r.ok ? r.display : `error: ${r.error ?? r.display}`, mark: markText(t, r, digits), warn: json(factsOf(r)?.["warn"]), why: json(factsOf(r)?.["why"]) };
    }
    const r = host.cas(typed, { ...t.types.defaultCasSettings, angle, digits }).result;
    const f = factsOf(r);
    const n = factsOf(r.numeric);
    const mark = r.numeric ? markText(t, r.numeric, digits) : r.approximate ? (f?.["warn"] ? "⚠" : "≈") : "-";
    return { display: r.ok ? `${r.text}${r.full ? ` | ${r.full}` : ""}` : `error: ${r.error ?? r.text}`, mark, warn: json(f?.["warn"] ?? n?.["warn"]), why: json(f?.["why"] ?? n?.["why"]) };
  } catch (e) {
    return { display: `throws: ${(e as Error).message.split("\n")[0]}`, mark: "!", warn: "", why: "" };
  }
}

interface YamlCase {
  id?: string;
  input?: string;
  latex?: string;
  steps?: unknown;
  before?: unknown;
  beforeHome?: unknown;
  beforeCas?: unknown;
}
const golden = (f: string): YamlCase[] => (parse(readFileSync(`${here}tests/golden/${f}`, "utf8")) as { cases: YamlCase[] }).cases;
const inputs: string[] = [];
for (const f of ["home.yaml", "precision.yaml", "bench.yaml", "corpus.yaml"]) {
  for (const c of golden(f)) if (c.input && !c.latex && !c.steps && !c.before && !c.beforeHome && !c.beforeCas && !inputs.includes(c.input)) inputs.push(c.input);
}
const sequences = (parse(readFileSync(`${here}tests/golden/corpus.yaml`, "utf8")) as { sequences?: { id: string; steps: string[] }[] }).sequences ?? [];

const t0 = performance.now();
const trees = [await loadTree(ta), await loadTree(tb)] as const;
const rows: string[][] = [];
let compared = 0;
const same = (a: Row, b: Row): boolean => a.display === b.display && a.mark === b.mark && a.warn === b.warn && a.why === b.why;
const fmtRow = (r: Row): string => `${r.mark} ${r.display}${r.warn ? ` warn=${r.warn}` : ""}${r.why ? ` why=${r.why}` : ""}`;
const clip = (s: string): string => (s.length > 90 ? `${s.slice(0, 87)}...` : s);

for (const view of ["home", "cas"] as const) {
  for (const digits of [12, 30]) {
    for (const angle of ["rad", "deg"] as const) {
      const hosts = [await freshHost(trees[0]), await freshHost(trees[1])];
      for (const input of inputs) {
        const a = run(trees[0], hosts[0]!, view, input, digits, angle);
        const b = run(trees[1], hosts[1]!, view, input, digits, angle);
        compared++;
        if (!same(a, b)) rows.push([`${view} ${digits} ${angle}`, input, clip(fmtRow(a)), clip(fmtRow(b))]);
      }
    }
  }
}
for (const digits of [12, 30]) {
  for (const angle of ["rad", "deg"] as const) {
    for (const seq of sequences) {
      const hosts = [await freshHost(trees[0]), await freshHost(trees[1])];
      for (const [k, step] of seq.steps.entries()) {
        const a = run(trees[0], hosts[0]!, "home", step, digits, angle);
        const b = run(trees[1], hosts[1]!, "home", step, digits, angle);
        compared++;
        if (!same(a, b)) rows.push([`seq ${seq.id} ${digits} ${angle}`, `#${k + 1} ${step}`, clip(fmtRow(a)), clip(fmtRow(b))]);
      }
    }
  }
}

console.log(`A = ${ta}\nB = ${tb}\nengine ${mjs}\n${inputs.length} inputs x 8 settings + ${sequences.length} sequences x 4, ${compared} runs compared`);
if (rows.length === 0) console.log("none");
else {
  console.log("| where | input | A | B |\n|---|---|---|---|");
  for (const r of rows) console.log(`| ${r.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`);
  console.log(`${rows.length} difference(s)`);
}
console.log(`${((performance.now() - t0) / 1000).toFixed(1)} s`);
