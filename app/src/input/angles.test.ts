// SPDX-License-Identifier: GPL-3.0-or-later
// R64 (route R): the degree mode in the parser's text. Expected texts are the rule itself (derived): an angle argument
// times pasdeg, an angle result over pasdeg (input/angles.ts); values are checked on the engine in roundtrip.test.ts.
import { describe, expect, it } from "vitest";
import { latexToGiac } from "./latex-to-giac.ts";
import { dropAngleFactor, rewriteAngles } from "./angles.ts";
import { withAngles } from "../units/evaluate.ts";

describe("R64: every angle the user types carries pasdeg", () => {
  it.each([
    ["\\sin\\left(x\\right)", "sin(pasdeg*x)"],
    ["\\cos\\left(x+1\\right)", "cos(pasdeg*(x+1))"],
    ["\\tan\\left(-2\\right)", "tan(pasdeg*(-2))"],
    ["\\sec\\left(x\\right)+\\csc\\left(x\\right)+\\cot\\left(x\\right)", "sec(pasdeg*x)+csc(pasdeg*x)+cot(pasdeg*x)"],
    ["\\sin^2x", "sin(pasdeg*x)^2"],
    ["\\sin\\left(\\sin\\left(x\\right)\\right)", "sin(pasdeg*sin(pasdeg*x))"],
    ["\\arcsin\\left(x\\right)", "asin(x)/pasdeg"],
    ["\\arccos\\left(x\\right)", "acos(x)/pasdeg"],
    ["\\tan^{-1}\\left(x\\right)", "atan(x)/pasdeg"],
    ["\\arg\\left(z\\right)", "arg(z)/pasdeg"],
    ["\\operatorname{atan2}\\left(y,x\\right)", "atan2(y,x)/pasdeg"],
    ["\\operatorname{acot}\\left(x\\right)", "acot(x)/pasdeg"],
    ["\\operatorname{asin}\\left(x\\right)^2", "(asin(x)/pasdeg)^2"],
    ["\\arcsin\\left(x\\right)^2", "(asin(x)/pasdeg)^2"],
    ["\\frac{1}{\\arcsin\\left(x\\right)}", "1/(asin(x)/pasdeg)"],
    ["2^{\\arcsin\\left(x\\right)}", "2^(asin(x)/pasdeg)"],
    ["30^{\\circ}", "30*(pi/180)^angle_radian()/pasdeg"],
    ["2\\measuredangle30", "2*(cos(pasdeg*30)+i*sin(pasdeg*30))"],
    ["\\operatorname{rotation}\\left(0,a,p\\right)", "rotation(0,pasdeg*a,p)"],
    ["\\operatorname{rectangular\\_coordinates}\\left(r,t\\right)", "rectangular_coordinates(r,pasdeg*t)"],
    // no angle in these: unchanged (F29)
    ["\\sinh\\left(x\\right)+\\operatorname{asinh}\\left(x\\right)", "sinh(x)+asinh(x)"],
    ["\\exp\\left(ix\\right)", "exp(i*x)"],
  ])("%s -> %s", (latex, giac) => {
    expect(latexToGiac(latex)).toBe(giac);
  });

  it("an open == test keeps its sides without the factor in the text it shows (the three prec-e*-closed-open cases)", () => {
    const t = latexToGiac("\\cos\\left(\\frac{\\pi}{7}\\right)==\\frac{1}{2}");
    expect(t).toContain("(cos(pasdeg*(pi/7)),1/2)"); // the sides that are computed carry it
    expect(t).toContain("'cos(pi/7)==1/2'"); // the kept text does not
    expect(latexToGiac("\\arg\\left(z\\right)\\ne1")).toContain("'arg(z)!=1'");
  });

  it("pasdeg is a reserved name: the parser refuses it", () => {
    // a bare multi-letter name is refused already (letters typed one by one multiply); the call form is the one way in
    expect(() => latexToGiac("\\operatorname{pasdeg}\\left(2\\right)")).toThrow(/pasdeg is one of Pascaline's own names/);
    expect(() => latexToGiac("\\operatorname{pasdeg}\\left(x\\right):=x")).toThrow(/own names/);
    expect(() => latexToGiac("2\\sin\\left(\\operatorname{pasdeg}\\left(1\\right)\\right)")).toThrow(/own names/);
  });
});

describe("rewriteAngles: the same rule on Giac text (library import, G46's migration)", () => {
  it.each([
    ["sin(x)", "sin(pasdeg*(x))"],
    ["f(x):=sin(2*x)+asin(x)", "f(x):=sin(pasdeg*(2*x))+(asin(x)/pasdeg)"],
    ["cos(acos(x))", "cos(pasdeg*((acos(x)/pasdeg)))"],
    ["atan2(y,x)+arg(z)", "(atan2(y,x)/pasdeg)+(arg(z)/pasdeg)"],
    ["rotation(c,a,p)", "rotation(c,pasdeg*(a),p)"],
    ["rectangular_coordinates([r,t])", "rectangular_coordinates([r,t])"],
    ["x*(pi/180)^angle_radian()", "x*(pi/180)^angle_radian()/pasdeg"],
    ["sinh(x)+pasin(x)+asinh(y)", "sinh(x)+pasin(x)+asinh(y)"],
    ['print("sin(x)")', 'print("sin(x)")'],
  ])("%s -> %s", (text, out) => {
    expect(rewriteAngles(text)).toBe(out);
  });

  it("never applies twice: text that holds pasdeg is unchanged", () => {
    const once = rewriteAngles("sin(x)+asin(y)");
    expect(rewriteAngles(once)).toBe(once);
    expect(rewriteAngles(latexToGiac("\\sin\\left(x\\right)"))).toBe("sin(pasdeg*x)");
  });
});

describe("the unit view takes the factor off sin, cos and tan (pasua reads the angle's unit itself)", () => {
  it.each([
    ["sin(pasdeg*x)", "pasusin(x)"],
    ["cos(pasdeg*(30*pasdimA))+tan(pasdeg*2)", "pasucos((30*pasdimA))+pasutan(2)"],
    ["sin(x)", "pasusin(x)"],
    ["asin(x)/pasdeg", "asin(x)/pasdeg"],
  ])("%s -> %s", (text, out) => {
    expect(withAngles(text)).toBe(out);
  });
});

describe("dropAngleFactor: what is drawn shows the text as typed", () => {
  it.each([
    [" (x)->sin(pasdeg*x)", " (x)->sin(x)"],
    ["(x)->sin(pasdeg*(x+1))+cos(pasdeg*(2*x))^2", "(x)->sin(x+1)+cos(2*x)^2"],
    ["(x)->asin(x)/pasdeg*(x+1)", "(x)->asin(x)*(x+1)"],
    ["(t)->2*(cos(pasdeg*t)+i*sin(pasdeg*t))", "(t)->2*(cos(t)+i*sin(t))"],
    ["(x)->x*(pi/180)^angle_radian()/pasdeg", "(x)->x*(pi/180)^angle_radian()"],
    ["(x)->rotation(0,pasdeg*(a+1),p)", "(x)->rotation(0,a+1,p)"],
    ["(x)->sin(pasdeg*(x)*2)", "(x)->sin((x)*2)"],
    ["pasdegree*2+x/pasdegs", "pasdegree*2+x/pasdegs"],
    ["sin(x)", "sin(x)"],
  ])("%s -> %s", (text, out) => {
    expect(dropAngleFactor(text)).toBe(out);
  });

  it("undoes the emitter on every form it writes", () => {
    for (const latex of ["\\sin\\left(x+1\\right)", "\\arcsin\\left(x\\right)\\cos\\left(2x\\right)", "2\\measuredangle t", "\\arg\\left(z\\right)^2"])
      expect(dropAngleFactor(latexToGiac(latex))).toBe(latexToGiac(latex, { angleFactor: false }));
  });
});
