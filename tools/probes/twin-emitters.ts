// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (structure audit, 2026-10-20): one parse tree, two emitters. The Function app compiles each definition once
// (app/src/apps/function/compile.ts): our parser's tree goes to Giac text (input/emit.ts) for every number shown, and
// to a JS function (input/emit-js.ts) for the drawing. This runs every tests/golden/parser.yaml LaTeX that both
// emitters accept through both, at a few x in RAD and DEG, and prints where the drawing and the engine disagree:
// a value against no value (NaN, a refusal), or values more than 1e-9 apart (relative). The engine side is Home
// (12 digits) on `subst(<giac>,x=<v>)`, as the Num table and trace read it.
//   GIAC_OUT=<dir> node tools/probes/twin-emitters.ts [--all]   # --all: print every compared case, not only differences
// Read-only; no network.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";
import { compileDefinition } from "../../app/src/apps/function/compile.ts";

const require = createRequire(new URL("../../app/package.json", import.meta.url));
const { parse } = require("yaml") as { parse: (s: string) => unknown };
const cases = (parse(readFileSync(new URL("../../tests/golden/parser.yaml", import.meta.url), "utf8")) as { cases: { id: string; latex: string }[] }).cases;
const XS = [-2.7, -1, -0.5, 0.3, 1, 2, 4.5];
const all = process.argv.includes("--all");
const { giac } = await loadNodeGiac();
const host = new EngineHost(giac);

let compared = 0;
let skipped = 0;
const rows: string[] = [];
for (const c of cases) {
  for (const angle of ["rad", "deg"] as const) {
    const k = compileDefinition(c.latex, angle);
    if (!k.giac || !k.fn) {
      skipped++;
      continue;
    }
    compared++;
    const diffs: string[] = [];
    for (const x of XS) {
      const js = k.fn(x);
      const r = host.home(`subst(${k.giac},x=${x})`, { ...defaultHomeSettings, angle }).result;
      const real = r.ok && r.value && r.value.im.digits === "" ? Number(r.display.replace("E", "e")) : undefined;
      const engine = !r.ok ? "refused" : real === undefined ? (r.value ? `complex ${r.display}` : `symbolic ${r.display}`) : real;
      const jsOk = Number.isFinite(js);
      if (typeof engine === "number" && jsOk) {
        if (Math.abs(engine - js) > 1e-9 * Math.max(1, Math.abs(engine))) diffs.push(`x=${x}: engine ${engine}, drawn ${js}`);
      } else if (typeof engine === "number" || jsOk) {
        diffs.push(`x=${x}: engine ${engine}, drawn ${js}`);
      }
    }
    if (diffs.length || all) rows.push(`${c.id} ${angle} ${JSON.stringify(c.latex)} -> ${k.giac}\n    ${diffs.join("\n    ") || "same"}`);
  }
}
console.log(rows.join("\n"));
console.log(`compared ${compared} (case, angle) pairs over ${XS.length} x each; skipped ${skipped} that one emitter refuses; ${rows.filter((r) => !r.endsWith("same")).length} differ`);
