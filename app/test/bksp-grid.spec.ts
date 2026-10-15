// SPDX-License-Identifier: GPL-3.0-or-later
// R26a: the ⌫ grid. Every template the keys insert (read from spec/keyboard.yaml, so a new key joins by itself) goes
// through seven scenarios of ⌫ and Del, and every line they leave is checked against "⌫ and Del keep a template whole"
// (docs/decisions.md, points 1-8). No app code: the cases that fail today are marked test.fail() with their bug id
// (F15, F17-F21), so the suite is green and each later package (R26c-R26h) flips its own cases by removing them from
// KNOWN_FAIL. The checks are derived from the rule, not from today's output.
//
// How: one page for the whole file; a scenario is one page.evaluate that runs its steps through
// `window.pascaline.entry.run` (the same path as a key) and returns the line, the cursor and the selection after
// each step. The checks run in Node. The parser (loadParser) reads every line for the failure message.
import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { devices, expect, test, type Page } from "@playwright/test";
import { parse } from "yaml";
import { open } from "./helpers.ts";

const here = dirname(fileURLToPath(import.meta.url));
interface Act { insert?: string; line?: { insert?: string } }
interface Cell { id: string; insert?: string; line?: { insert?: string } }
const doc = parse(readFileSync(join(here, "../../spec/keyboard.yaml"), "utf8")) as {
  keys: Record<string, unknown>[];
  templates: { items: Cell[] };
  relations: { items: Cell[] };
};

// ---- the templates, from the yaml ----------------------------------------------------------------------------------
interface Tmpl { name: string; latex: string; mode: "textbook" | "line"; bug: string }

/** A template: an insert with a box, a bracket pair or a power. Plain symbols and operators are not. */
const isTemplate = (latex: string): boolean => /#|\\left|\^/.test(latex);

/** The bug family of a template (the package that fixes it): F17 powers, F18 fractions and roots, F19 limits, F20 matrices, F21 the rest with marks, F15 brackets. */
function bugOf(latex: string): string {
  if (/\\(lim|int|sum|prod)/.test(latex)) return "F19";
  if (/pmatrix|cases/.test(latex)) return "F20";
  if (/\\log_|EQ|\\degree|\\right\|_/.test(latex)) return "F21";
  if (/\\partial|\\sqrt|\\t?frac|\\div/.test(latex)) return "F18";
  if (/\^/.test(latex)) return "F17";
  return "F15";
}

function collect(): Tmpl[] {
  const out: Tmpl[] = [];
  const seen = new Set<string>();
  const add = (name: string, latex: string | undefined, mode: Tmpl["mode"]): void => {
    if (latex === undefined || !isTemplate(latex) || seen.has(`${mode}|${latex}`)) return;
    seen.add(`${mode}|${latex}`);
    out.push({ name, latex, mode, bug: bugOf(latex) });
  };
  for (const key of doc.keys) {
    for (const layer of ["primary", "shift", "alpha"]) {
      const a = key[layer] as Act | undefined;
      if (!a) continue;
      add(`${key["id"] as string}/${layer}`, a.insert, "textbook");
      add(`${key["id"] as string}/${layer}/line`, a.line?.insert, "line");
    }
  }
  for (const c of doc.templates.items) add(`tmpl:${c.id}`, c.insert, "textbook");
  for (const c of doc.relations.items) add(`rel:${c.id}`, c.insert, "textbook");
  return out;
}
const TEMPLATES = collect();

// ---- scenarios ------------------------------------------------------------------------------------------------------
type Op = { kind: "type"; text: string } | { kind: "insert"; latex: string } | { kind: "cmd"; name: string };
type Scenario = "empty" | "content" | "fromEnd" | "boxStart" | "delFromStart" | "delBeforeClose" | "nested";
const SCENARIOS: Scenario[] = ["empty", "content", "fromEnd", "boxStart", "delFromStart", "delBeforeClose", "nested"];
const MAX_DELETES = 16;

