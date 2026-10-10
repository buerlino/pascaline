// SPDX-License-Identifier: GPL-3.0-or-later
// Robustness: random token soup must either parse or throw SerializeError (never another exception, never hang).
//   node spike/serializer/fuzz-parser.mjs [iterations]
import { latexToGiac, SerializeError } from "../input/src/serialize-light.ts";

const pieces = ["1", "2.5", "x", "y", "+", "-", "\\times", "\\div", "^", "_", "{", "}", "\\left(", "\\right)", "(", ")", "\\frac", "\\sqrt",
  "\\sin", "\\ln", "\\int", "dx", "d", "\\sum", "\\lim", "\\to", "=", ",", "\\begin{pmatrix}", "\\end{pmatrix}", "&", "\\\\", "\\pi", "!", "\\%",
  "\\circ", "\\left|", "\\right|", "\\operatorname{foo}", "\\mathrm{d}", "[", "]", "\\unknown", ".", "\\,", "e", "i"];
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const N = Number(process.argv[2] ?? 20000);
let ok = 0, rejected = 0, crashed = 0;
for (let i = 0; i < N; i++) {
  const len = 1 + Math.floor(rnd() * 12);
  let s = "";
  for (let k = 0; k < len; k++) s += pieces[Math.floor(rnd() * pieces.length)] + (rnd() < 0.3 ? " " : "");
  const t = performance.now();
  try {
    latexToGiac(s);
    ok++;
  } catch (e) {
    if (e instanceof SerializeError) rejected++;
    else {
      crashed++;
      if (crashed <= 10) console.log(`CRASH on ${JSON.stringify(s)}: ${e?.stack?.split("\n").slice(0, 2).join(" | ")}`);
    }
  }
  if (performance.now() - t > 200) console.log(`SLOW (${(performance.now() - t).toFixed(0)} ms) on ${JSON.stringify(s)}`);
}
console.log(`${N} inputs: ${ok} parsed, ${rejected} rejected cleanly, ${crashed} crashed`);
process.exit(crashed ? 1 : 0);
