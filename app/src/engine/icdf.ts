// SPDX-License-Identifier: GPL-3.0-or-later
// G44 (docs/04 2.3 #2): the inverse distribution functions polished by substituting back. Giac's normald_icdf,
// student_icdf, chisquare_icdf and fisher_icdf return a double at any Digits (normald_icdf(10^-10) is wrong from the
// 8th digit), and so do its forward functions (normald_cdf, student_cdf, …). Our forward functions run at Giac's
// Digits with MPFR: the normal through erfc (our continued fraction in the tail), the others through the regularized incomplete beta and gamma functions,
// by their continued fractions (DLMF 8.17.22, 8.9.2) and series (DLMF 8.7.1), each tail computed directly on its own
// side. From Giac's value x₀, Newton on F(x) = p with the density as the derivative, on the smaller tail, stops when
// the step is below 10^−Digits. The agreement check of docs/04 2.4 rule 2 then runs the polished input at P and P + 20
// (numeric.ts). When an argument is not a real number, Newton does not converge in 20 steps, or the residual
// |F(x) − p|/min(p, 1 − p) is above 10^−digits, the definition returns Giac's value and sets the flag ICDF_FAILED:
// the caller keeps today's ⚠ (the unaudited check). Synchronous, UI-free; only erasable TypeScript syntax.
import type { Giac } from "./numeric.ts";

/** The Giac names polished, and our definition each call is replaced by. */
export const ICDF_REPLACED: Readonly<Record<string, string>> = {
  normald_icdf: "pasnormald_icdf",
  student_icdf: "passtudent_icdf",
  chisquare_icdf: "paschisquare_icdf",
  fisher_icdf: "pasfisher_icdf",
  // G44f1: erf and erfc by our MPFR definitions (below), checked like the inverse functions.
  erf: "paserfv",
  erfc: "paserfcv",
};

/** Set to 1 by a polish that fell back to Giac's value. */
export const ICDF_FAILED = "pasicdff";
/** The digits the residual is checked against (the display digits); Digits − 10 when unset. */
export const ICDF_DIGITS = "pasicdfd";

/** A real number: a float, or an exact integer or rational (evalf(0) stays the integer 0). */
const REAL = (v: string) => `(type(${v})==integer or type(${v})==rational or type(evalf(${v}))==DOM_FLOAT)`;

