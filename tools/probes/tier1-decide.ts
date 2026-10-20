// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (G71, bug hunt N8): which Find tier-1 functions make a numeric decision inside the exact evaluation. Each one
// is called on x = sin(10^70) and on x·10^12 in raw Giac at Digits P = 40 and at P + 40 = 80. At P the MPFR argument
// 10^70 is not exact (5^70 needs 163 bits), so sin(10^70) is wrong there (-0.5387…, right -0.1481…): a function whose
// exact text (no float in it, no error) differs between the two precisions decided on the wrong value at P. Texts
// that differ between two runs at P (random functions) are left out. Each deciding function is then marked as covered
// when Home's G38 second decision runs for that input (restsOnDecision: a DECISION_FUNCTIONS name, a comparison, or
// abs( in the result), and Home's display is shown next to the P + 40 text.
//   node tools/probes/tier1-decide.ts            # every tier-1 function of app/src/find/_gen/find-index.json (npm run index)
//   node tools/probes/tier1-decide.ts trunc sign # these names only
// Engine: as tools/probes/engine.ts. Functions run in child processes in batches; a batch that does not answer within
// BATCH_MS is stopped and the function it was on is listed as "no answer".
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";

const P = 40;
const ARGS = ["sin(10^70)", "sin(10^70)*10^12"];
const BATCH = 40;
const BATCH_MS = 60_000;
// Commands that change the session (settings, names, the random seed) or wait: they would spoil the calls after them.
const SKIP = new Set([
  "restart", "reset", "purge", "assume", "additionally", "about", "Digits", "DIGITS", "cas_setup", "angle_radian", "complex_mode",
  "approx_mode", "all_trig_solutions", "threads", "srand", "randseed", "RandSeed", "kill", "set_language", "maple_mode",
  "rm_all_vars", "rm_a_z", "Pause", "sleep", "WAIT", "wait", "local", "sto", "unassign", "increasing_power", "epsilon",
  "integer_format", "complex_variables", "keep_algext", "series_flags", "step_infolevel", "proba_epsilon", "sq_degree",
]);

const self = fileURLToPath(import.meta.url);
const hasFloat = (t: string): boolean => /(?<![A-Za-z_0-9.])(?:\d+\.\d*|\.\d+|\d+(?=e[+-]?\d))(?:e[+-]?\d+)?/.test(t);
const isError = (t: string): boolean => t.startsWith("GIAC_ERROR");

interface Row {
  name: string;
  arg: string;
  atP: string;
  atP40: string;
}

if (process.argv[2] === "--child") {
  const { giac } = await loadNodeGiac();
  for (const name of process.argv.slice(3)) {
    console.log(`START ${name}`);
    for (const arg of ARGS) {
      const at = (d: number): string => {
        giac.eval(`Digits:=${d}`);
        const t = giac.eval(`${name}(${arg})`).trim();
        giac.eval("Digits:=12");
        return t;
      };
      const a = at(P);
      const again = at(P);
      const b = at(P + 40);
      if (a === again && a !== b && !isError(a) && !isError(b) && !hasFloat(a) && !hasFloat(b)) {
        console.log(`ROW ${JSON.stringify({ name, arg, atP: a, atP40: b } satisfies Row)}`);
        break;
      }
    }
    console.log(`DONE ${name}`);
  }
  process.exit(0);
}

let names = process.argv.slice(2);
if (!names.length) {
  const index = fileURLToPath(new URL("../../app/src/find/_gen/find-index.json", import.meta.url));
  if (!existsSync(index)) throw new Error("no Find index: run `npm run index` in app/ first");
  const items = JSON.parse(readFileSync(index, "utf8")) as { id: string; kind: string; tier?: number }[];
  names = items.filter((i) => i.kind === "fn" && i.tier === 1).map((i) => i.id.slice(3));
}
const skipped = names.filter((n) => SKIP.has(n));
let todo = names.filter((n) => !SKIP.has(n) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(n));
const rows: Row[] = [];
const silent: string[] = [];
while (todo.length) {
  const batch = todo.slice(0, BATCH);
  const r = spawnSync(process.execPath, [self, "--child", ...batch], { encoding: "utf8", timeout: BATCH_MS, maxBuffer: 64 << 20 });
  const done = new Set<string>();
  let started: string | null = null;
  for (const line of (r.stdout ?? "").split("\n")) {
    if (line.startsWith("START ")) started = line.slice(6);
    else if (line.startsWith("DONE ")) done.add(line.slice(5));
    else if (line.startsWith("ROW ")) rows.push(JSON.parse(line.slice(4)) as Row);
  }
  const stuck = started !== null && !done.has(started) ? started : null;
  if (stuck) silent.push(stuck);
  if (!stuck && done.size === 0) {
    silent.push(batch[0]!); // the child died before its first name
    todo = todo.slice(1);
    continue;
  }
  todo = todo.filter((n) => !done.has(n) && n !== stuck);
}

// Covered: the G38 second decision runs for this input in Home.
const { EngineHost } = await import("../../app/src/engine/host.ts");
const { defaultHomeSettings } = await import("../../app/src/engine/homeEval.ts");
const { restsOnDecision } = await import("../../app/src/engine/decisions.ts");
const { markOf } = await import("../../app/src/engine/format.ts");
const { giac } = await loadNodeGiac();
const host = new EngineHost(giac);
const cut = (t: string): string => (t.length > 60 ? `${t.slice(0, 57)}...` : t);
console.log(`tier-1 functions: ${names.length}; skipped (change the session): ${skipped.length}; no answer within ${BATCH_MS / 1000} s: ${silent.length ? silent.join(", ") : "none"}`);
console.log(`deciding on ${ARGS.join(" or ")} (Digits ${P} against ${P + 40}): ${rows.length}`);
console.log("| function | input | at P | at P + 40 | G38 runs | Home shows |");
console.log("|---|---|---|---|---|---|");
for (const row of rows) {
  const input = `${row.name}(${row.arg})`;
  const covered = restsOnDecision(input, row.atP);
  const r = host.home(input, defaultHomeSettings).result;
  const m = r.ok ? markOf(r, { format: "STD", digits: defaultHomeSettings.digits }) : null;
  const shown = r.ok ? `${m ? `${m.mark}${m.n !== undefined ? ` ${m.n}` : ""} ` : ""}${r.display}` : `error ${r.error ?? ""}`;
  console.log(`| ${row.name} | \`${input}\` | ${cut(row.atP)} | ${cut(row.atP40)} | ${covered ? "yes" : "**no**"} | ${cut(shown)} |`);
}
