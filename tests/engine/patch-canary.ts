// SPDX-License-Identifier: GPL-3.0-or-later
// Canaries of our Giac patches (P19, engine/giac/patches/README.md): each checks that the pinned tarball still has the
// line its patch replaces. A patch whose cause upstream has fixed fails here: then the patch can go at that pin (and
// `patch --forward` would refuse it anyway). Reads the tarball only; no engine, no network.
//   node tests/engine/patch-canary.ts        # PASCALINE_DL_DIR: the tarball cache (default engine/giac/_downloads)
import { SOURCES, member, tarball } from "../../tools/find-index/state.mjs";

// [patch, file in the tarball, the wrong text it replaces, the text near it that locates it]
const CANARIES: [string, string, RegExp, string][] = [
  // complex MPFR tanh returns coth: `gen g=exp(2*e,contextptr); return (g+1)/(g-1);` in tanh's _CPLX branch
  ["0003-complex-tanh-mpfr.patch", "giac-2.1.0/src/usual.cc", /gen g=exp\(2\*e,contextptr\);\s*return \(g\+1\)\/\(g-1\);/, "gen tanh(const gen & e0,GIAC_CONTEXT){"],
  // G82: control_c checks only the clock; nothing counts its calls between the reset and the clock check
  ["0004-caseval-step-budget.patch", "giac-2.1.0/src/global.cc", /caseval_maxtime=15;\s*\}\s*if \(caseval_mod>0\)\{/, "void control_c(){"],
];

const tar = tarball(SOURCES.giac);
const failures: string[] = [];
for (const [patch, file, wrong, near] of CANARIES) {
  const src = member(tar, file);
  const at = src.indexOf(near);
  const body = at < 0 ? "" : src.slice(at, at + 3000);
  if (at < 0) failures.push(`${patch}: "${near}" not found in ${file}`);
  else if (!wrong.test(body)) failures.push(`${patch}: ${file} no longer has the line it fixes (upstream fixed it? drop the patch at this pin)`);
}
if (failures.length) {
  console.log(`FAIL patch-canary\n  ${failures.join("\n  ")}`);
  process.exit(1);
}
console.log(`PASS patch-canary: ${CANARIES.length} patched cause(s) still in the pinned tarball`);