/** The definitions, in the order they are loaded (helpers first). */
export const ICDF_DEFINITIONS: Readonly<Record<string, string>> = {
  // ln Γ(a) with MPFR at Digits.
  paslg: "paslg(a):=lgamma(evalf(a))",
  // Lentz's evaluation of the continued fraction of I_x(a,b) (DLMF 8.17.22), y = 1 − x given separately.
  pasbetacf:
    "pasbetacf(a,b,x,y):={ local tn,tol,fv,cv,dv,j,m,h,aj,dl; tn:=evalf(10^(-2*Digits)); tol:=evalf(10^(-Digits-2)); " +
    "fv:=tn; cv:=fv; dv:=0; " +
    "for (j:=1;j<=20000;j:=j+1) { if (j==1) aj:=1; else { m:=j-1; if (irem(m,2)==1) { h:=(m-1)/2; aj:=-(a+h)*(a+b+h)*x/((a+2*h)*(a+2*h+1)); } " +
    "else { h:=m/2; aj:=h*(b-h)*x/((a+2*h-1)*(a+2*h)); } } " +
    "dv:=1+aj*dv; if (dv==0) dv:=tn; cv:=1+aj/cv; if (cv==0) cv:=tn; dv:=1/dv; dl:=cv*dv; fv:=fv*dl; if (abs(dl-1)<tol) break; } " +
    "return exp(a*ln(x)+b*ln(y)-paslg(a)-paslg(b)+paslg(a+b))/a*fv; }",
  // erf(y) for 0 ≤ y < 2 at Digits by its series of positive terms (DLMF 7.6.2). Giac's MPFR erf of a float below
  // about 1E-11 is the argument itself (erf(1e-19) gives 1e-19, right 1.128…e-19).
  paserf:
    "paserf(y):={ local tol,s,t,n; if (y==0) return 0; tol:=evalf(10^(-Digits-2)); t:=y; s:=t; " +
    "for (n:=1;n<=100000;n:=n+1) { t:=t*2*y^2/(2*n+1); s:=s+t; if (t<s*tol) break; } return 2/sqrt(pi)*exp(-y^2)*s; }",
  // erfc(y) for y ≥ 0 at Digits: 1 − erf(y) below 2 (at most 3 digits cancel), Laplace's continued fraction above
  // (DLMF 7.9.2). Giac's own MPFR erfc is 1 − erf: erfc(4.5) at 40 digits is right to 31 digits only, and erfc of a
  // negative float is erfc(|x|) (erfc(-1.0) at 40 digits gives 0.157…, right 1.842…).
  paserfc:
    "paserfc(y):={ local tn,tol,fv,cv,dv,j,aj,dl; if (y<2) return 1-paserf(y); tn:=evalf(10^(-2*Digits)); tol:=evalf(10^(-Digits-2)); " +
    "fv:=tn; cv:=fv; dv:=0; " +
    "for (j:=1;j<=20000;j:=j+1) { if (j==1) aj:=1; else aj:=(j-1)/2; " +
    "dv:=y+aj*dv; if (dv==0) dv:=tn; cv:=y+aj/cv; if (cv==0) cv:=tn; dv:=1/dv; dl:=cv*dv; fv:=fv*dl; if (abs(dl-1)<tol) break; } " +
    "return exp(-y^2)/sqrt(pi)*fv; }",
  // G44f1: erf and erfc of any argument at Digits: erf(-y) = -erf(y), erfc(-y) = 2 - erfc(y), erf(y) = 1 - erfc(y) from
  // 2 on (the continued fraction keeps the tail's digits). A list is mapped; an argument that is not a real number is
  // left to Giac's own function, with the flag set.
  paserfv:
    "paserfv(z):={ local y; if (type(z)==DOM_LIST) return map(z,paserfv); if (z==0) return 0; y:=evalf(z); " +
    `if (type(y)!=DOM_FLOAT) { ${ICDF_FAILED}:=1; return erf(z); } if (y<0) return -paserfv(-y); if (y<2) return paserf(y); return 1-paserfc(y); }`,
  paserfcv:
    "paserfcv(z):={ local y; if (type(z)==DOM_LIST) return map(z,paserfcv); if (z==0) return 1; y:=evalf(z); " +
    `if (type(y)!=DOM_FLOAT) { ${ICDF_FAILED}:=1; return erfc(z); } if (y<0) return 2-paserfc(-y); return paserfc(y); }`,
  // [I_x(a,b), I_y(b,a)] = [lower, upper], the smaller one computed directly.
  pasibeta:
    "pasibeta(a,b,x,y):={ local s; if (x<=0) return [0,1]; if (y<=0) return [1,0]; " +
    "if (x<(a+1)/(a+b+2)) { s:=pasbetacf(a,b,x,y); return [s,1-s]; } s:=pasbetacf(b,a,y,x); return [1-s,s]; }",
  // [P(a,x), Q(a,x)]: the series below a + 1 (DLMF 8.7.1), else Legendre's continued fraction (DLMF 8.9.2).
  pasigamma:
    "pasigamma(a,x):={ local tn,tol,pre,s,t,n,fv,cv,dv,j,aj,bj,dl; if (x<=0) return [0,1]; " +
    "tn:=evalf(10^(-2*Digits)); tol:=evalf(10^(-Digits-2)); pre:=exp(a*ln(x)-x-paslg(a)); " +
    "if (x<a+1) { t:=1/a; s:=t; for (n:=1;n<=100000;n:=n+1) { t:=t*x/(a+n); s:=s+t; if (abs(t)<abs(s)*tol) break; } s:=s*pre; return [s,1-s]; } " +
    "fv:=tn; cv:=fv; dv:=0; " +
    "for (j:=1;j<=20000;j:=j+1) { if (j==1) { aj:=1; bj:=x+1-a; } else { aj:=-(j-1)*(j-1-a); bj:=x+2*j-1-a; } " +
    "dv:=bj+aj*dv; if (dv==0) dv:=tn; cv:=bj+aj/cv; if (cv==0) cv:=tn; dv:=1/dv; dl:=cv*dv; fv:=fv*dl; if (abs(dl-1)<tol) break; } " +
    "s:=pre*fv; return [1-s,s]; }",
  // [lower tail, upper tail, density, lower tail − 1/2] at x of: k = 0 normal (a = μ, b = σ), 1 Student (a = ν),
  // 2 χ² (a = k), 3 Fisher (a = d₁, b = d₂). The last is computed directly for the symmetric two (erf, I_y(1/2, ν/2)),
  // so a p next to 1/2 keeps its digits (normald_icdf(1/2+10^-30)).
  pasicdft:
    "pasicdft(k,a,b,x):={ local y,z,s,t,w; " +
    "if (k==0) { z:=(x-a)/b; w:=exp(-z^2/2)/(b*sqrt(2*pi)); y:=abs(z)/sqrt(2); " +
    "if (y<2) { t:=paserf(y)/2; s:=1/2-t; } else { s:=paserfc(y)/2; t:=1/2-s; } if (z<0) return [s,1-s,w,-t]; return [1-s,s,w,t]; } " +
    "if (k==1) { w:=a+x^2; s:=pasibeta(a/2,1/2,a/w,x^2/w); t:=s[0]/2; " +
    "z:=exp(paslg((a+1)/2)-paslg(a/2)-(a+1)/2*ln(1+x^2/a))/sqrt(a*pi); if (x>0) return [1-t,t,z,s[1]/2]; return [t,1-t,z,-s[1]/2]; } " +
    "if (x<=0) return [0,1,0,-1/2]; " +
    "if (k==2) { s:=pasigamma(a/2,x/2); return [s[0],s[1],exp((a/2-1)*ln(x)-x/2-a/2*ln(2)-paslg(a/2)),s[0]-1/2]; } " +
    "w:=a*x+b; s:=pasibeta(a/2,b/2,a*x/w,b/w); " +
    "return [s[0],s[1],exp(a/2*ln(a*x/w)+b/2*ln(b/w)-ln(x)-paslg(a/2)-paslg(b/2)+paslg(a/2+b/2)),s[0]-1/2]; }",
  // Newton from Giac's x0 on the smaller tail; Giac's x0 with the flag set when it cannot be polished.
  pasicdf:
    "pasicdf(k,a,b,p,x0):={ local x,q,lo,md,t,r,w,dx,n,ok,tol,d; " +
    `if (not(${REAL("p")}) or not(${REAL("a")}) or not(${REAL("b")})) { ${ICDF_FAILED}:=1; return x0; } ` +
    `if ((k>0 and a<=0) or ((k==0 or k==3) and b<=0)) { ${ICDF_FAILED}:=1; return x0; } ` +
    // G44f1: at p = 0 and p = 1 Giac's value is the end of the support (±infinity, 0), which is exact.
    `if (p==0 or p==1) return x0; if (p<0 or p>1) { ${ICDF_FAILED}:=1; return x0; } ` +
    // The median of the symmetric ones is exact (Giac's normald_icdf(0.5) is -1.9E-19).
    "if (p==1/2 and k==0) return a; if (p==1/2 and k==1) return 0; " +
    // md: p next to the median of a symmetric one, solved for F(x) − 1/2 = p − 1/2; else on the smaller tail.
    // Giac's value as the start; its centre when that is not a finite number in the support (fisher_icdf(3,4,1-10^-20)
    // is +infinity, chisquare_icdf(3,10^-30) is negative).
    `if (${REAL("x0")} and not((k==2 or k==3) and x0<=0)) x:=evalf(exact(x0)); else x:=evalf(when(k==0,a,when(k==1,0,when(k==2,a,1)))); ` +
    "md:=(k<=1 and p>1/4 and p<3/4); lo:=(p<=1/2); " +
    "if (md) q:=abs(p-1/2); else { if (lo) q:=p; else q:=1-p; } tol:=evalf(10^(5-Digits)); ok:=0; " +
    "for (n:=1;n<=20;n:=n+1) { t:=pasicdft(k,a,b,x); if (not(t[2]>0)) break; " +
    // In a tail, Newton on ln F: the same root and the derivative f/F, but it converges from Giac's far value
    // (normald_icdf below 1E-16 is a different number on each call: -8.58, -8.65 for 10^-20, right -9.26).
    "if (md) dx:=(t[3]-(p-1/2))/t[2]; else { if (lo) w:=t[0]; else w:=t[1]; if (not(w>0)) break; " +
    "dx:=(ln(w)-ln(q))*w/t[2]; if (not(lo)) dx:=-dx; } " +
    // χ² and Fisher live on x > 0 and have power-law tails at 0: the step is taken in ln x.
    "if (k==2 or k==3) x:=x*exp(-dx/x); else x:=x-dx; if (abs(dx)<=tol*max(abs(x),when(k==0,b,when(k==1,1,0)))) { ok:=1; break; } } " +
    `if (ok==1) { t:=pasicdft(k,a,b,x); if (md) r:=t[3]-(p-1/2); else { if (lo) r:=t[0]-p; else r:=q-t[1]; } ` +
    `if (type(${ICDF_DIGITS})==integer) d:=${ICDF_DIGITS}; else d:=Digits-10; if (abs(r)>q*10^(-d)) ok:=0; } ` +
    `if (ok==0) { ${ICDF_FAILED}:=1; return x0; } return x; }`,
  // The four Giac names with their arguments; the arguments of a call to a one-parameter function come as one sequence.
  pasnormald_icdf:
    "pasnormald_icdf(l):={ local v; v:=[l]; if (size(v)==1) return pasicdf(0,0,1,v[0],normald_icdf(v[0])); " +
    `if (size(v)==3) return pasicdf(0,v[0],v[1],v[2],normald_icdf(v[0],v[1],v[2])); ${ICDF_FAILED}:=1; return normald_icdf(l); }`,
  passtudent_icdf:
    "passtudent_icdf(l):={ local v; v:=[l]; if (size(v)==2) return pasicdf(1,v[0],1,v[1],student_icdf(v[0],v[1])); " +
    `${ICDF_FAILED}:=1; return student_icdf(l); }`,
  paschisquare_icdf:
    "paschisquare_icdf(l):={ local v; v:=[l]; if (size(v)==2) return pasicdf(2,v[0],1,v[1],chisquare_icdf(v[0],v[1])); " +
    `${ICDF_FAILED}:=1; return chisquare_icdf(l); }`,
  pasfisher_icdf:
    "pasfisher_icdf(l):={ local v; v:=[l]; if (size(v)==3) return pasicdf(3,v[0],v[1],v[2],fisher_icdf(v[0],v[1],v[2])); " +
    `${ICDF_FAILED}:=1; return fisher_icdf(l); }`,
};

