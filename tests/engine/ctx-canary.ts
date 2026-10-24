// SPDX-License-Identifier: GPL-3.0-or-later
// G102 canary (docs/research/structure-hindsight.md 2.4): each of bridge-1's 26 fields (app/src/engine/bridge.ts
// GiacContext) is set through `giac_ctx_set`, then Giac's own getter must print the value set, and the host's context
// set back must read as the host's (flags.ts hostContext). A Giac re-pin that moves, renames or drops a field, or turns a
// setter into another one, fails here. Needs the engine build (GIAC_OUT or GIAC_MJS, as nodeGiac.ts).
//   GIAC_OUT=<abs dir> node tests/engine/ctx-canary.ts
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { contextDiff, hostContext } from "../../app/src/engine/flags.ts";
import type { GiacContext } from "../../app/src/engine/bridge.ts";

// field, a value other than the host's, Giac's getter, what it prints. cas_setup() is [approx_mode, complex_variables,
// complex_mode, angle (1 rad, 0 deg, 2 grad), scientific_format, [epsilon, proba_epsilon], Digits, [threads, recursion,
// debug, eval_level], increasing_power, with_sqrt, all_trig_solutions, integer_mode] (prog.cc cas_setup).
const CASES: [keyof GiacContext, number | boolean | string, string, string][] = [
  ["angle_mode", 1, "cas_setup()[3]", "0"],
  ["angle_mode", 2, "cas_setup()[3]", "2"],
  ["angle_radian", false, "angle_radian", "0"],
  ["approx_mode", true, "cas_setup()[0]", "1"],
  ["complex_variables", true, "cas_setup()[1]", "1"],
  ["complex_mode", true, "cas_setup()[2]", "1"],
  ["scientific_format", 1, "cas_setup()[4]", "1"],
  ["epsilon", 1e-9, "epsilon", "1e-09"],
  ["proba_epsilon", 1e-10, "proba_epsilon", "1e-10"],
  ["decimal_digits", 20, "Digits", "20"],
  ["eval_level", 10, "eval_level()", "10"],
  ["increasing_power", true, "cas_setup()[8]", "1"],
  ["withsqrt", false, "cas_setup()[9]", "0"],
  ["all_trig_sol", true, "cas_setup()[10]", "1"],
  ["integer_mode", false, "cas_setup()[11]", "0"],
  ["integer_format", 16, "integer_format()", "0x10"],
  ["xcas_mode", 1, "xcas_mode()", "1"],
  ["calc_mode", 1, "calc_mode()", "1"],
  ["python_compat", 1, "python_compat()", "1"],
  ["keep_algext", true, "keep_algext()", "1"],
  ["auto_assume", true, "auto_assume()", "1"],
  ["parse_e", true, "parse_e()", "1"],
  ["convert_rootof", false, "convert_rootof()", "0"],
  ["ntl_on", false, "ntl_on()", "0"],
  ["step_infolevel", 1, "step_infolevel()", "1"],
  ["prog_eval_level", 3, "prog_eval_level()", "3"],
  ["autosimplify", "simplify", "autosimplify()", "'simplify'"],
];

const { giac, bridge } = await loadNodeGiac();
const host = hostContext(12);
const fails: string[] = [];
const untested = Object.keys(host).filter((k) => !CASES.some((c) => c[0] === k));
if (untested.length) fails.push(`fields with no case: ${untested.join(", ")}`);
for (const [field, value, getter, printed] of CASES) {
  const before = giac.eval(getter);
  const r = bridge.ctxSet({ [field]: value });
  const got = giac.eval(getter);
  const back = bridge.ctxSet(host);
  const left = "error" in back ? [back.error] : contextDiff(back, host);
  if ("error" in r) fails.push(`${field}: giac_ctx_set refused ${JSON.stringify(value)}: ${r.error}`);
  else if (got !== printed) fails.push(`${field}=${JSON.stringify(value)}: ${getter} printed ${got} (was ${before}), not ${printed}`);
  if (left.length) fails.push(`${field}: the host's context set back differs in ${left.join(", ")}`);
}
if (fails.length) {
  for (const f of fails) console.log(`FAIL: ${f}`);
  process.exit(1);
}
console.log(`ctx canary: ${CASES.length} sets over ${Object.keys(host).length} fields, each printed by Giac's getter and set back`);
