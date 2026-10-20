// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S11, docs/research/r17-unit-result.md): what the unit result view has to show, from the real evaluator.
// Each case runs through buildJob and EngineHost.units as the golden gate's units stage does (app/scripts/unit-case.ts
// syntax: {k:m / h} a slot, {=c} a constant, pasupm(v,σ) a ± value), and prints the Quantity: the display, the mark
// (markOf at 12 digits), the unit, the dimension, the SI text, σ with its why, the note, or the refusal's message.
// Then, per dimension met, the alternatives the Find index offers: every unit of that dimension, ordered by S5's
// measured weights (tools/probes/unit-weights.yaml), then Find's tier, with the value in each (exact, Giac).
//
//   node tools/probes/unit-result.ts                     the cases below
//   node tools/probes/unit-result.ts '72*{k:m / h}' 'm/s'  one input, optionally with an end slot
//   ALTS=12 node tools/probes/unit-result.ts             more alternatives per dimension (default 8)
//
// Engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl. Index: $FIND_INDEX_JSON, else
// app/src/find/_gen/find-index.json (npm run index). Only erasable TypeScript syntax.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EngineHost } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings } from "../../app/src/engine/homeEval.ts";
import { markOf } from "../../app/src/engine/format.ts";
import type { IndexItem } from "../../app/src/find/types.ts";
import { buildJob } from "../../app/src/units/build.ts";
import { factorTable } from "../../app/src/units/factors.ts";
import { dimensionText } from "../../app/src/units/dims.ts";
import { unitErrorMessage, unitNoteText, unitWhyText } from "../../app/src/units/messages.ts";
import { isUnitError } from "../../app/src/units/types.ts";
import { requestOf } from "../../app/scripts/unit-case.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const indexFile = process.env.FIND_INDEX_JSON ?? join(root, "app/src/find/_gen/find-index.json");
if (!existsSync(indexFile)) {
  console.error(`no Find index at ${indexFile}: run npm run index, or set FIND_INDEX_JSON`);
  process.exit(2);
}
const items = JSON.parse(readFileSync(indexFile, "utf8")) as IndexItem[];
const table = factorTable(items);

// S5's weights: the share of measured unit uses (Find ids without "unit:").
const weights = new Map<string, number>();
const wtext = readFileSync(join(root, "tools/probes/unit-weights.yaml"), "utf8");
for (const m of wtext.matchAll(/- id: (\S+)\n\s+weight: ([\d.]+)/g)) weights.set(m[1]!, Number(m[2]));

/** [input, end slot, why it is here]. */
const CASES: [string, string | undefined, string][] = [
  ["72*{k:m / h}", "m / s", "t02 with the end slot"],
  ["72*{k:m / h}", undefined, "t02 without: G25 keeps the typed unit"],
  ["2*pi*25*{m:m}", "m", "t04 with the end slot"],
  ["2*pi*25*{m:m}", undefined, "t04 without: mm kept, m is an alternative"],
  ["pasupm(12.34,0.05)*{m}*pasupm(3.2,0.1)*{m}", undefined, "t10"],
  ["4.7*{k:ohm}*10*{k:ohm}/(4.7*{k:ohm}+10*{k:ohm})", undefined, "t01 with units (kΩ kept)"],
  ["2.2*{n:F}*4.7*{k:ohm}", undefined, "t03 with units (RC: SI with a prefix)"],
  ["5*{N}*2*{m}", undefined, "torque stays N·m"],
  ["3*{k:W}*2*{h}", undefined, "two prefixes? kW·h"],
  ["3000*{rpm}*0.1*{m}", "m / s", "G40 note"],
  ["cos(pasupm(0,0.1))", undefined, "G41 ⚠ order2"],
  ["{=c}*1*{s}", undefined, "a constant: exact"],
  ["{=G}*1*{kg}", undefined, "a constant with σ"],
  ["1*{m}+1*{s}", undefined, "a refusal"],
  ["20*{oC}", "oF", "temperature, absolute"],
  ["1*{psi}", undefined, "psi kept; kPa and bar are alternatives"],
];

const args = process.argv.slice(2);
const cases = args.length ? [[args[0]!, args[1], "from the command line"] as [string, string | undefined, string]] : CASES;
const nAlts = Number(process.env.ALTS ?? 8);

const { giac } = await loadNodeGiac();
const host = new EngineHost(giac);
const s = { ...defaultHomeSettings };
const dims = new Map<string, string>(); // dimension → SI text of the last value met

for (const [input, to, why] of cases) {
  const job = buildJob(requestOf(input, to, table), table);
  const q = isUnitError(job) ? job : host.units(job, s);
  const head = `${input}${to ? ` → ${to}` : ""}  (${why})`;
  if (isUnitError(q)) {
    console.log(`${head}\n  refused: ${unitErrorMessage(q)}  [${q.error}]`);
    continue;
  }
  const mark = markOf(q.value, { format: "STD", digits: 12 })?.mark ?? "?";
  const unc = q.unc ? `  σ ${q.unc.text}, shown "${q.unc.shown}"${q.unc.why ? ` ⚠ ${unitWhyText(q.unc.why)}` : ""}` : "";
  const note = q.note ? `  note: ${unitNoteText(q.note)}` : "";
  console.log(`${head}\n  ${mark} ${q.value.display} ${q.unit}   dim ${q.dimensionText ?? "-"} (${q.dimension ?? "-"})   si ${q.si ?? "(absent)"}   exact ${q.value.exact ?? "-"}   ${q.ms.toFixed(1)} ms${unc}${note}`);
  if (q.dimension !== null && q.dimension !== "" && q.si !== undefined) dims.set(q.dimension, q.si);
}

console.log(`\nalternatives per dimension (Find units of the dimension; S5 weight, then tier; value of the last result in each)`);
for (const [dim, si] of dims) {
  const all = items.filter((it) => it.kind === "unit" && it.dim === dim && it.si !== undefined && !it.si.includes("+"));
  const w = (it: IndexItem): number => weights.get(it.id.slice(5)) ?? 0;
  const tier = (it: IndexItem): number => (it as { tier?: number }).tier ?? 9;
  all.sort((a, b) => w(b) - w(a) || tier(a) - tier(b) || a.id.localeCompare(b.id));
  const weighted = all.filter((it) => w(it) > 0).length;
  console.log(`${dimensionText(dim)} (${dim}): ${all.length} units, ${weighted} with a measured weight`);
  for (const it of all.slice(0, nAlts)) {
    const v = giac.eval(`evalf((${si})/(${it.si}),12)`);
    console.log(`  ${it.id.slice(5).padEnd(10)} w ${w(it).toFixed(4)}  tier ${tier(it)}  ${v}`);
  }
}