const ICDF_CALL = new RegExp(`"[^"]*"|\\b(${Object.keys(ICDF_REPLACED).join("|")})(\\s*\\()`, "g");

/** The polished names `text` calls (outside strings). */
export function icdfCalls(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(ICDF_CALL)) if (m[1] !== undefined && !out.includes(m[1])) out.push(m[1]);
  return out;
}

/** `text` with every call of a polished name replaced by ours, and our definitions loaded on first use. */
export function icdfPolished(giac: Giac, text: string): string {
  for (const [name, def] of Object.entries(ICDF_DEFINITIONS)) {
    // A defined function prints as its program; an undefined name prints as itself.
    if (giac.eval(name).trim() === name) giac.eval(def);
  }
  return text.replace(ICDF_CALL, (m, name?: string, paren?: string) => (name === undefined ? m : `${ICDF_REPLACED[name]}${paren}`));
}

/** The definitions erf and erfc are read through, loaded together: the last one stands for all. */
const ERF_DEFINITIONS = ["paserf", "paserfc", "paserfv", "paserfcv"] as const;
const ERF_CALL = /"[^"]*"|\b(erfc?)(\s*\()/g;

/** The index just past the parenthesis that closes the one at `open`; -1 when none does. */
function closingAt(s: string, open: number): number {
  let depth = 0;
  for (let k = open; k < s.length; k++) {
    if (s[k] === "(") depth++;
    else if (s[k] === ")" && --depth === 0) return k + 1;
  }
  return -1;
}

