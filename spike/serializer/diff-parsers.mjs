// SPDX-License-Identifier: GPL-3.0-or-later
// Differential check: for every case in cases.yaml, compare the Giac text from Compute Engine's parse with the
// one from our own parser. Differences are not necessarily bugs (different but equal text), so Giac decides:
// both strings must evaluate to the same value (or both fail). Prints the differing pairs.
//   GIAC_OUT=<dir> node spike/serializer/diff-parsers.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "../input/node_modules/yaml/dist/index.js";
import { latexToGiac as ce } from "../input/src/serialize.ts";
import { latexToGiac as own } from "../../app/src/input/latex-to-giac.ts";

const here = dirname(fileURLToPath(import.meta.url));
const giacOut = process.env.GIAC_OUT;
const { default: createGiacModule } = await import(pathToFileURL(join(giacOut, "giac.mjs")).href);
globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
const M = await createGiacModule({ print: () => {}, printErr: () => {} });
M.cwrap("giac_init", "number", [])();
const giac = M.cwrap("giac_eval", "string", ["string"]);

const doc = parse(readFileSync(join(here, "cases.yaml"), "utf8"));
const attempt = (f, l) => {
  try {
    return f(l);
  } catch (e) {
    return `ERROR(${e.message.slice(0, 60)})`;
  }
};
let same = 0, equalValue = 0, differ = 0;
for (const g of doc.groups) {
  for (const [latex] of g.cases) {
    const a = attempt(ce, latex);
    const b = attempt(own, latex);
    if (a === b) same++;
    else if (!a.startsWith("ERROR") && !b.startsWith("ERROR") && giac(`simplify((${a})-(${b}))`) === "0") equalValue++;
    else {
      differ++;
      console.log(`${latex}\n   CE : ${a}\n   own: ${b}`);
    }
  }
}
console.log(`\nidentical text ${same}, different text but equal value ${equalValue}, differing ${differ}`);
