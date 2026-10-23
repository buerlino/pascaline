// SPDX-License-Identifier: GPL-3.0-or-later
// The laptop side of the library file (docs/archive/r10-connector.md section 4): the same check and import as the app
// (app/src/engine/library.ts) on the real engine in Node.
//   node tools/library.ts check <file>              # refuse as the phone would; print each definition and its tests
//   node tools/library.ts run <file> <expr>...      # import, then evaluate the expressions on the result
// Engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl (nodeGiac.ts). Exit 1: refused, 2: usage.
import { readFileSync } from "node:fs";
import { EngineHost } from "../app/src/engine/host.ts";
import { nodeHost } from "../app/src/engine/nodeGiac.ts";
import { importLibrary, LibError, parseLibrary } from "../app/src/engine/library.ts";

const [cmd, path, ...exprs] = process.argv.slice(2);
if ((cmd !== "check" && cmd !== "run") || !path) {
  console.error("usage: node tools/library.ts check <file> | run <file> <expr>...");
  process.exit(2);
}
try {
  const lib = parseLibrary(readFileSync(path));
  const host = (await nodeHost());
  const r = importLibrary(host, lib, []);
  if (!r.ok) {
    console.error(`refused: ${r.error}`);
    for (const f of r.failures ?? []) console.error(`  line ${f.line}: ${f.expr} gave ${f.got}`);
    process.exit(1);
  }
  for (const d of lib.defs) console.log(`${d.kind} ${d.name}: ${d.desc} (${d.tests.length} tests)`);
  console.log(`ok: ${lib.defs.length} definitions, ${r.tests} tests passed, ${r.ms.toFixed(0)} ms`);
  if (cmd === "run") for (const e of exprs) console.log(`${e} = ${host.eval(e).output}`);
} catch (e) {
  if (!(e instanceof LibError)) throw e;
  console.error(`refused: ${e.message}`);
  process.exit(1);
}
