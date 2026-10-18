// SPDX-License-Identifier: GPL-3.0-or-later
// IEC 60063 preferred-number series as published (G30). Never a formula: E6–E24 are not round(10^(k/n)) (2.7, 3.3,
// 3.9, 4.7, 8.2) and E192 has two published values off the formula (5.55, 9.20). Mantissas times 100 for E48 and up,
// times 10 for E6–E24, so each entry is an integer in [d, 10d) with d = ESERIES_SCALE[n].
export const ESERIES: Readonly<Record<number, readonly number[]>> = {
  6: [10, 15, 22, 33, 47, 68],
  12: [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82],
  24: [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91],
  48: [100, 105, 110, 115, 121, 127, 133, 140, 147, 154, 162, 169, 178, 187, 196, 205, 215, 226, 237, 249, 261, 274, 287, 301, 316, 332, 348, 365, 383, 402, 422, 442, 464, 487, 511, 536, 562, 590, 619, 649, 681, 715, 750, 787, 825, 866, 909, 953],
  96: [100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143, 147, 150, 154, 158, 162, 165, 169, 174, 178, 182, 187, 191, 196, 200, 205, 210, 215, 221, 226, 232, 237, 243, 249, 255, 261, 267, 274, 280, 287, 294, 301, 309, 316, 324, 332, 340, 348, 357, 365, 374, 383, 392, 402, 412, 422, 432, 442, 453, 464, 475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665, 681, 698, 715, 732, 750, 768, 787, 806, 825, 845, 866, 887, 909, 931, 953, 976],
  192: [100, 101, 102, 104, 105, 106, 107, 109, 110, 111, 113, 114, 115, 117, 118, 120, 121, 123, 124, 126, 127, 129, 130, 132, 133, 135, 137, 138, 140, 142, 143, 145, 147, 149, 150, 152, 154, 156, 158, 160, 162, 164, 165, 167, 169, 172, 174, 176, 178, 180, 182, 184, 187, 189, 191, 193, 196, 198, 200, 203, 205, 208, 210, 213, 215, 218, 221, 223, 226, 229, 232, 234, 237, 240, 243, 246, 249, 252, 255, 258, 261, 264, 267, 271, 274, 277, 280, 284, 287, 291, 294, 298, 301, 305, 309, 312, 316, 320, 324, 328, 332, 336, 340, 344, 348, 352, 357, 361, 365, 370, 374, 379, 383, 388, 392, 397, 402, 407, 412, 417, 422, 427, 432, 437, 442, 448, 453, 459, 464, 470, 475, 481, 487, 493, 499, 505, 511, 517, 523, 530, 536, 542, 549, 555, 562, 569, 576, 583, 590, 597, 604, 612, 619, 626, 634, 642, 649, 657, 665, 673, 681, 690, 698, 706, 715, 723, 732, 741, 750, 759, 768, 777, 787, 796, 806, 816, 825, 835, 845, 856, 866, 876, 887, 898, 909, 920, 931, 942, 953, 965, 976, 988],
};

/** The scale of each series' integers: 10 for E6–E24 (two digits), 100 for E48–E192 (three digits). */
export const ESERIES_SCALE: Readonly<Record<number, number>> = { 6: 10, 12: 10, 24: 10, 48: 100, 96: 100, 192: 100 };

/** The Giac definition of `eseries(n,x)`: the preferred value nearest to x (smaller ratio) in x's decade, exact for a
 *  rational x. The decade is found by exact comparisons (a float log10 can land on the wrong side). An exact ratio tie
 *  (x^2 = lo·hi; none exists in the tables) would go up. */
export function eseriesDefinition(): string {
  const pick = Object.keys(ESERIES)
    .map((n) => `if (n==${n}) { t:=[${ESERIES[Number(n)]!.join(",")}]; d:=${ESERIES_SCALE[Number(n)]}; } `)
    .join("");
  return (
    "eseries(n,x):={ local t,d,p,s,k,lo,hi; t:=0; d:=0; " +
    pick +
    'if (d==0) throw("eseries: n must be 6, 12, 24, 48, 96 or 192"); ' +
    'if (type(x)!=integer and type(x)!=rational) { x:=evalf(x,30); if (type(x)!=real) throw("eseries: x must be a real number"); } ' +
    'if (x<=0) throw("eseries: x must be positive"); ' +
    "p:=floor(evalf(log10(x),30)); while (10^p>x) p:=p-1; while (10^(p+1)<=x) p:=p+1; " +
    "s:=x/10^p*d; lo:=t[0]; hi:=10*d; " +
    "for (k:=0;k<size(t);k:=k+1) { if (t[k]<=s) { lo:=t[k]; if (k+1<size(t)) hi:=t[k+1]; else hi:=10*d; } } " +
    "if (s^2<lo*hi) return lo/d*10^p; return hi/d*10^p; }"
  );
}
