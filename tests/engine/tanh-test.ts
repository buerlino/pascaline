// SPDX-License-Identifier: GPL-3.0-or-later
// G75 regression test for patch 0003 (complex MPFR tanh): Giac's raw `evalf(tanh(…))` of a complex float at Digits 30
// and 50 must match mpmath. Before the patch, usual.cc's `_CPLX` branch returned (e^2z+1)/(e^2z-1), which is coth:
// evalf(tanh(1+i)) at Digits 30 printed 0.868014142895924948…-0.217621561854402681…*i. Needs the engine build (GIAC_OUT or
// GIAC_MJS, as nodeGiac.ts).
//   GIAC_OUT=<abs dir> node tests/engine/tanh-test.ts
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";

// [digits, input, mpmath's value at those digits] (source: oracle; tests/golden/oracle.py, mp.dps 60, rounded).
const CASES: [number, string, string, string][] = [
  [30, "tanh(1+i)", "1.08392332733869454347575206121", "0.271752585319511716528843722499"],
  [30, "tanh(i)", "0", "1.55740772465490223050697480746"],
  [30, "tanh(-2-3*i)", "-0.965385879022133124278480269395", "0.0098843750383224937203140343035"],
  [50, "tanh(1+i)", "1.0839233273386945434757520612119717213449675274754", "0.27175258531951171652884372249858892070946411146178"],
];

// A printed decimal (`-0.988e-2`, `1.08`) as [integer mantissa, power of ten].
function dec(s: string): [bigint, number] {
  const m = /^(-?)(\d*)\.?(\d*)(?:e([+-]?\d+))?$/.exec(s.trim());
  if (!m) throw new Error(`not a number: ${s}`);
  return [BigInt(`${m[1]}${m[2]}${m[3]}` || "0"), Number(m[4] ?? 0) - m[3]!.length];
}

// |got - want| ≤ 10^-(digits-3) · |ref|, ref the larger part of the value: right to digits-3 significant digits of the
// complex number (a real part of 0 may print as -0.67e-30, as mpmath's would at its working precision).
function close(got: string, want: string, ref: string, digits: number): boolean {
  const parts = [dec(got), dec(want), dec(ref)];
  const e = Math.min(...parts.map(([, x]) => x));
  const [g, w, r] = parts.map(([m, x]) => (m < 0n ? -m : m) * 10n ** BigInt(x - e) * (m < 0n ? -1n : 1n));
  const d = g! - w!;
  return (d < 0n ? -d : d) * 10n ** BigInt(digits - 3) <= (r! < 0n ? -r! : r!);
}

const { giac } = await loadNodeGiac();
const failures: string[] = [];
for (const [digits, input, re, im] of CASES) {
  giac.eval(`Digits:=${digits}`);
  const r = giac.eval(`re(evalf(${input}))`);
  const i = giac.eval(`im(evalf(${input}))`);
  const ref = Math.abs(Number(re)) > Math.abs(Number(im)) ? re : im;
  if (!close(r, re, ref, digits) || !close(i, im, ref, digits)) failures.push(`${input} at ${digits}: ${r} + ${i}*i, mpmath ${re} + ${im}*i`);
}
giac.eval("Digits:=12");
if (failures.length) {
  console.log(`FAIL tanh-test ${failures.length}\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`PASS tanh-test: ${CASES.length} complex tanh values at 30 and 50 digits match mpmath`);
