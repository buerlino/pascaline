// SPDX-License-Identifier: GPL-3.0-or-later
// R64 (route R): the degree mode in the parser's text. Expected texts are the rule itself (derived): an angle argument
// times pasdeg, an angle result over pasdeg (input/angles.ts); values are checked on the engine in roundtrip.test.ts.
import { describe, expect, it } from "vitest";
import { latexToGiac } from "./latex-to-giac.ts";
import { dropAngleFactor, rewriteAngles } from "./angles.ts";
import { withAngles } from "../units/evaluate.ts";

// R64f1: the converters, as the rule writes them (angles.ts POLAR_OUT, RECT_IN)
const POLAR = "((p_)->when(type(p_[0])==vector,map(p_,q_->[q_[0],q_[1]/pasdeg]),[p_[0],p_[1]/pasdeg]))";
const RECT = "((p_)->when(type(p_)!=vector,p_,when(type(p_[0])==vector,map(p_,q_->[q_[0],pasdeg*q_[1]]),[p_[0],pasdeg*p_[1]])))";

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
    ["30^{\\circ}", "30*pi/180/pasdeg"],
    ["\\left(x+1\\right)^{\\circ}", "(x+1)*pi/180/pasdeg"],
    ["2\\measuredangle30", "2*(cos(pasdeg*30)+i*sin(pasdeg*30))"],
    ["\\operatorname{rotation}\\left(0,a,p\\right)", "rotation(0,pasdeg*a,p)"],
    ["\\operatorname{polar\\_point}\\left(2,30\\right)", "polar_point(2,pasdeg*30)"],
    ["\\operatorname{rectangular\\_coordinates}\\left(r,t\\right)", "rectangular_coordinates(r,pasdeg*t)"],
    // R64f1: the one-list form takes its angle element times pasdeg; a list it cannot see into (a name, a matrix)
    // is converted where it is evaluated, one point or a list of points; typed braces are Giac's list type (R80)
    ["\\operatorname{rectangular\\_coordinates}\\left(\\left\\{2,30\\right\\}\\right)", "rectangular_coordinates(list[2,pasdeg*30])"],
    ["\\operatorname{rectangular\\_coordinates}\\left(\\left\\{2+1,\\frac{30}{2}\\right\\}\\right)", "rectangular_coordinates(list[2+1,pasdeg*(30/2)])"],
    // a name may hold a point (A:=[2,30]): only literal elements take the factor in the text (audit R64f1)
    ["\\operatorname{rectangular\\_coordinates}\\left(\\left\\{ r,t+1\\right\\}\\right)", "rectangular_coordinates(R(list[r,t+1]))"],
    ["\\operatorname{rectangular\\_coordinates}\\left(\\left\\{A,B\\right\\}\\right)", "rectangular_coordinates(R(list[A,B]))"],
    ["\\operatorname{rectangular\\_coordinates}\\left(L\\right)", "rectangular_coordinates(R(L))"],
    // polar_coordinates and instfreq answer in radians: the angle element of every point, and the result, over pasdeg
    ["\\operatorname{polar\\_coordinates}\\left(1+\\imaginaryI\\right)", "P(polar_coordinates(1+i))"],
    ["\\operatorname{polar\\_coordinates}\\left(x,y\\right)", "P(polar_coordinates(x,y))"],
    ["\\operatorname{instfreq}\\left(s\\right)", "instfreq(s)/pasdeg"],
    // no angle in these: unchanged (F29)
    ["\\sinh\\left(x\\right)+\\operatorname{asinh}\\left(x\\right)", "sinh(x)+asinh(x)"],
    ["\\exp\\left(\\imaginaryI x\\right)", "exp(i*x)"],
  ])("%s -> %s", (latex, giac) => {
    expect(latexToGiac(latex)).toBe(giac.replace("P(", `${POLAR}(`).replace("R(", `${RECT}(`));
  });

  it("without the factor (the kept text of an open test) a degree is u*pi/180", () => {
    expect(latexToGiac("30^{\\circ}", { angleFactor: false })).toBe("30*pi/180");
    expect(latexToGiac("\\operatorname{polar\\_coordinates}\\left(1+\\imaginaryI\\right)", { angleFactor: false })).toBe("polar_coordinates(1+i)");
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
    ["polar_point(2,30)", "polar_point(2,pasdeg*(30))"],
    ["rectangular_coordinates([2,30])", "rectangular_coordinates([2,pasdeg*(30)])"],
    ["rectangular_coordinates([2.5,-1e2*pi/3])", "rectangular_coordinates([2.5,pasdeg*(-1e2*pi/3)])"],
    ["rectangular_coordinates([r,t])", "rectangular_coordinates(R([r,t]))"],
    ["rectangular_coordinates([A,B])", "rectangular_coordinates(R([A,B]))"],
    ["rectangular_coordinates([2,f(30)])", "rectangular_coordinates(R([2,f(30)]))"],
    ["rectangular_coordinates([[2,30],[1,90]])", "rectangular_coordinates(R([[2,30],[1,90]]))"],
    ["rectangular_coordinates(L)+1", "rectangular_coordinates(R(L))+1"],
    ["polar_coordinates(1+i)", "P(polar_coordinates(1+i))"],
    ["polar_coordinates(sin(x),1)", "P(polar_coordinates(sin(pasdeg*(x)),1))"],
    ["instfreq(s,t)", "(instfreq(s,t)/pasdeg)"],
    // R10's degree factor, from a store or a library file written before R64f1: the new form, the same value
    ["x*(pi/180)^angle_radian()", "x*pi/180/pasdeg"],
    ["(x+1)*(pi/180)^angle_radian()+2", "(x+1)*pi/180/pasdeg+2"],
    ["2/(pi/180)^angle_radian()", "2/(pi/180/pasdeg)"],
    ["(pi/180)^angle_radian()^2", "(pi/180/pasdeg)^2"],
    ["sinh(x)+pasin(x)+asinh(y)", "sinh(x)+pasin(x)+asinh(y)"],
    ['print("sin(x)")', 'print("sin(x)")'],
  ])("%s -> %s", (text, out) => {
    expect(rewriteAngles(text, "typed")).toBe(out.replace("P(", `${POLAR}(`).replace("R(", `${RECT}(`));
  });

  it("R64's degree form, already over pasdeg, becomes the new one", () => {
    expect(rewriteAngles("(x)->x*(pi/180)^angle_radian()/pasdeg", "typed")).toBe("(x)->x*pi/180/pasdeg");
    expect(rewriteAngles("sin(pasdeg*x)+2*(pi/180)^angle_radian()/pasdeg", "typed")).toBe("sin(pasdeg*x)+2*pi/180/pasdeg");
    expect(rewriteAngles('print("(pi/180)^angle_radian()/pasdeg")', "typed")).toBe('print("(pi/180)^angle_radian()/pasdeg")');
  });

  it("never applies twice: text that holds pasdeg is unchanged", () => {
    const once = rewriteAngles("sin(x)+asin(y)", "typed");
    expect(rewriteAngles(once, "typed")).toBe(once);
    expect(rewriteAngles(latexToGiac("\\sin\\left(x\\right)"), "typed")).toBe("sin(pasdeg*x)");
  });
});