function setup(s: Scenario, latex: string): { ops: Op[]; del: "deleteBackward" | "deleteForward" } {
  const t = (text: string): Op => ({ kind: "type", text });
  const ins: Op = { kind: "insert", latex };
  const c = (name: string): Op => ({ kind: "cmd", name });
  switch (s) {
    case "empty": return { ops: [ins], del: "deleteBackward" };
    case "content": return { ops: [t("5"), ins, t("2")], del: "deleteBackward" };
    case "fromEnd": return { ops: [t("5"), ins, t("2"), c("moveToMathfieldEnd")], del: "deleteBackward" };
    case "boxStart": return { ops: [t("5"), ins, t("23"), c("moveToPreviousChar"), c("moveToPreviousChar")], del: "deleteBackward" };
    case "delFromStart": return { ops: [t("5"), ins, t("2"), c("moveToMathfieldStart")], del: "deleteForward" };
    case "delBeforeClose": return { ops: [ins, t("2")], del: "deleteForward" };
    case "nested": return { ops: [ins, ins], del: "deleteBackward" };
  }
}

interface Snap { value: string; pos: number; last: number; sel: string; parsed: string }
interface Run { setup: Snap; steps: Snap[] }

/** Run a scenario in the page: set up, then delete until the line is empty (at most MAX_DELETES presses). */
async function runScenario(page: Page, tmpl: Tmpl, ops: Op[], del: string): Promise<Run> {
  return page.evaluate(
    async ([mode, opsIn, delName, max]) => {
      const p = window.pascaline;
      const mf = p.entry.field;
      if (!mf) throw new Error("no field");
      p.session.setEntry(mode as "textbook" | "line");
      mf.value = "";
      mf.focus();
      const parser = (await (0, eval)('import("/src/input/parser.ts")')) as {
        loadParser: () => Promise<{ latexToGiac: (l: string) => string }>;
      };
      const mod = await parser.loadParser();
      const snap = (): Snap => {
        let parsed: string;
        try {
          parsed = mod.latexToGiac(mf.value);
        } catch (e) {
          parsed = `parser: ${(e as Error).message}`;
        }
        return { value: mf.value, pos: mf.position, last: mf.lastOffset, sel: JSON.stringify(mf.selection.ranges), parsed };
      };
      for (const o of opsIn as unknown[]) p.entry.run(o as never);
      const first = snap();
      const steps: Snap[] = [];
      for (let i = 0; i < (max as number) && mf.value !== ""; i++) {
        p.entry.run({ kind: "cmd", name: delName as string });
        const now = snap();
        const before = steps.at(-1) ?? first;
        steps.push(now);
        // a press that changed nothing ends the run (the checks below say whether that was allowed)
        if (now.value === before.value && now.pos === before.pos && now.sel === before.sel) break;
      }
      return { setup: first, steps };
    },
    [tmpl.mode, ops, del, MAX_DELETES] as const,
  );
}

// ---- the checks -----------------------------------------------------------------------------------------------------
const MARK_RE = new RegExp(
  [
    String.raw`\\left[(|.]`,
    String.raw`\\right[)|.]`,
    String.raw`\\(?:sin|cos|tan|arcsin|arccos|arctan|ln|log|exponentialE|sqrt|frac|tfrac|partial|lim|int|sum|prod|to|degree|prime|doubleprime|div|operatorname|begin|end)(?![A-Za-z])`,
    String.raw`\\text\{if \}`,
    String.raw`\\mathrm\{d\}`,
    String.raw`\\char"5E`,
    String.raw`\\\\`,
    String.raw`[\^_&,=]`,
  ].join("|"),
  "g",
);
const marksOf = (line: string): Map<string, number> => {
  const m = new Map<string, number>();
  for (const t of line.match(MARK_RE) ?? []) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
};
const count = (line: string, re: RegExp): number => (line.match(re) ?? []).length;

