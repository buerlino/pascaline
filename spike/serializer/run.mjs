// SPDX-License-Identifier: GPL-3.0-or-later
// Round-trip test: LaTeX -> MathJSON -> Giac string, then Giac decides whether it equals the intended
// Giac expression: simplify((a)-(b)) == 0, else numeric evaluation at 3 random points.
//   node spike/serializer/run.mjs [filter]      GIAC_OUT=<dir with giac.mjs> (default engine/giac/_out/gsl)
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "../input/node_modules/yaml/dist/index.js";
// PARSER=own uses the hand-written parser (no Compute Engine); default is Compute Engine.
const { latexToGiac } = await import(process.env.PARSER === "own" ? "../../app/src/input/latex-to-giac.ts" : "../input/src/serialize.ts");

const here = dirname(fileURLToPath(import.meta.url));
const giacOut = process.env.GIAC_OUT ?? resolve(here, "../../engine/giac/_out/gsl");
if (!existsSync(join(giacOut, "giac.mjs"))) {
  console.error(`no giac.mjs in ${giacOut}; set GIAC_OUT`);
  process.exit(2);
}
const { default: createGiacModule } = await import(pathToFileURL(join(giacOut, "giac.mjs")).href);
globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
const M = await createGiacModule({ print: () => {}, printErr: () => {} });
M.cwrap("giac_init", "number", [])();
const giac = M.cwrap("giac_eval", "string", ["string"]);

const filter = process.argv[2];
const doc = parse(readFileSync(join(here, "../../app/src/input/roundtrip-cases.yaml"), "utf8"));

// Cases that need a fresh state: Giac keeps assignments, so we never assign in cases.
const randomPoints = () => Array.from({ length: 3 }, () => 0.15 + Math.random() * 1.7);

function equal(a, b) {
  if (a === b) return { ok: true, how: "identical" };
  const ea = giac(a);
  if (ea === giac(b) && !/undef|error/i.test(ea)) return { ok: true, how: "same value" };
  const diff = `(${a})-(${b})`;
  const s = giac(`simplify(${diff})`);
  if (s === "0" || s === "0=0") return { ok: true, how: "simplify" };
  // numeric fallback at 3 random points over the free variables
  const vars = giac(`lname(${diff})`)
    .replace(/[\[\]\s]/g, "")
    .split(",")
    .filter((v) => v && v !== "pi" && v !== "i");
  for (const x of randomPoints()) {
    const at = (e) =>
      vars.length ? `subst(${e},[${vars.join(",")}],[${vars.map((_, j) => (x + j * 0.31).toFixed(6)).join(",")}])` : e;
    const r = giac(`abs(evalf(${at(diff)}))`);
    const scale = Math.max(1, Math.abs(Number(giac(`evalf(${at(`(${b})`)})`))) || 1);
    const v = Number(r) / scale; // relative to the intended value, so huge floats like 6.02e23 compare fairly
    if (!Number.isFinite(v) || v > 1e-8) return { ok: false, how: `numeric diff ${r} (simplify gave ${s.slice(0, 60)})` };
  }
  return { ok: true, how: "numeric" };
}

let pass = 0;
let fail = 0;
let gapOk = 0;
let gapFixed = 0;
const failures = [];
let total = 0;
for (const group of doc.groups) {
  for (const c of group.cases) {
    const [latex, intended] = c;
    const id = `${group.name}:${latex}`;
    if (filter && !id.includes(filter)) continue;
    total++;
    const gap = group.status === "gap";
    let produced;
    let result;
    try {
      produced = latexToGiac(latex);
      result = equal(produced, intended);
    } catch (e) {
      result = { ok: false, how: `serializer: ${e.message}` };
    }
    if (process.env.VERBOSE) console.log(`${gap ? "gap " : "    "}${result.ok ? "ok  " : "FAIL"} ${latex}  ->  ${produced}   [${result.how}]`);
    if (gap) {
      if (result.ok) gapFixed++;
      else gapOk++;
    } else if (result.ok) pass++;
    else {
      fail++;
      failures.push(`FAIL ${id}\n     got ${produced}\n    want ${intended}\n    ${result.how}`);
    }
  }
}
for (const f of failures) console.log(f);
console.log(`\n${total} cases: ${pass} pass, ${fail} fail, known gaps still open ${gapOk}, gaps now passing ${gapFixed}`);
process.exit(fail ? 1 : 0);
