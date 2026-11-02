// SPDX-License-Identifier: GPL-3.0-or-later
// be hunter probe (night review 2026-11-02): what the LaTeX parser sends to Giac, Home (default) or units mode
// (UNITS=1), with the decimal comma (COMMA=1 sets decimalComma if the option exists).
//   node tools/probes/review-1102/be-parse.ts '2.5\pm 1\%'
const W = new URL("../../..", import.meta.url).pathname.replace(/\/$/, ""); // the checkout this file is in
const { latexToGiacInfo } = await import(`${W}/app/src/input/latex-to-giac.ts`);
const o: Record<string, unknown> = {};
if (process.env.UNITS === "1") o.units = true;
if (process.env.COMMA === "1") o.decimalComma = true;
for (const s of process.argv.slice(2)) {
  try {
    const r = latexToGiacInfo(s, o);
    console.log(JSON.stringify(s), "=>", JSON.stringify(r.giac), r.inexact ? "(inexact)" : "", r.units ? JSON.stringify(r.units) : "");
  } catch (e) {
    console.log(JSON.stringify(s), "=> ERROR", (e as Error).message);
  }
}
