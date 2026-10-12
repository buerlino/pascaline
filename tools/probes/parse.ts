// SPDX-License-Identifier: GPL-3.0-or-later
// Probe: what our LaTeX parser (P1) sends to Giac for keyboard LaTeX, or why it refuses.
//   node tools/probes/parse.ts '0xFF' '4.7k' '\operatorname{par}\left(4.7,10\right)'
import { latexToGiac } from "../../app/src/input/latex-to-giac.ts";

for (const s of process.argv.slice(2)) {
  try {
    console.log(JSON.stringify(s), "=>", JSON.stringify(latexToGiac(s)));
  } catch (e) {
    console.log(JSON.stringify(s), "=> ERROR", (e as Error).message);
  }
}
