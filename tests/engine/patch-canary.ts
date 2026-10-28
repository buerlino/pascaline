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
  // G113, patch 0009: a discrete pmf or cdf at a k off the integers took the formula (poisson(2,3/2) = 0.288)
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /if \(k\.type==_DOUBLE_ \|\| k\.type==_FLOAT_ \|\| k\.type==_FRAC\)\{\s*if \(p\.type==_DOUBLE_ \|\| p\.type==_FLOAT_ \|\| p\.type==_FRAC\)/, "gen binomial(const gen & N,const gen & K,const gen & P,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /swapgen\(k,p\);\s*if \(is_zero\(k\)\)\s*return pow\(p,r,contextptr\);/, "gen _negbinomial(const gen & g,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /gen n=v\[0\],p=v\[1\],k=v\[2\];\s*return _Beta\(makesequence\(n,k\+1,p,1\),contextptr\);/, "gen _negbinomial_cdf(const gen & g,GIAC_CONTEXT){"],
  // negbinomial_cdf(n,p,k1,k2) is cdf(k2)-cdf(k1), which leaves k1 out (aide_cas: Proba(x<=X<=y))
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /return _Beta\(makesequence\(n,k2\+1,p,1\),contextptr\)-_Beta\(makesequence\(n,k1\+1,p,1\),contextptr\);/, "gen _negbinomial_cdf(const gen & g,GIAC_CONTEXT){"],
  // negbinomial_icdf reads T._DOUBLE_val of an unconverted T (an exact 1/5 reads as 0)
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /gen R=v\[0\],P=evalf_double\(v\[1\],1,contextptr\),T=v\[2\];/, "gen _negbinomial_icdf(const gen & g,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /return apply2nd\(m,k,contextptr,poisson\);\s*gen M=evalf_double\(m,1,contextptr\);/, "gen poisson(const gen & m,const gen & k,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /^gen poisson_cdf\(const gen & lambda_,const gen & x,GIAC_CONTEXT\)\{\s*gen fx=_floor\(x,contextptr\);/, "gen poisson_cdf(const gen & lambda_,const gen & x,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /return poisson_cdf\(v\[0\],v\[2\],contextptr\)-poisson_cdf\(v\[0\],v\[1\]-1,contextptr\);/, "gen _poisson_cdf(const gen & g,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /gen K\(k\);\s*if \(is_positive\(-k,contextptr\)\)\s*return gensizeerr\(contextptr\);\s*return pow\(1-p,k-1,contextptr\)\*p;/, "gen geometric(const gen & p,const gen & k,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /if \(is_strictly_positive\(-k,contextptr\)\)\s*return gensizeerr\(contextptr\);\s*return 1-pow\(1-p,k,contextptr\);/, "gen geometric_cdf(const gen & p,const gen & k,GIAC_CONTEXT){"],
  ["0009-pmf-integer-support.patch", "giac-2.1.0/src/moyal.cc", /return geometric_cdf\(v\[0\],v\[2\],contextptr\)-geometric_cdf\(v\[0\],v\[1\]-1,contextptr\);/, "gen _geometric_cdf(const gen & g,GIAC_CONTEXT){"],
  // G113f1, patch 0010: negbinomial_icdf adds the cdf in a long double (an exact tie that is no binary fraction lands one step high) and returns 1 for t >= 1
  ["0010-negbinomial-icdf-exact.patch", "giac-2.1.0/src/moyal.cc", /if \(t<=0\)\s*return 0;\s*if \(t>=1\)\s*return 1;\s*long_double cumul=std::pow\(p,r\),current=cumul;/, "gen _negbinomial_icdf(const gen & g,GIAC_CONTEXT){"],
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
