// SPDX-License-Identifier: GPL-3.0-or-later
// G92 canary (F64): raw Giac still leaves an assumption after the commands of app/src/engine/assumed.ts ASSUMING_WORDS,
// which is why the host reads and puts them back after such an input. `simplify` sets assume(x>0) for a fractional power
// and keeps it when its work throws (subst.cc:2419, 2802 of the pinned tarball); fourier_an leaves assume(n,integer).
// When Giac stops leaving them, this fails: the read after the input may then go (and the words with it).
// Needs the engine build (GIAC_OUT or GIAC_MJS, as nodeGiac.ts).
//   GIAC_OUT=<abs dir> node tests/engine/assume-canary.ts
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";

const { giac } = await loadNodeGiac();
// the input, the name, what about() prints after it on a fresh name
const CASES: [string, string, string][] = [
  ["simplify(integrate(tanh(sqrt(x)),x))", "x", "assume[[],[line[0,+infinity]],[0]]"],
  ["fourier_an(x^2,x,2*pi,n,0)", "n", "assume[integer]"],
];
const fails: string[] = [];
for (const [input, name, left] of CASES) {
  giac.eval(`purge(${name})`);
  const before = giac.eval(`about(${name})`);
  giac.eval(input);
  const got = giac.eval(`about(${name})`);
  if (before !== name) fails.push(`${name} was not free before ${input}: ${before}`);
  else if (got !== left) fails.push(`${input}: about(${name}) is ${got}, not ${left}: Giac no longer leaves the assumption (G92)`);
  giac.eval(`purge(${name})`);
}
if (fails.length) {
  for (const f of fails) console.log(`FAIL: ${f}`);
  process.exit(1);
}
console.log(`assume canary: ${CASES.length} inputs still leave their assumption in raw Giac`);
