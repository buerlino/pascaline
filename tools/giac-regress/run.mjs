// SPDX-License-Identifier: GPL-3.0-or-later
// G89: runs pascaline-check.cas and pascaline-known.cas line by line on a Giac build (nodeGiac) and counts.
//   GIAC_OUT=<dir> node tools/giac-regress/run.mjs [file.cas …]     exit 1 when a check line fails or a known line passes
// A line passes when pc() returns 1; a line that errors (or is stopped by the timeout) counts as failed.
import { readFileSync } from "node:fs";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";

const { giac } = await loadNodeGiac();
giac.eval("timeout 120");
const files = process.argv.slice(2).length ? process.argv.slice(2) : ["pascaline-check.cas", "pascaline-known.cas"];
let bad = 0;
for (const f of files) {
  const known = f.includes("known");
  const t0 = performance.now();
  let pass = 0;
  let fail = 0;
  const wrong = [];
  for (const line of readFileSync(new URL(f, import.meta.url), "utf8").split("\n")) {
    if (line.trim() === "" || line.startsWith("//") || line.startsWith("print(")) continue;
    const id = /pc\("([^"]*)"/.exec(line)?.[1];
    const out = giac.eval(line);
    if (id === undefined) continue; // the preamble
    const ok = out.trim().split(",").pop() === "1"; // `Digits:=P:;` answers "Done" first
    if (ok) pass++;
    else fail++;
    if (ok === known || (!ok && !known)) wrong.push(`${id}: ${out.slice(0, 120)}`);
  }
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`${f}: ${pass} passed, ${fail} failed, ${secs} s${known ? " (every line must fail)" : ""}`);
  for (const w of wrong) console.log(`  ${known ? "PASSES" : "FAILS"} ${w}`);
  bad += wrong.length;
}
process.exit(bad ? 1 : 0);
