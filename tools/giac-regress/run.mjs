// SPDX-License-Identifier: GPL-3.0-or-later
// G89: runs pascaline-check.cas, pascaline-known.cas and pascaline-patched.cas line by line on a Giac build (nodeGiac) and counts.
//   GIAC_OUT=<dir> node tools/giac-regress/run.mjs [file.cas …]     exit 1 when a check line fails, a known line passes, or a patched line fails on the patched build
// (on a stock build a patched line is expected to fail; one that passes there is reported: patches 0003/0005/0006/0007/0009/0010/0011/0012/0013/0014/0015/0016/0017 may no longer be needed)
// A line passes when pc() returns 1; a line that errors (or is stopped by the timeout) counts as failed.
import { readFileSync } from "node:fs";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";

const { giac } = await loadNodeGiac();
giac.eval("timeout 120");
const counts = {}; // file -> [pass, fail] of the line-by-line run
const files = process.argv.slice(2).length ? process.argv.slice(2) : ["pascaline-check.cas", "pascaline-known.cas", "pascaline-patched.cas"];
let bad = 0;
let isPatched = true;
for (const f of files) {
  const known = f.includes("known");
  const patchedFile = f.includes("patched");
  if (patchedFile) {
    // Canaries of patches 0005 (tests/engine/mpfr-pi-test.ts) and 0003 (tanh-test.ts): the imaginary part of ln(-pi) is pi to 30
    // digits, and tanh(1+i) has the real part 1.0839…; stock Giac prints a double pi and coth.
    giac.eval("Digits:=30");
    const lnPi = giac.eval("im(evalf(ln(-pi)))").trim();
    const tanh = giac.eval("re(evalf(tanh(1+i)))").trim();
    giac.eval("Digits:=12");
    const reim = giac.eval("subst(im(2*sqrt(x)),x,-1)").trim(); // patch 0006: 2 (stock Giac: 0)
    const support = giac.eval("exponential(2,-1)").trim(); // patch 0007: 0 (stock Giac: 2*exp(2))
    const icdf = giac.eval("negbinomial_icdf(3,1/2,1/5)").trim(); // patch 0009: 1 (stock Giac: 0)
    isPatched = lnPi.startsWith("3.14159265358979323846264338328") && tanh.startsWith("1.0839233273386945434757520612") && reim === "2" && support === "0" && icdf === "1";
    console.log(isPatched ? `${f}: these lines fail on stock giac_2.1.0-1; this build is the patched one (our patches 0003, 0005, 0006, 0007, 0009, 0010, 0011, 0012, 0013, 0014, 0015, 0016, 0017), every line must pass` : `${f}: stock build: patched lines expected to fail (ln(-pi) im ${lnPi}, tanh(1+i) re ${tanh})`);
  }
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
    if (patchedFile && !isPatched) {
      if (ok) wrong.push(`${id}: passes on stock, patches 0003/0005/0006/0007/0009/0010/0011/0012/0013/0014/0015/0016/0017 may no longer be needed`);
    } else if (ok === known || (!ok && !known)) wrong.push(`${id}: ${out.slice(0, 120)}`);
  }
  const secs = ((performance.now() - t0) / 1000).toFixed(1);
  console.log(`${f}: ${pass} passed, ${fail} failed, ${secs} s${known ? " (every line must fail)" : ""}`);
  counts[f] = [pass, fail];
  for (const w of wrong) console.log(`  ${known || (patchedFile && !isPatched) ? "PASSES" : "FAILS"} ${w}`);
  bad += wrong.length;
}

// Whole file: each file as one text in a fresh Giac, the way icas reads a file; pasn and pasfail must equal the line counts.
for (const f of files) {
  const t0 = performance.now();
  const { giac: fresh } = await loadNodeGiac();
  fresh.eval("timeout 120");
  const text = readFileSync(new URL(f, import.meta.url), "utf8");
  fresh.eval(text);
  const n = Number(fresh.eval("pasn").trim());
  const failed = Number(fresh.eval("pasfail").trim());
  const [pass, fail] = counts[f];
  const same = n === pass + fail && failed === fail;
  console.log(`${f} as one text: pasn ${n}, pasfail ${failed}, ${((performance.now() - t0) / 1000).toFixed(1)} s${same ? "" : ` DIFFERS from line by line (${pass + fail}, ${fail})`}`);
  if (!same) bad++;
}
process.exit(bad ? 1 : 0);
