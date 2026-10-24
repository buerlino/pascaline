// SPDX-License-Identifier: GPL-3.0-or-later
// G60 regression test for patch 0005 (MPFR pi in ln and acos, ln forms outside the real domains): Giac's raw evalf at
// Digits 30 of ln of a negative real, asin, acos and acosh of a real outside their domains, and complex acos must
// match mpmath; acosh of a double below -1 must be on the principal branch. Before the patch, ln(-pi) at Digits 30
// printed 1.1447298858494+3.1415926535898*i (a double), asin(pi) and acos(pi) were undef, and acosh(-2.0) was
// 1.31695789692-3.14159265359*i. Needs the engine build (GIAC_OUT or GIAC_MJS, as nodeGiac.ts).
//   GIAC_OUT=<abs dir> node tests/engine/mpfr-pi-test.ts
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";

// [digits, input, mpmath's real and imaginary parts at those digits] (source: oracle; mpmath, mp.dps 60, rounded).
const CASES: [number, string, string, string][] = [
  [30, "ln(-pi)", "1.14472988584940017414342735135", "3.14159265358979323846264338328"],
  [30, "sqrt(-pi)", "0", "1.77245385090551602729816748334"],
  [30, "asin(pi)", "1.57079632679489661923132169164", "-1.81152627246085310702185204931"],
  [30, "acos(pi)", "0", "1.81152627246085310702185204931"],
  [30, "acos(1+i)", "0.904556894302381364127316795662", "-1.06127506190503565203301891621"],
  [30, "acosh(-pi)", "1.81152627246085310702185204931", "3.14159265358979323846264338328"],
  [30, "acosh(-1/2)", "0", "2.09439510239319549230842892219"],
  [12, "acosh(-2.0)", "1.31695789692", "3.14159265359"],
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
  if (!/^-?[\d.]+(e[+-]?\d+)?$/.test(r.trim()) || !/^-?[\d.]+(e[+-]?\d+)?$/.test(i.trim())) {
    failures.push(`${input} at ${digits}: ${r} + ${i}*i, mpmath ${re} + ${im}*i`);
    continue;
  }
  const ref = Math.abs(Number(re)) > Math.abs(Number(im)) ? re : im;
  if (!close(r, re, ref, digits) || !close(i, im, ref, digits)) failures.push(`${input} at ${digits}: ${r} + ${i}*i, mpmath ${re} + ${im}*i`);
}
giac.eval("Digits:=12");
if (failures.length) {
  console.log(`FAIL mpfr-pi-test ${failures.length}\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`PASS mpfr-pi-test: ${CASES.length} values of ln, sqrt, asin, acos and acosh match mpmath`);
