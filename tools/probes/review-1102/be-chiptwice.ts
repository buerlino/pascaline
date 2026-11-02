// SPDX-License-Identifier: GPL-3.0-or-later
// be hunter probe (night review 2026-11-02): a unit result chip with σ (R61's shape: value, unc, unit) used twice in
// the unit view, through the real parser (units mode, the view's chip table) and EngineHost.units, as view.ts request()
// builds it. decisions.md R61: "one chip used twice is one input" — so chip − chip must have σ 0, chip·chip σ 2·x·σx.
//   FIND_INDEX_JSON=app/src/find/_gen/find-index.json GIAC_OUT=engine/giac/_out/gsl \
//     node tools/probes/review-1102/be-chiptwice.ts
import { readFileSync } from "node:fs";
const W = new URL("../../..", import.meta.url).pathname.replace(/\/$/, ""); // the checkout this file is in
const { latexToGiacInfo } = await import(`${W}/app/src/input/latex-to-giac.ts`);
const { EngineHost } = await import(`${W}/app/src/engine/host.ts`);
const { loadNodeGiac } = await import(`${W}/app/src/engine/nodeGiac.ts`);
const { defaultHomeSettings } = await import(`${W}/app/src/engine/homeEval.ts`);
const { buildJob } = await import(`${W}/app/src/units/build.ts`);
const { factorTable } = await import(`${W}/app/src/units/factors.ts`);
const { unitErrorMessage, unitWhyText } = await import(`${W}/app/src/units/messages.ts`);
const { isUnitError } = await import(`${W}/app/src/units/types.ts`);

const table = factorTable(JSON.parse(readFileSync(process.env.FIND_INDEX_JSON ?? `${W}/app/src/find/_gen/find-index.json`, "utf8")));
const { giac, bridge } = await loadNodeGiac();
const host = new EngineHost(giac, bridge);
// R61's chip of `12.34 ± 0.05 m` (no unit field: the slot is left empty, a plain number with σ)
const chips = { "res:1": { value: "12.34", unc: "0.05", exact: true, approximate: false } };
const cases = [
  "\\res{1}{12.34}",
  "\\res{1}{12.34}-\\res{1}{12.34}",
  "\\res{1}{12.34}\\cdot\\res{1}{12.34}",
  "\\left(\\res{1}{12.34}\\right)^2",
  "\\frac{\\res{1}{12.34}}{\\res{1}{12.34}}",
  "12.34\\pm0.05-\\left(12.34\\pm0.05\\right)",
];
for (const latex of process.argv.length > 2 ? process.argv.slice(2) : cases) {
  let r;
  try {
    r = latexToGiacInfo(latex, { units: true, chips });
  } catch (e) {
    console.log(latex, "=> parse error", (e as Error).message);
    continue;
  }
  const u = r.units ?? { slots: [], consts: [] };
  const req = { formula: r.giac, slots: [], ...(u.consts.length ? { consts: u.consts } : {}) };
  const job = buildJob(req, table);
  const q = isUnitError(job) ? job : host.units(job, { ...defaultHomeSettings });
  if (isUnitError(q)) {
    console.log(latex, "->", r.giac, "=> refused", unitErrorMessage(q));
    continue;
  }
  console.log(latex, "->", r.giac, "=>", q.value.display, q.unc ? `σ ${q.unc.text} shown "${q.unc.shown}"${q.unc.why ? ` ⚠ ${unitWhyText(q.unc.why)}` : ""}` : "(no σ)");
}
