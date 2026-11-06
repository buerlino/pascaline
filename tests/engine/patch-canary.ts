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
  // G115, patch 0011: atan's pi/12 test takes a double root within 1e-7 for exact, with no normal(...)==0 (atan(cos(pi/100000)) = pi/4)
  ["0011-atan-pi12-exact-check.patch", "giac-2.1.0/src/usual.cc", /edh=horner\(makevecteur\(-3,55,-198,198,-55,3\),tmp\*tmp\);\s*if \(absdouble\(edh\._DOUBLE_val\)<1e-7\)\{/, "// detect if atan is a multiples of pi/10"],
  // G118, patch 0012: pow takes abs(b)^n as b^n (even n) when b has no literal i, real or not (abs(acos(pi))^2 = acos(pi)^2)
  ["0012-abs-power-real-base.patch", "giac-2.1.0/src/gen.cc", /if \(u==at_abs && exponent\.type==_INT_ && !complex_mode\(contextptr\) && !has_i\(base\)\)\{/, "if (u==at_unit){"],
  ["0012-abs-power-real-base.patch", "giac-2.1.0/src/gen.cc", /if \(\(exponent % 2==0\) && base\._SYMBptr->sommet==at_abs\)\s*return/, "gen pow(const gen & base, unsigned long int exponent){"],
  // G121, patch 0013: asin(sin(a)) = +-(a-n*pi) (and asin(cos(a)), acos(cos(a)) through it) for any a with a numeric value, real or not
  // (asin(sin(2*i)) = i*pi-2*i); the symbolic form of the same rule; ln(a^b) = b*ln(a) for a > 0 and any b (ln(2^(10*i)) = 10*i*ln(2))
  ["0013-asin-ln-real-rules.patch", "giac-2.1.0/src/usual.cc", /^e=symbolic\(at_sin,cste\/2-e\._SYMBptr->feuille\);\s*if \(e\.is_symb_of_sommet\(at_sin\) && has_evalf\(e\._SYMBptr->feuille,a,1,contextptr\)\)\{/, "e=symbolic(at_sin,cste/2-e._SYMBptr->feuille);"],
  ["0013-asin-ln-real-rules.patch", "giac-2.1.0/src/usual.cc", /if \(e\.is_symb_of_sommet\(at_sin\)\)\{\s*a=e\._SYMBptr->feuille;\s*gen n=_round\(a\/cste,contextptr\);/, "e=symbolic(at_sin,cste/2-e._SYMBptr->feuille);"],
  ["0013-asin-ln-real-rules.patch", "giac-2.1.0/src/usual.cc", /^\/\/ ln\(a\^b\)\s*if \(is_positive\(a,contextptr\)\)\s*return b\*ln\(a,contextptr\);/, "// ln(a^b)"],
  // atan(tan(a)) = a-n*pi with n = floor(a/pi+1/2) of the double of any a, real or not (atan(tan(4*i)) = 4*i-i*pi)
  ["0013-asin-ln-real-rules.patch", "giac-2.1.0/src/usual.cc", /gen tmp2=evalf_double\(e\._SYMBptr->feuille,0,contextptr\);\s*if \(tmp2\.type<_IDNT\)\s*tmp2=_floor\(tmp2\/tmp\+plus_one_half,contextptr\);/, "if (atan_tan_no_floor(contextptr))"],
  // G122, patch 0014: asin(sin(a)) = +-(a-n*pi) takes n = round(a/pi) from a at the current Digits and tests the parity of an _INT_ n only
  // (asin(cos(30!)) = 0.221 for -0.221, asin(sin(10^50)) at Digits 40 near 1.4e10)
  ["0014-asin-big-reduction.patch", "giac-2.1.0/src/usual.cc", /gen n=_round\(a\/cste,contextptr\);\s*b=a-n\*cste; \/\/ in \[-pi\/2,pi\/2\]\s*if \(n\.type==_INT_ && n\.val%2==0\)/, "// asin(sin(a))==a-2*k*pi or pi-a-2*k*pi"],
  // G165, patch 0031: the same rule takes n = round(a/pi) at the current Digits with no look at a tie: a/pi = 1/2-10^-50/pi reads as
  // 1/2, so n = 1 and acos(cos(10^-50)) = -10^-50 (right 10^-50)
  ["0031-asin-half-integer-tie.patch", "giac-2.1.0/src/usual.cc", /^\/\/ asin\(sin\(a\)\)==a-2\*k\*pi or pi-a-2\*k\*pi\s*gen n=_round\(a\/cste,contextptr\);\s*b=a-n\*cste;/, "// asin(sin(a))==a-2*k*pi or pi-a-2*k*pi"],
  // G166, patch 0032: atan(tan(a)) floors the double of a/pi+1/2, 16 digits: atan(tan(10^15)) = 10^15-318309886183790*pi (n one
  // low, 2.11), and next to the pole 1-10^-15/pi rounds to 1 (atan(tan(pi/2-10^-15)) = pi/2-10^-15-pi)
  ["0032-atan-tan-reduction-digits.patch", "giac-2.1.0/src/usual.cc", /gen tmp2=evalf_double\(e\._SYMBptr->feuille,0,contextptr\);\s*if \(tmp2\.type<_IDNT\)\s*tmp2=_floor\(tmp2\/tmp\+plus_one_half,contextptr\);\s*else\s*tmp2=_floor\(e\._SYMBptr->feuille\/tmp\+plus_one_half,contextptr\);/, "if (atan_tan_no_floor(contextptr))"],
  // G175, patch 0033: pow takes (e^a)^b as e^(a*b) for any a (sqrt(exp(4*i)) = exp(2*i), the other root)
  ["0033-pow-exp-principal-branch.patch", "giac-2.1.0/src/gen.cc", /if \(u==at_exp\)\{\s*\/\/ \(e\^a\)\^b=e\^\(a\*b\)[\s\S]{0,200}?gen res=exp\(base\._SYMBptr->feuille\*exponent,contextptr\);/, "if (u==at_sign && exponent.type==_INT_ && !complex_mode(contextptr) && !has_i(base)){"],
  // normal takes sqrt(s*d^2) as abs(d)*sqrt(s), and the root of D^d*S as D times that of S, for a d, D with a complex value
  // and no literal i (normal(sqrt(acosh(-1/2)^3)) = abs(z)*sqrt(z), simplify z*sqrt(z))
  ["0033-pow-exp-principal-branch.patch", "giac-2.1.0/src/sym2poly.cc", /if \(keep_abs\)\{\s*tmparg=abs\(tmparg,contextptr\);\s*tmpd=abs\(tmpd,contextptr\);/, "zint2simpldoublpos(cont,simpl,doubl,pos,2,contextptr);"],
  ["0033-pow-exp-principal-branch.patch", "giac-2.1.0/src/sym2poly.cc", /D=D\*pow\(jt->fact,jt->mult\/d\);\s*\}\s*\/\/ Check sign of D/, "const factorization f=rsqff(*num._POLYptr);"],
  // G177, patch 0034: the half-angle rules of cos, sin and tan sign the root by is_positive of the half angle's evalf, false
  // for a complex one (cos(atan(1+i)/2) = -0.891+0.0986*i, the negation)
  ["0034-half-atrig-complex-sign.patch", "giac-2.1.0/src/usual.cc", /f=sqrt\(\(inv\(sqrt\(1\+pow\(f,2\),contextptr\),contextptr\)\+1\)\/2,contextptr\);\s*if \(is_positive\(e_,contextptr\)\) return f; else return -f;/, "int n=is_half_atrig(e,f);"],
  ["0034-half-atrig-complex-sign.patch", "giac-2.1.0/src/usual.cc", /f=sqrt\(\(1-inv\(sqrt\(1\+pow\(f,2\),contextptr\),contextptr\)\)\/2,contextptr\);\s*if \(is_positive\(e_,contextptr\)\) return f; else return -f;/, "return rdiv(f,sqrt(pow(f,2)+1,contextptr),contextptr);"],
  ["0034-half-atrig-complex-sign.patch", "giac-2.1.0/src/usual.cc", /f=sqrt\(\(1-f\)\/\(1\+f\),contextptr\);\s*if \(is_positive\(e_,contextptr\)\) return f; else return -f;/, "return rdiv(sqrt(1-pow(f,2),contextptr),f,contextptr);"],
  // G126, patch 0015: the ln forms of asin and asinh cancel for a large x on one side (acos(-10^20+1/2) lost 40 digits)
  ["0015-asin-asinh-ln-cancellation.patch", "giac-2.1.0/src/usual.cc", /^static gen asinasln\(const gen & x,GIAC_CONTEXT\)\{\s*return -cst_i\*ln\(cst_i\*x\+sqrt\(1-x\*x,contextptr\),contextptr\);/, "static gen asinasln(const gen & x,GIAC_CONTEXT){"],
  ["0015-asin-asinh-ln-cancellation.patch", "giac-2.1.0/src/usual.cc", /^static gen asinhasln\(const gen & x,GIAC_CONTEXT\)\{\s*return ln\(x\+sqrt\(x\*x\+1,contextptr\),contextptr\);/, "static gen asinhasln(const gen & x,GIAC_CONTEXT){"],
  // G127, patch 0016: floor of a complex value that is not an exact Gaussian rational falls to symb_floor (floor(asin(pi)) stays unevaluated)
  ["0016-floor-complex-value.patch", "giac-2.1.0/src/usual.cc", /if \(tmp\.type==_CPLX && is_zero\(\*\(tmp\._CPLXptr\+1\),contextptr\)\)\s*tmp=\*tmp\._CPLXptr;\s*if \(tmp\.type==_REAL\)\{/, "static bool warnfloor=true;"],
  // G131, patch 0017: real_object::is_zero takes an MPFR NaN as zero (mpfr_sgn(NaN) is 0), so NaN times a complex number is the complex number
  ["0017-mpfr-nan-not-zero.patch", "giac-2.1.0/src/gen.cc", /bool real_object::is_zero\(\) const\{\s*#ifdef HAVE_LIBMPFR\s*return !mpfr_sgn\(inf\);/, "bool real_object::is_zero() const{"],
  // G132, patch 0018: pow takes (a^b)^c as a^(b*c) (or abs(a)^(b*c)) for any base with no literal i (sqrt(acosh(-1/2)^3) = the other root)
  ["0018-pow-of-pow-branch.patch", "giac-2.1.0/src/gen.cc", /return inv\(pow\(base\._SYMBptr->feuille,exponent,contextptr\),contextptr\);\s*if \(u==at_pow && !has_i\(base\)\)\{/, "if (u==at_inv && base._SYMBptr->feuille.type==_SYMB"],
  // G133, patch 0020: sqrt of a complex MPFR value takes an imaginary part within epsilon (1e-12) of 0 as 0 (sqrt(1.0-1e-20*i) = 1 at
  // any Digits), and asin's ln form loses -log2|x| bits for a small complex x
  ["0020-complex-sqrt-asin-small.patch", "giac-2.1.0/src/usual.cc", /a=re\(e,contextptr\);b=ratnormal\(im\(e,contextptr\),contextptr\);\s*if \(a!=e && is_zero\(b,contextptr\)\)\s*return sqrt\(a,contextptr\);/, "gen sqrt(const gen & e,GIAC_CONTEXT){"],
  ["0020-complex-sqrt-asin-small.patch", "giac-2.1.0/src/usual.cc", /^static gen asinasln\(const gen & x,GIAC_CONTEXT\)\{\s*return -cst_i\*ln\(cst_i\*x\+sqrt\(1-x\*x,contextptr\),contextptr\);/, "static gen asinasln(const gen & x,GIAC_CONTEXT){"],
  // G134, patch 0021: the exact sqrt of a complex a+b*i tests b = 0 after ratnormal only, then divides b by a+rho, 0/0 when b is an exact 0
  // that ratnormal leaves (sqrt(acosh(10^-6)^2+1) = 8.4e-8-4.3e-7*i, right 1.21*i), and a+rho cancels for a < 0 and a tiny b (fix round 1:
  // the evalf of acosh(1/2+i/10^20) at Digits 40 was a wrong root, -0.49+0.61*i)
  ["0021-complex-sqrt-unproved-zero.patch", "giac-2.1.0/src/usual.cc", /if \(a!=e && is_zero\(b,contextptr\)\)\s*return sqrt\(a,contextptr\);\s*if \( has_i\(a\) \|\| has_i\(b\) \)[\s\S]*return ratnormal\(realpart\/2,contextptr\)\*\(1\+cst_i\*b\/\(a\+rho\)\);/, "// sqrt of an exact complex number"],
  // G134, patch 0022: arg of a complex MPFR value tests its parts with is_zero, which compares an MPFR's double with epsilon (1e-12), so
  // both parts below 1e-12 give undef (ln, powers) and one beside a negative real part is 0 (arg(-1-1e-20*i) = +pi)
  ["0022-arg-mpfr-tiny-parts.patch", "giac-2.1.0/src/gen.cc", /if \(is_zero_or_contains\(realpart,contextptr\)\)\{\s*if \(is_zero_or_contains\(imagpart,contextptr\)\)\s*return undef;/, "gen arg_CPLX(const gen & a,GIAC_CONTEXT){"],
  ["0022-arg-mpfr-tiny-parts.patch", "giac-2.1.0/src/gen.cc", /case _REAL:\s*return fabs\(evalf_double\(a,1,contextptr\)\._DOUBLE_val\)<=epsilon\(contextptr\);/, "bool is_zero(const gen & a,GIAC_CONTEXT){"],
  // G133f1, patch 0023: asin's and asinh's ln forms leave their rounding in the real part of asin(i*y), asinh(i*y) (|y| <= 1),
  // which are purely imaginary (CAS evalf(asinh(i/10)) = -1.2E-66+0.100167421162*i)
  ["0023-asin-imaginary-real-part.patch", "giac-2.1.0/src/usual.cc", /^static gen asinasln\(const gen & x,GIAC_CONTEXT\)\{\s*return -cst_i\*ln\(cst_i\*x\+sqrt\(1-x\*x,contextptr\),contextptr\);/, "static gen asinasln(const gen & x,GIAC_CONTEXT){"],
  ["0023-asin-imaginary-real-part.patch", "giac-2.1.0/src/usual.cc", /^static gen asinhasln\(const gen & x,GIAC_CONTEXT\)\{\s*return ln\(x\+sqrt\(x\*x\+1,contextptr\),contextptr\);/, "static gen asinhasln(const gen & x,GIAC_CONTEXT){"],
  // G140, patch 0024: _evalf's overflow test asks z/z!=1 of a complex double, which rounds (Gamma(1.0+i)), so evalf(Gamma(1+i))
  // at Digits 14 ran again at 30 digits, where Gamma has no complex MPFR path, and stayed Gamma(1.0000000000000+i)
  ["0024-evalf-complex-double-workaround.patch", "giac-2.1.0/src/usual.cc", /^bool need_workaround\(const gen & g\)\{\s*if \(g\.type==_REAL \|\| \(g\.type==_CPLX && g\._CPLXptr->type==_REAL && \(g\._CPLXptr\+1\)->type==_REAL\)\)\s*return false;\s*if \(g\.type<=_CPLX\)\s*return g!=0 && g\/g!=1;/, "bool need_workaround(const gen & g){"],
  // G149, patch 0025: pow writes b^(n*s/d) as ((b^s)^(1/d))^r*(b^s)^q for any b and s, another branch where im(s*ln(b)) is
  // past pi (2^sqrt(-1-10^-3) = (2^(10*i*sqrt(10010)))^(1/1000), the root of 2^(1000.5*i); G160: also for a b whose double is not
  // finite, (10^400)^(i/1000) = ((10^400)^i)^(1/1000))
  ["0025-pow-root-extract-branch.patch", "giac-2.1.0/src/gen.cc", /gen res\(1\);\s*if \(r\)\{\s*if \(complex_mode\(contextptr\) && fastsign\(base,contextptr\)==-1\)\{/, "// extract integral powers in a product exponent"],
  // G151, patch 0026: asinh of an exact real ends in its ln form, which cancels at evalf for a small x
  // (surd(asinh(1/10^100),3) took the noise's sign, the complex root)
  ["0026-asinh-small-real-exact.patch", "giac-2.1.0/src/usual.cc", /if \(keep_acosh_asinh\(contextptr\)\)\s*return symbolic\(at_asinh,e\);\s*return ln\(e\+sqrt\(pow\(e,2\)\+1,contextptr\),contextptr\);/, "gen asinh(const gen & e0,GIAC_CONTEXT){"],
  // G153, patch 0027: atanh of an exact real ends in its ln form ln((1+x)/(1-x))/2, which cancels at evalf for a small x
  // (atanh(89999/10^1003) was 0 at 60 digits, so ln of it -infinity and Home's double fallback read noise)
  ["0027-atanh-small-real-exact.patch", "giac-2.1.0/src/usual.cc", /return symbolic\(at_program,gen\(makevecteur\(a,0,atanh\(b,contextptr\)\),_SEQ__VECT\)\);\s*return rdiv\(ln\(rdiv\(1\+e,1-e,contextptr\),contextptr\),plus_two\);/, "gen atanh(const gen & e0,GIAC_CONTEXT){"],
  // G157, patch 0028: trunc floors an argument whose sign Giac cannot prove (trunc(x) = floor(x), -2 at x = -13/10), and
  // trunc(x,n) floors d*x for either sign (trunc(-27/20,1) = -1.4)
  ["0028-trunc-toward-zero.patch", "giac-2.1.0/src/maple.cc", /if \(is_strictly_positive\(-args,contextptr\)\)\s*return -_floor\(-args,contextptr\);\s*return _floor\(args,contextptr\);\s*\}\s*static const char _trunc_s/, "gen _trunc(const gen & args,GIAC_CONTEXT){"],
  ["0028-trunc-toward-zero.patch", "giac-2.1.0/src/maple.cc", /return _floor\(d\*args\._VECTptr->front\(\),contextptr\)\/d;/, "gen _trunc(const gen & args,GIAC_CONTEXT){"],
  // G157f1, patch 0029: the definite integral splits floor (ceil as floor) at its jumps but not trunc, so x*trunc(x) is used
  // across trunc's jumps (int(trunc(x),x,-1/2,5/2) = 3*trunc(x), right 2)
  ["0029-int-trunc-split.patch", "giac-2.1.0/src/intg.cc", /v\[0\]=ceil2floor\(v\[0\],contextptr,true\);\s*vecteur lfloor\(lop\(v\[0\],at_floor\)\);/, "aorig=borne_inf=v[2];"],
  // ... a falling a*x+b from a non-integer start takes its first jump at n1-1, one interval late (int(ceil(x),x,1/2,3/2) = 1)
  ["0029-int-trunc-split.patch", "giac-2.1.0/src/intg.cc", /gen cur=borne_inf,next=\(n1\+stepn-b\)\/a,res=0;\s*if \(stepn==-1 && n1==a\*borne_inf\+b\)\s*n1 -= 1;\s*for \(/, "// find integers of the form a*x+b in [borne_inf,borne_sup]"],
  // ... the numeric check takes trunc as exactly integrable (its antiderivative x*trunc(x) across the jumps)
  ["0029-int-trunc-split.patch", "giac-2.1.0/src/intg.cc", /sign_floor_ceil_round_tab\)\.empty\(\) \)\s*return false;\s*if \(f\.type!=_SYMB/, "bool approxint_exact(const gen &f,const gen &x,GIAC_CONTEXT){"],
  // ... and an exact 0 fails the check against tegral's own error (int(trunc(x),x,-3/2,3/2) = [0,-2.9e-07])
  ["0029-int-trunc-split.patch", "giac-2.1.0/src/intg.cc", /return simplifier\(exactvalue,contextptr\);\s*\*logptr\(contextptr\) << gettext\("Error while checking exact value with approximate value, returning both!"\)/, "gen ck_int_numerically(const gen & f"],
  // G152, patch 0030: a negative real float to a float power k+1/2 is exp(e*ln(b)), whose real part is noise (evalf(sqrt(-pi))
  // = 4.1e-41+1.77*i at Digits 40, 9.6e-15+1.77*i at Digits 12), so acosh(cosh(3*sqrt(-pi))) took the other side of its cut
  ["0030-pow-half-odd-negative-float.patch", "giac-2.1.0/src/gen.cc", /return std::pow\(base\._DOUBLE_val,exponent\._DOUBLE_val\);\s*#endif\s*else\s*return exp\(exponent\*log\(base,contextptr\),contextptr\);/, "switch ( (base.type<< _DECALAGE) | exponent.type ) {"],
  ["0030-pow-half-odd-negative-float.patch", "giac-2.1.0/src/gen.cc", /\|\| base\.type==_FLOAT_ \|\| \( \(base\.type<_POLY \|\| base\.type==_FLOAT_\) && \(exponent\.type==_REAL \|\| exponent\.type==_DOUBLE_ \|\| exponent\.type==_FLOAT_\)\)\)\s*return exp\(operator_times\(exponent,log\(base,contextptr\),contextptr\),contextptr\);/, "Use matpow to force computation of a power of matrix via jordanisation"],
  // G135, patch 0019: atan keeps an exact argument on its cut symbolic (atan(2*i)), which Giac's cos rule reads on the other side
  ["0019-atan-exact-cut.patch", "giac-2.1.0/src/usual.cc", /atan\(b,contextptr\)\),_SEQ__VECT\)\);\s*gen tmp=evalf_double\(e,0,contextptr\);\s*if \(tmp\.type==_DOUBLE_\)\{/, "return symbolic(at_program,gen(makevecteur(a,0,atan(b,contextptr)),_SEQ__VECT));"],
  // G135, patch 0019: cos(atan(f)) = sqrt(1/(f^2+1)) takes the other root where f^2+1 is a negative real (cos(quote(atan(2*i))) = i*sqrt(3)/3)
  ["0019-atan-exact-cut.patch", "giac-2.1.0/src/usual.cc", /if \(u==at_atan\)\s*return sqrt\(inv\(pow\(f,2\)\+1,contextptr\),contextptr\);/, "return sqrt(1-pow(f,2),contextptr);\n      if (u==at_atan)"],
  // G96, patch 0006: symb_reim takes a non-integer power of a base of unknown sign as real (r=s, i=0)
  ["0006-reim-root-of-unknown-sign.patch", "giac-2.1.0/src/gen.cc", /is_positive\(-e,contextptr\)\)\{\s*r=pow\(-e,expo,contextptr\)\*cos\(cst_pi\*expo,contextptr\);\s*i=pow\(-e,expo,contextptr\)\*sin\(cst_pi\*expo,contextptr\);\s*\}\s*else \{\s*r=s;\s*i=0;/, "sommei.push_back(signei*(*it)*pow(r,n-j)*pow(i,j));"],
];

const tar = tarball(SOURCES.giac);
const failures: string[] = [];
// G153: each file is unpacked once (tar -xzOf reads the whole tarball, about 2 s); one unpack per canary took 107 s for
// 51 canaries, past the flags stage's 120 s under load.
const files = new Map<string, string>();
const read = (file: string): string => files.get(file) ?? files.set(file, member(tar, file)).get(file)!;
for (const [patch, file, wrong, near] of CANARIES) {
  const src = read(file);
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