/** Point 1 and 2: what a line must never hold, whatever the template. */
function lineProblems(raw: string): string[] {
  const out: string[] = [];
  const line = raw.replace(/\\placeholder\{\}/g, "□"); // an empty box is a □, not an empty group
  // no half pair: every \left has its \right; a \left. belongs only to the evaluate-at bar; a \right. to nothing
  const lefts = count(line, /\\left[(|[.]/g);
  const rights = count(line, /\\right[)|\].]/g);
  if (lefts !== rights) out.push("half pair");
  if (count(line, /\\left\./g) > count(line, /\\right\|_/g)) out.push("\\left. without an evaluate-at bar");
  if (/\\right\./.test(line)) out.push("\\right.");
  // no exponent or subscript without a base: at the start of the line or of a group, after an operator or a bracket
  if (/(^|[{+\-=,]|\\times|\\div|\\left[(|.]|&)\s*[\^_]/.test(line)) out.push("^ or _ without a base");
  // an emptied bracket body keeps its box: \left(\right) with nothing inside is a lost □ (point 2)
  if (/\\left[(|[.]\s*\\right/.test(line)) out.push("an emptied box without □");
  // no box deleted: an empty group, an empty slot next to a mark, two marks side by side
  if (/\{\}/.test(line)) out.push("empty group");
  if (/[(,]\s*,|,\s*\\right\)|\\left\(\s*,/.test(line)) out.push("EQ without a box");
  if (/(\{|\\to|=)\s*(\\to|=|\})/.test(line.replace(/\\to\}/g, "\\to }"))) out.push("a box lost next to →, = or }");
  if (/\\(degree|prime)\s*\\(prime|doubleprime)|(^|\\doubleprime)\s*\\degree/.test(line)) out.push("a DMS box lost");
  if (/(\\begin\{[a-z]+\}|\\\\|&)\s*(&|\\\\|\\end)/.test(line)) out.push("a matrix or piecewise cell lost");
  if (/\\text\{if \}\s*(\\\\|\\end)/.test(line)) out.push("piecewise condition lost");
  if (/\\partial\}|\\mathrm\{d\}\s*$|\\,\s*\\mathrm\{d\}\s*\}/.test(line)) out.push("∂ or d without its box");
  return out;
}

/** Point 1, lone marks: the marks of the template are all there (in the same ratio) or all gone. */
function markProblem(line: string, base: Map<string, number>): string | undefined {
  if (line === "") return undefined;
  const now = marksOf(line);
  let ratio: number | undefined;
  for (const [mark, n] of base) {
    const r = (now.get(mark) ?? 0) / n;
    if (ratio === undefined) ratio = r;
    else if (Math.abs(r - ratio) > 1e-9) return `lone mark ${mark}: ${now.get(mark) ?? 0} of ${n}`;
  }
  return undefined;
}

function check(s: Scenario, tmpl: Tmpl, base: Map<string, number>, run: Run, del: string): string[] {
  const fails: string[] = [];
  const note = (step: number, snap: Snap, why: string): void => {
    fails.push(`${step === 0 ? "setup" : `step ${step}`} ${snap.value || "(empty)"} [${snap.parsed}]: ${why}`);
  };
  const nBase = new Map([...base].map(([k, v]) => [k, v * (s === "nested" ? 2 : 1)]));
  // the exponent's base: the text before the first ^ right after the template went in (point 6)
  const prefixOf = (v: string): string | undefined => (v.includes("^") ? v.slice(0, v.indexOf("^")) : undefined);
  const isPower = tmpl.bug === "F17";
  const basePrefix = prefixOf(run.setup.value);
  // (a prefix argument #@ takes the 5 into the template, so it is not "before" it)
  const startsWith5 = (s === "content" || s === "fromEnd" || s === "boxStart") && !tmpl.latex.includes("#@");
  const all = [run.setup, ...run.steps];
  all.forEach((snap, i) => {
    for (const p of lineProblems(snap.value)) note(i, snap, p);
    const m = markProblem(snap.value, nBase);
    if (m !== undefined) note(i, snap, m);
    const alive = [...marksOf(snap.value).keys()].some((k) => base.has(k));
    // point 3: while the cursor is in the template, ⌫ never deletes what stands before it
    if (startsWith5 && alive && !snap.value.startsWith("5")) note(i, snap, "the 5 before the template was deleted");
    // point 6: an exponent stays on its base
    if (s !== "nested" && isPower && alive && basePrefix !== undefined) {
      const now = prefixOf(snap.value);
      if (now !== undefined && now !== basePrefix) note(i, snap, `exponent moved from base "${basePrefix}" to "${now}"`);
    }
  });
  // point 8: the line ends empty; no press was a no-op except ⌫ at the start or Del at the end
  const end = run.steps.at(-1) ?? run.setup;
  // (Del before the closing bracket dissolves the template and leaves the cursor after the 2 it kept, where Del has
  // nothing to delete: that scenario ends when no mark of the template is left and only the typed 2 remains)
  const aliveEnd = [...marksOf(end.value).keys()].some((k) => base.has(k));
  // (boxStart: ⌫ at the start of the first box dissolves the template and leaves the typed 23 after the cursor, where
  // ⌫ has nothing to delete: that scenario ends when no mark is left and only the 23 remains)
  const finished =
    s === "delBeforeClose" ? !aliveEnd && (end.value === "" || end.value === "2")
    : s === "boxStart" ? !aliveEnd && (end.value === "" || end.value === "23")
    : end.value === "";
  if (!finished) note(run.steps.length, end, `never reached the empty line in ${MAX_DELETES} presses`);
  run.steps.forEach((snap, i) => {
    const before = i === 0 ? run.setup : (run.steps[i - 1] as Snap);
    const same = snap.value === before.value && snap.pos === before.pos && snap.sel === before.sel;
    const collapsed = JSON.parse(before.sel) .every((r: number[]) => r[0] === r[1]);
    const atEdge = collapsed && (del === "deleteBackward" ? before.pos === 0 : before.pos === before.last);
    if (same && !atEdge) note(i + 1, snap, `${del} did nothing`);
  });
  return fails;
}

// ---- cases that fail today: "name|scenario", removed by the package that fixes them -----------------------------------
const KNOWN_FAIL = new Set<string>([
  "div/shift/line|boxStart",
  "div/shift/line|content",
  "div/shift/line|delFromStart",
  "div/shift/line|fromEnd",
  "div/shift/line|nested",
  "div/shift|boxStart",
  "div/shift|content",
  "div/shift|empty",
  "div/shift|fromEnd",
  "frac/primary|content",
  "frac/primary|delFromStart",
  "frac/primary|fromEnd",
  "frac/primary|nested",
  "ln/shift|boxStart",
  "ln/shift|content",
  "ln/shift|delBeforeClose",
  "ln/shift|delFromStart",
  "ln/shift|empty",
  "ln/shift|fromEnd",
  "ln/shift|nested",
  "log/shift|boxStart",
  "log/shift|content",
  "log/shift|delBeforeClose",
  "log/shift|delFromStart",
  "log/shift|fromEnd",
  "log/shift|nested",
  "pow/primary|boxStart",
  "pow/primary|content",
  "pow/primary|empty",
  "pow/primary|fromEnd",
  "pow/shift|boxStart",
  "pow/shift|content",
  "pow/shift|delBeforeClose",
  "pow/shift|empty",
  "pow/shift|fromEnd",
  "pow/shift|nested",
  "rel:eq|boxStart",
  "rel:eq|content",
  "rel:eq|delBeforeClose",
  "rel:eq|delFromStart",
  "rel:eq|empty",
  "rel:eq|fromEnd",
  "rel:eq|nested",
  "sq/primary|boxStart",
  "sq/primary|content",
  "sq/primary|empty",
  "sq/primary|fromEnd",
  "sq/shift|content",
  "sq/shift|delBeforeClose",
  "sq/shift|fromEnd",
  "sq/shift|nested",
  "tmpl:cases|boxStart",
  "tmpl:cases|content",
  "tmpl:cases|delBeforeClose",
  "tmpl:cases|empty",
  "tmpl:cases|nested",
  "tmpl:colvec|boxStart",
  "tmpl:colvec|content",
  "tmpl:colvec|delBeforeClose",
  "tmpl:colvec|empty",
  "tmpl:colvec|nested",
  "tmpl:deriv|boxStart",
  "tmpl:deriv|content",
  "tmpl:deriv|delBeforeClose",
  "tmpl:deriv|delFromStart",
  "tmpl:deriv|empty",
  "tmpl:deriv|fromEnd",
  "tmpl:deriv|nested",
  "tmpl:dms|boxStart",
  "tmpl:dms|content",
  "tmpl:dms|delBeforeClose",
  "tmpl:dms|delFromStart",
  "tmpl:dms|empty",
  "tmpl:dms|fromEnd",
  "tmpl:dms|nested",
  "tmpl:evalat|content",
  "tmpl:evalat|delFromStart",
  "tmpl:evalat|fromEnd",
  "tmpl:integral|boxStart",
  "tmpl:integral|content",
  "tmpl:integral|delBeforeClose",
  "tmpl:integral|delFromStart",
  "tmpl:integral|empty",
  "tmpl:integral|fromEnd",
  "tmpl:integral|nested",
  "tmpl:limit|content",
  "tmpl:limit|delBeforeClose",
  "tmpl:limit|delFromStart",
  "tmpl:limit|fromEnd",
  "tmpl:limit|nested",
  "tmpl:logbase|content",
  "tmpl:logbase|delBeforeClose",
  "tmpl:logbase|delFromStart",
  "tmpl:logbase|fromEnd",
  "tmpl:matrix22|boxStart",
  "tmpl:matrix22|content",
  "tmpl:matrix22|delBeforeClose",
  "tmpl:matrix22|empty",
  "tmpl:matrix22|nested",
  "tmpl:mixed|boxStart",
  "tmpl:mixed|content",
  "tmpl:mixed|delBeforeClose",
  "tmpl:mixed|delFromStart",
  "tmpl:mixed|empty",
  "tmpl:mixed|fromEnd",
  "tmpl:mixed|nested",
  "tmpl:product|content",
  "tmpl:product|delBeforeClose",
  "tmpl:product|delFromStart",
  "tmpl:product|fromEnd",
  "tmpl:product|nested",
  "tmpl:rowvec|boxStart",
  "tmpl:rowvec|content",
  "tmpl:rowvec|delBeforeClose",
  "tmpl:rowvec|empty",
  "tmpl:rowvec|nested",
  "tmpl:sum|content",
  "tmpl:sum|delBeforeClose",
  "tmpl:sum|delFromStart",
  "tmpl:sum|fromEnd",
  "tmpl:sum|nested",
]);

// ---- the suite ------------------------------------------------------------------------------------------------------
let page: Page;
const baseOf = new Map<string, Map<string, number>>();

test.beforeAll(async ({ browser }) => {
  const port = Number(process.env["PW_PORT"] ?? 5181);
  const ctx = await browser.newContext({ ...devices["Pixel 7"], baseURL: `http://localhost:${port}` });
  page = await ctx.newPage();
  await open(page);
});
test.afterAll(async () => {
  await page.context().close();
});

test("the grid has the templates the keys insert (32 on 2026-10-14)", () => {
  expect(TEMPLATES.length).toBeGreaterThanOrEqual(30);
});

for (const tmpl of TEMPLATES) {
  for (const s of SCENARIOS) {
    const id = `${tmpl.name}|${s}`;
    const title = `${tmpl.bug} ${tmpl.name} (${tmpl.mode}) ${s}`;
    test(title, async () => {
      if (KNOWN_FAIL.has(id)) test.fail();
      const key = `${tmpl.mode}|${tmpl.latex}`;
      if (!baseOf.has(key)) {
        const r = await runScenario(page, tmpl, [{ kind: "insert", latex: tmpl.latex }], "deleteBackward");
        // the marks of the template alone, read before any delete
        baseOf.set(key, marksOf(r.setup.value));
        await page.evaluate(() => {
          if (window.pascaline.entry.field) window.pascaline.entry.field.value = "";
        });
      }
      const { ops, del } = setup(s, tmpl.latex);
      const run = await runScenario(page, tmpl, ops, del);
      const fails = check(s, tmpl, baseOf.get(key) as Map<string, number>, run, del);
      // GRID_OUT=<file>: append the id of every failing case (to regenerate KNOWN_FAIL)
      const out = process.env["GRID_OUT"];
      if (out !== undefined && fails.length > 0) appendFileSync(out, `${id}\n`);
      if (process.env["GRID_PROBE"] !== undefined && fails.length > 0) console.log(`FAIL ${id}\n  ${fails.slice(0, 4).join("\n  ")}`);
      if (fails.length > 0) throw new Error(fails.slice(0, 6).join("\n"));
    });
  }
}
