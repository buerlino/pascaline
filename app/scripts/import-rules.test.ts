// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDirection, checkImportDirection, ENGINE_EXCEPTIONS, importsOf, startReach } from "./import-rules.ts";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exceptionSources = (): Record<string, string> =>
  Object.fromEntries([...new Set(Object.keys(ENGINE_EXCEPTIONS).flatMap((k) => k.split(" -> ")))].map((f) => [f, ""]));
/** Fixture sources holding every named exception's edge (so none reads as stale), plus `extra`. */
function tree(extra: Record<string, string>): Record<string, string> {
  const s = exceptionSources();
  for (const [k] of Object.entries(ENGINE_EXCEPTIONS)) {
    const [from, to] = k.split(" -> ") as [string, string];
    const rel = (to.startsWith("src/units/") ? "../units/" : "./") + to.split("/").pop();
    s[from] = `${s[from] ?? ""}import { x } from "${rel}";\n`;
  }
  for (const [k, v] of Object.entries(extra)) s[k] = k === "src/main.ts" ? v : `${s[k] ?? ""}${v}`;
  return { "src/main.ts": "", ...s };
}

describe("importsOf (G147)", () => {
  it("reads imports, re-exports, bare imports and type imports, not dynamic ones or comments", () => {
    const src = [
      'import { a } from "./a.ts";',
      'import type { B } from "./b.ts";',
      'export * from "./c.ts";',
      'export { d } from "./d.ts";',
      'import "./e.ts";',
      "import {",
      "  f,",
      '} from "./f.ts";',
      'const g = import("./g.ts");',
      ' * import { h } from "./h.ts";',
      '// import { i } from "./i.ts";',
    ].join("\n");
    expect(importsOf(src).map((i) => [i.spec, i.type, i.line])).toEqual([
      ["./a.ts", false, 1],
      ["./b.ts", true, 2],
      ["./c.ts", false, 3],
      ["./d.ts", false, 4],
      ["./f.ts", false, 6],
      ["./e.ts", false, 5],
    ]);
  });
});

describe("startReach (G147)", () => {
  it("follows static value imports, not type imports or import()", () => {
    const s = { "src/main.ts": 'import "./a.ts"; import type { T } from "./t.ts"; const l = import("./lazy.ts");', "src/a.ts": 'import { z } from "./sub/z.ts";', "src/sub/z.ts": "", "src/t.ts": "", "src/lazy.ts": "" };
    expect([...startReach(s)].sort()).toEqual(["src/a.ts", "src/main.ts", "src/sub/z.ts"]);
  });
});

describe("the import direction (G147)", () => {
  it("passes a clean tree", () => expect(checkDirection(tree({})).failures).toEqual([]));
  it("fails when the start chunk reaches a worker-side engine module", () => {
    const v = checkDirection(tree({ "src/main.ts": 'import "./calc/engine.ts";', "src/calc/engine.ts": 'import { defaultHomeSettings } from "../engine/homeEval.ts";', "src/engine/homeEval.ts": "" }));
    expect(v.ok).toBe(false);
    expect(v.failures[0]).toMatch(/src\/calc\/engine\.ts:1: the start chunk reaches src\/engine\/homeEval\.ts/);
  });
  it("lets the start chunk reach the allowed engine modules and a lazy chunk reach any", () => {
    const v = checkDirection(tree({ "src/main.ts": 'import "./calc/engine.ts";', "src/calc/engine.ts": 'import { w } from "../engine/workerEngine.ts"; import("../engine/homeEval.ts"); import type { H } from "../engine/homeEval.ts";', "src/engine/workerEngine.ts": "", "src/engine/homeEval.ts": "" }));
    expect(v.failures).toEqual([]);
  });
  it("fails when a file the start chunk reaches inside engine/ imports a worker-side module", () => {
    const v = checkDirection(tree({ "src/main.ts": 'import "./engine/workerEngine.ts";', "src/engine/workerEngine.ts": 'import { n } from "./numeric.ts";', "src/engine/numeric.ts": "" }));
    expect(v.failures.some((f) => f.includes("src/engine/workerEngine.ts:") && f.includes("numeric.ts"))).toBe(true);
  });
  it.each(["views", "state", "keyboard", "entry", "apps", "render", "input"])("fails when engine/ imports from %s/", (dir) => {
    const v = checkDirection(tree({ "src/engine/host.ts": `import { a } from "../${dir}/a.ts";`, [`src/${dir}/a.ts`]: "" }));
    expect(v.failures.some((f) => f.includes("src/engine/host.ts:") && f.includes(`src/${dir}/a.ts`))).toBe(true);
  });
  it("counts a type-only import from a forbidden folder", () => {
    const v = checkDirection(tree({ "src/engine/host.ts": 'import type { A } from "../state/a.ts";', "src/state/a.ts": "" }));
    expect(v.ok).toBe(false);
  });
  it("lets input/ and state/ import from engine/ (the allowed direction) and engine tests import anything", () => {
    const v = checkDirection(tree({ "src/input/p.ts": 'import { a } from "../engine/angles.ts";', "src/engine/angles.ts": "", "src/engine/x.test.ts": 'import { a } from "../input/p.ts";' }));
    expect(v.failures).toEqual([]);
  });
  it("fails on a named exception nothing uses any more", () => {
    const s = tree({});
    s["src/engine/host.ts"] = "";
    const v = checkDirection(s);
    expect(v.failures.some((f) => f.includes("ENGINE_EXCEPTIONS") && f.includes("host.ts -> src/units/"))).toBe(true);
  });
});