/**
 * G44f1: `text` (an exact result as Giac prints it) for its value, with erf and erfc read through our MPFR definitions
 * and the definitions loaded on first use; the text itself when it calls neither. Giac prints erfc(u) as 1-erf(u),
 * which cancels the tail's digits (erfc(10) loses 45): a term 1-erf(u) is read as erfc(u) when nothing binds tighter
 * on either side.
 */
export function erfValueText(giac: Giac, text: string): string {
  if (!/\berfc?\s*\(/.test(text)) return text;
  let s = text;
  for (let k = s.indexOf("1-erf("); k >= 0; k = s.indexOf("1-erf(", k + 1)) {
    const end = closingAt(s, k + 5);
    if (end < 0) break;
    const before = k === 0 ? "" : s[k - 1]!;
    const after = end === s.length ? "" : s[end]!;
    if (!/^[(,[+]?$/.test(before) || !/^[),\]+-]?$/.test(after)) continue;
    s = `${s.slice(0, k)}erfc(${s.slice(k + 6)}`;
  }
  s = s.replace(ERF_CALL, (m, name?: string, paren?: string) => (name === undefined ? m : `${ICDF_REPLACED[name]}${paren}`));
  const last = ERF_DEFINITIONS[ERF_DEFINITIONS.length - 1]!;
  if (giac.eval(last).trim() === last) for (const name of ERF_DEFINITIONS) giac.eval(ICDF_DEFINITIONS[name]!);
  return s;
}

/** G44f1: whether the polish of `text` falls back to Giac's value at `digits` (P = max(40, digits + 10)): an argument
 *  out of range or Newton not converging. Not for p = 0 or 1, where Giac's ±infinity is the exact end of the support. */
export function icdfRefused(giac: Giac, text: string, digits: number): boolean {
  const polished = icdfPolished(giac, text);
  giac.eval(`${ICDF_FAILED}:=0`);
  giac.eval(`${ICDF_DIGITS}:=${digits}`);
  giac.eval(`Digits:=${Math.max(40, digits + 10)}`);
  try {
    giac.eval(`pasicdfr:=(${polished})`);
    return giac.eval(ICDF_FAILED).trim() !== "0";
  } finally {
    giac.eval(`Digits:=${digits}`);
    giac.eval(`purge(pasicdfr,${ICDF_FAILED},${ICDF_DIGITS})`);
  }
}