describe("the unit view takes the factor off sin, cos and tan (pasua reads the angle's unit itself) and the inverses (G40: they give rad)", () => {
  it.each([
    ["sin(pasdeg*x)", "pasusin(x)"],
    ["cos(pasdeg*(30*pasdimA))+tan(pasdeg*2)", "pasucos((30*pasdimA))+pasutan(2)"],
    ["sin(x)", "pasusin(x)"],
    ["asin(x)/pasdeg", "pasuasin(x)"],
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
    ["(x)->x*pi/180/pasdeg", "(x)->x*pi/180"],
    [`(z)->${POLAR}(polar_coordinates(z+1))[1]`, "(z)->polar_coordinates(z+1)[1]"],
    [`rectangular_coordinates(${RECT}(L))`, "rectangular_coordinates(L)"],
    ["rectangular_coordinates([2,pasdeg*30])", "rectangular_coordinates([2,30])"],
    ["instfreq(s)/pasdeg", "instfreq(s)"],
    ["(x)->rotation(0,pasdeg*(a+1),p)", "(x)->rotation(0,a+1,p)"],
    ["(x)->sin(pasdeg*(x)*2)", "(x)->sin((x)*2)"],
    ["pasdegree*2+x/pasdegs", "pasdegree*2+x/pasdegs"],
    ["sin(x)", "sin(x)"],
  ])("%s -> %s", (text, out) => {
    expect(dropAngleFactor(text, "typed")).toBe(out);
  });

  it("undoes the emitter on every form it writes", () => {
    for (const latex of ["\\sin\\left(x+1\\right)", "\\arcsin\\left(x\\right)\\cos\\left(2x\\right)", "2\\measuredangle t", "\\arg\\left(z\\right)^2", "30^{\\circ}",
      "\\operatorname{polar\\_coordinates}\\left(1+\\imaginaryI\\right)", "\\operatorname{rectangular\\_coordinates}\\left(L\\right)",
      "\\operatorname{rectangular\\_coordinates}\\left(\\left\\{2,30\\right\\}\\right)", "\\operatorname{instfreq}\\left(s\\right)"])
      expect(dropAngleFactor(latexToGiac(latex), "typed")).toBe(latexToGiac(latex, { angleFactor: false }));
  });
});

describe("G105f1: Giac text is read with the quoting of where it comes from (giacPrint.ts)", () => {
  it("typed (a library file): \\\" inside a string ends nothing, so the call after the string gets its factor", () => {
    expect(rewriteAngles('f(x):=when(x=="a\\"b",sin(x),0)', "typed")).toBe('f(x):=when(x=="a\\"b",sin(pasdeg*(x)),0)');
    expect(dropAngleFactor('"a\\"b"+asin(x)/pasdeg', "typed")).toBe('"a\\"b"+asin(x)');
  });
  it("printed (Giac's print, the log): \\ is itself, so the string closes at its quote", () => {
    expect(rewriteAngles('g(x):={local s; s:="C:\\"; sin(x)}', "printed")).toBe('g(x):={local s; s:="C:\\"; sin(pasdeg*(x))}');
    expect(dropAngleFactor('["C:\\",(asin(x)/pasdeg)]', "printed")).toBe('["C:\\",asin(x)]');
  });
});