describe("the main-thread side holds no worker evaluator (G163)", () => {
  const workerSide = ["homeEval", "numeric", "host", "converge", "decisions"];
  it.each(workerSide)("fails when a unit-view file (result.ts) or a view imports engine/%s", (m) => {
    for (const from of ["src/units/result.ts", "src/units/row.ts", "src/views/V.svelte", "src/state/s.ts", "src/apps/a.ts"]) {
      const v = checkDirection(tree({ [from]: `import { x } from "../engine/${m}.ts";`, [`src/engine/${m}.ts`]: "" }));
      expect(v.failures.some((f) => f.includes(`${from}:`) && f.includes(`src/engine/${m}.ts`))).toBe(true);
    }
  });
  it("lets the unit evaluator and its worker-side files import them", () => {
    const extra: Record<string, string> = { "src/engine/homeEval.ts": "", "src/engine/numeric.ts": "" };
    for (const f of ["evaluate", "build", "dims", "types", "uncertainty"]) extra[`src/units/${f}.ts`] = 'import { x } from "../engine/homeEval.ts"; import { y } from "../engine/numeric.ts";';
    expect(checkDirection(tree(extra)).failures).toEqual([]);
  });
  it("fails on a unit file that reaches the evaluator through a relative sibling name too (units/ -> engine/homeEval.ts)", () => {
    const v = checkDirection(tree({ "src/units/open.ts": 'import { x } from "../engine/homeEval.ts";', "src/engine/homeEval.ts": "" }));
    expect(v.ok).toBe(false);
  });
  it("follows value imports transitively and reports the chain (units/row.ts -> engine/constUnc.ts -> engine/homeEval.ts)", () => {
    const v = checkDirection(tree({ "src/units/row.ts": 'import { c } from "../engine/constUnc.ts";', "src/engine/constUnc.ts": 'import { h } from "./homeEval.ts";', "src/engine/homeEval.ts": "" }));
    expect(v.ok).toBe(false);
    expect(v.failures).toHaveLength(1);
    expect(v.failures[0]).toContain("src/units/row.ts:1: src/units/row.ts -> src/engine/constUnc.ts -> src/engine/homeEval.ts");
  });
  it("lets the same two-step tree pass when the second import is type-only, or the first is", () => {
    const second = checkDirection(tree({ "src/units/row.ts": 'import { c } from "../engine/constUnc.ts";', "src/engine/constUnc.ts": 'import type { h } from "./homeEval.ts";', "src/engine/homeEval.ts": "" }));
    expect(second.failures).toEqual([]);
    const first = checkDirection(tree({ "src/units/row.ts": 'import type { c } from "../engine/constUnc.ts";', "src/engine/constUnc.ts": 'import { h } from "./homeEval.ts";', "src/engine/homeEval.ts": "" }));
    expect(first.failures).toEqual([]);
  });
  it("walks through the unit worker's own files too (a view -> units/build.ts -> engine/numeric.ts)", () => {
    const v = checkDirection(tree({ "src/views/V.svelte": 'import { b } from "../units/build.ts";', "src/units/build.ts": 'import { n } from "../engine/numeric.ts";', "src/engine/numeric.ts": "" }));
    expect(v.failures.some((f) => f.includes("src/views/V.svelte -> src/units/build.ts -> src/engine/numeric.ts"))).toBe(true);
  });
  it("lets the unit view import the pure modules (precisionFacts.ts, exactLiterals.ts)", () => {
    const v = checkDirection(tree({ "src/units/result.ts": 'import { precisionFacts } from "../engine/precisionFacts.ts"; import { toExactLiterals } from "../engine/exactLiterals.ts";', "src/engine/precisionFacts.ts": "", "src/engine/exactLiterals.ts": "" }));
    expect(v.failures).toEqual([]);
  });
});

describe("the real tree (G147)", () => {
  it("holds the direction, every exception named", () => {
    const v = checkImportDirection(app);
    expect(v.failures).toEqual([]);
  });
});

describe("the engine README (G147)", () => {
  it("names every non-test module of src/engine", () => {
    const readme = readFileSync(resolve(app, "src/engine/README.md"), "utf8");
    const missing = readdirSync(resolve(app, "src/engine")).filter((f) => /\.ts$/.test(f) && !/\.test\.ts$/.test(f) && !readme.includes(`\`${f}\``));
    expect(missing).toEqual([]);
  });
});
