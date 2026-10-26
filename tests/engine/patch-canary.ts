// SPDX-License-Identifier: GPL-3.0-or-later
// Canaries of our Giac patches (P19, engine/giac/patches/README.md): each checks that the pinned tarball still has the
// line its patch replaces. A patch whose cause upstream has fixed fails here: then the patch can go at that pin (and
// `patch --forward` would refuse it anyway). Reads the tarball only; no engine, no network.
//   node tests/engine/patch-canary.ts        # PASCALINE_DL_DIR: the tarball cache (default engine/giac/_downloads)
import { SOURCES, member, tarball } from "../../tools/find-index/state.mjs";

// [patch, file in the tarball, the wrong text it replaces, the text near it that locates it]
const CANARIES: [string, string, RegExp, string][] = [
  // S17: the EMCC add_evalf hook logs on every caseval (and reads the misspelt UI.addevalf)
  ["0001-gen-remove-add_evalf-debug-log.patch", "giac-2.1.0/src/gen.cc", /console\.log\("gen\.cc add_evalf",UI\.addevalf\);/, "double add_evalf=EM_ASM_DOUBLE_V({"],
  // S17: in EMCC builds control_c compares whole seconds from time(0)
  ["0002-emcc-subsecond-caseval-timeout.patch", "giac-2.1.0/src/global.cc", /if \(difftime\(caseval_current,caseval_begin\)>caseval_maxtime\)/, "void control_c(){"],
  // complex MPFR tanh returns coth: `gen g=exp(2*e,contextptr); return (g+1)/(g-1);` in tanh's _CPLX branch
  ["0003-complex-tanh-mpfr.patch", "giac-2.1.0/src/usual.cc", /gen g=exp\(2\*e,contextptr\);\s*return \(g\+1\)\/\(g-1\);/, "gen tanh(const gen & e0,GIAC_CONTEXT){"],
  // G82: control_c checks only the clock; nothing counts its calls between the reset and the clock check
  ["0004-caseval-step-budget.patch", "giac-2.1.0/src/global.cc", /caseval_maxtime=15;\s*\}\s*if \(caseval_mod>0\)\{/, "void control_c(){"],
  // G60, patch 0005: ln of a negative MPFR real adds the symbolic pi, which meets the MPFR value as a double
  ["0005-mpfr-pi-and-real-domains.patch", "giac-2.1.0/src/usual.cc", /return \(-e\)\._REALptr->log\(\)\+cst_pi\*cst_i;/, "gen ln(const gen & e,GIAC_CONTEXT){"],
  // asin and acos of an MPFR real call MPFR outside [-1,1] (NaN, so undef)
  ["0005-mpfr-pi-and-real-domains.patch", "giac-2.1.0/src/usual.cc", /if \(e\.type==_REAL\)\{\s*if \(angle_radian\(contextptr\)\)\s*return e\._REALptr->asin\(\);/, "gen asin(const gen & e0,GIAC_CONTEXT){"],
  ["0005-mpfr-pi-and-real-domains.patch", "giac-2.1.0/src/usual.cc", /if \(e\.type==_REAL\)\{\s*if \(angle_radian\(contextptr\)\)\s*return e\._REALptr->acos\(\);/, "gen acos(const gen & e0,GIAC_CONTEXT){"],
  // complex acos: the symbolic pi/2 meets the MPFR value as a double
  ["0005-mpfr-pi-and-real-domains.patch", "giac-2.1.0/src/usual.cc", /gen res=cst_pi\/2-asinasln\(e,contextptr\);/, "gen acos(const gen & e0,GIAC_CONTEXT){"],
  // acosh of a real below 1: the negated ln, the conjugate of the principal value
  ["0005-mpfr-pi-and-real-domains.patch", "giac-2.1.0/src/usual.cc", /if \(is_positive\(-x,contextptr\)\)\s*return -res;/, "static gen acoshasln(const gen & x,GIAC_CONTEXT){"],
  // G111, patch 0007: exponential's density and chisquare's check no support (exponential(21/10,-2) = 21/10*exp(21/5))
  ["0007-densities-outside-support.patch", "giac-2.1.0/src/moyal.cc", /if \(s==2\)\s*return v\[0\]\*exp\(-v\[0\]\*v\[1\],contextptr\);/, "gen _exponential(const gen & g,GIAC_CONTEXT){"],
  ["0007-densities-outside-support.patch", "giac-2.1.0/src/moyal.cc", /return apply2nd\(n,x,contextptr,chisquare\);\s*gen n2=n\/2;/, "gen chisquare(const gen & n,const gen & x,GIAC_CONTEXT){"],
  // G111, patch 0008: _fracmod passes any modulus to fracmod, whose in_fracmod takes mpz_sqrt of a negative one (a trap)
  ["0008-fracmod-positive-modulus.patch", "giac-2.1.0/src/usual.cc", /vecteur & v=\*args\._VECTptr;\s*return fracmod\(v\[0\],v\[1\]\);/, "gen _fracmod(const gen & args,GIAC_CONTEXT){"],
  // G96, patch 0006: symb_reim takes a non-integer power of a base of unknown sign as real (r=s, i=0)
  ["0006-reim-root-of-unknown-sign.patch", "giac-2.1.0/src/gen.cc", /is_positive\(-e,contextptr\)\)\{\s*r=pow\(-e,expo,contextptr\)\*cos\(cst_pi\*expo,contextptr\);\s*i=pow\(-e,expo,contextptr\)\*sin\(cst_pi\*expo,contextptr\);\s*\}\s*else \{\s*r=s;\s*i=0;/, "sommei.push_back(signei*(*it)*pow(r,n-j)*pow(i,j));"],
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
