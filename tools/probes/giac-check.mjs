// SPDX-License-Identifier: GPL-3.0-or-later
// A19: Giac's own check/ suite on our engine. Each input of check/test<set> runs through giac.eval and is compared with the
// matching answer of check/<set>.out: equal; equivalent (simplify of the difference is 0, for integrals the derivative of
// the difference; else a numeric check at x = 0.37, 1.73, 2.9); or different. Different ones are listed in
// tests/golden/giaccheck-known.yaml (id "<set>#<n>", reason); a new one, or a known one that no longer differs, fails.
//   GIAC_OUT=<dir> node tools/probes/giac-check.mjs [set …]    (GIAC_MJS=<giac.mjs> picks a build; GIAC_OUT=…/release the release one)
//   --list   print every difference     --write   write the known file for today's differences (reason "TODO")
import { readFileSync, writeFileSync } from "node:fs";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { compare, diffCommand, nearZero, numericCommand, NUMERIC_POINTS } from "./giaccheck/lib.ts";
import { SETS, loadSet, tarballPath } from "./giaccheck/suite.ts";

const args = process.argv.slice(2);
const sets = args.filter((a) => !a.startsWith("--"));
const knownFile = new URL("../../tests/golden/giaccheck-known.yaml", import.meta.url);
const tarball = tarballPath();
if (!tarball) {
  console.log("GIACCHECK FAILED: no Giac source tarball (PASCALINE_DL_DIR or GIAC_CHECK_TARBALL)");
  process.exit(1);
}
const { giac } = await loadNodeGiac();
giac.eval("timeout 10");
const run = (s) => {
  try {
    return giac.eval(s).trim();
  } catch (e) {
    return `error: ${e}`;
  }
};
const equivalent = (input) => (got, expected) => {
  if (got === "" || expected === "" || /^error|undef/.test(got)) return false;
  if (run(diffCommand(input, got, expected)) === "0") return true;
  return NUMERIC_POINTS.every((x) => nearZero(run(numericCommand(got, expected, x))));
};
const t0 = performance.now();
const n = { inputs: 0, equal: 0, equivalent: 0, different: 0 };
const differ = [];
for (const set of sets.length ? sets : SETS) {
  run("restart");
  run("timeout 10");
  for (const p of loadSet(tarball, set)) {
    n.inputs++;
    if (p.expected === null) { n.different++; differ.push({ id: p.id, input: p.input, got: "", expected: "(no answer in the .out)" }); continue; }
    const got = run(p.input);
    const o = compare(p.input, got, p.expected, equivalent(p.input));
    n[o]++;
    if (o === "different") differ.push({ id: p.id, input: p.input, got, expected: p.expected });
  }
}
const secs = ((performance.now() - t0) / 1000).toFixed(0);
// the known file is flat (id, reason per entry), read without a YAML package (tools/ has none)
const known = new Map();
for (const m of readFileSync(knownFile, "utf8").matchAll(/- id: "([^"]+)"\n\s+reason: (".*")/g)) known.set(m[1], JSON.parse(m[2]));
if (args.includes("--write")) {
  const lines = ["# A19: inputs of Giac's check/ suite whose answer differs from check/<set>.out on our build (id = <set>#<n>, n from 1).", "# Each needs a reason; tools/probes/giac-check.mjs fails on a new difference and on a listed one that no longer differs.", "known:"];
  for (const d of differ) {
    const id = d.got.includes("window is not defined") ? `${d.id.split("#")[0]}#/window is not defined/` : d.id;
    if (!lines.some((l) => l.includes(`"${id}"`))) lines.push(`  - id: "${id}"`, `    reason: ${JSON.stringify(known.get(id) ?? known.get(d.id) ?? "TODO")}`);
  }
  writeFileSync(knownFile, lines.join("\n") + "\n");
  console.log(`wrote ${differ.length} differences`);
}
// an id "<set>#/regex/" covers every difference of that set whose answer matches the regex
const covers = (k, d) => (k.includes("#/") ? d.id.startsWith(k.split("#/")[0] + "#") && new RegExp(k.slice(k.indexOf("#/") + 2, -1)).test(d.got) : k === d.id);
const fresh = differ.filter((d) => ![...known.keys()].some((k) => covers(k, d)));
const gone = [...known.keys()].filter((k) => !known.get(k).startsWith("random:") && !differ.some((d) => covers(k, d)) && (!sets.length || sets.includes(k.split("#")[0])));
if (args.includes("--list")) for (const d of differ) console.log(`  DIFF ${d.id} ${d.input.slice(0, 80)}\n    got      ${d.got.slice(0, 100)}\n    expected ${d.expected.slice(0, 100)}`);
for (const d of fresh) console.log(`  NEW ${d.id}: ${d.input.slice(0, 80)} -> ${d.got.slice(0, 80)} (expected ${d.expected.slice(0, 80)})`);
for (const k of gone) console.log(`  GONE ${k}: no longer differs, drop it from the known file`);
const ok = fresh.length === 0 && gone.length === 0;
console.log(`GIACCHECK ${ok ? "PASSED" : "FAILED"}: ${n.inputs} inputs, ${n.equal} equal, ${n.equivalent} equivalent, ${n.different} different (${differ.length - fresh.length} known, ${fresh.length} new, ${gone.length} gone), ${secs} s`);
process.exit(ok ? 0 : 1);
