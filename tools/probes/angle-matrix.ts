// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (S14): the angle mode on every Giac path. Since G46 the app runs route R itself (Giac always in radians; the
// degree mode lives in the text the parser emits, `sin(pasdeg*(u))`, `(asin(u)/pasdeg)`, with pasdeg = pi/180 in DEG
// and 1 in RAD). Route "a" is the app's own rule (input/angles.ts), route "b" S14's prototype rewrite (`rewriteAngles`
// below): both should be right on every row. Before G46, route "a" was Giac's global angle_radian plus pasexp.
//   node tools/probes/angle-matrix.ts               # the matrix: every case of the deep check D4–D8, D12 and the check's 1–4
//   node tools/probes/angle-matrix.ts --golden      # every golden input, today and rewritten: the cases whose result changes
//   node tools/probes/angle-matrix.ts --display     # the CAS view in DEG: three display options for route R's radian text
//   node tools/probes/angle-matrix.ts --bench       # Enter time of home.yaml's inputs, today vs rewritten (take the host-cpu lock)
// Right values: tools/probes/angle-matrix-oracle.py (mpmath, `oracle`) or derived from the definitions (`derived`).
// Engine: $GIAC_MJS, else $GIAC_OUT/giac.mjs, else engine/giac/_out/gsl. Units need the Find index ($FIND_INDEX_JSON,
// else app/src/find/_gen/find-index.json): without it the unit cases are skipped.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EngineHost, type GiacApi } from "../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings, type HomeResult, type HomeSettings } from "../../app/src/engine/homeEval.ts";
import { defaultCasSettings } from "../../app/src/engine/types.ts";
import { markOf, type DecimalValue } from "../../app/src/engine/format.ts";
import { defaultSolveSettings, solve1 } from "../../app/src/engine/solve1.ts";
import { latexToGiac } from "../../app/src/input/latex-to-giac.ts";
import { jsonToJs } from "../../app/src/input/emit-js.ts";
import { parseLatex } from "../../app/src/input/parse.ts";
import { buildJob } from "../../app/src/units/build.ts";
import { factorTable } from "../../app/src/units/factors.ts";
import { isUnitError, type Quantity, type UnitError, type UnitJob } from "../../app/src/units/types.ts";
import { requestOf } from "../../app/scripts/unit-case.ts";
import { rewriteAngles as appAngles } from "../../app/src/input/angles.ts";
import type { IndexItem } from "../../app/src/find/types.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
/** yaml from app/node_modules; a git worktree has none, so the main checkout's (as menu-presses.mjs does). */
function yamlFrom(): { parse: (s: string) => unknown } {
  if (existsSync(join(root, "app/node_modules/yaml"))) return createRequire(join(root, "app/package.json"))("yaml") as { parse: (s: string) => unknown };
  const common = execFileSync("git", ["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
  return createRequire(join(dirname(common), "app/package.json"))("yaml") as { parse: (s: string) => unknown };
}
const { parse } = yamlFrom();
type Mode = "rad" | "deg";
type Route = "a" | "b";

// --- the prototype: route R's text rewrite ------------------------------------------------------------------------

const TRIG = ["sin", "cos", "tan", "sec", "csc", "cot"];
const INV = ["asin", "acos", "atan", "asec", "acsc", "acot", "arg"];
const CALL = new RegExp(`(?<![A-Za-z0-9_])(${[...INV, ...TRIG].join("|")})\\s*\\(`, "y");

/** Index of the ) that closes the ( at `open`, outside strings; -1 when there is none. */
function closing(s: string, open: number): number {
  let d = 0;
  for (let k = open; k < s.length; k++) {
    const c = s[k]!;
    if (c === '"') {
      const q = s.indexOf('"', k + 1);
      if (q < 0) return -1;
      k = q;
    } else if (c === "(" || c === "[" || c === "{") d++;
    else if ((c === ")" || c === "]" || c === "}") && --d === 0) return k;
  }
  return -1;
}

/**
 * Route R's emitter, as a rewrite of the Giac text our parser gives: every angle function the user typed takes its
 * argument times pasdeg, and every inverse (and arg) returns its result over pasdeg. `trig: false` leaves sin, cos and
 * tan alone (the unit view's pasua puts the factor in itself). The ° template's `(pi/180)^angle_radian()` needs no
 * change: Giac in radians reads it as pi/180 in every mode.
 */
export function rewriteAngles(text: string, opts: { trig?: boolean } = {}): string {
  // R64: the parser's text carries pasdeg already (app/src/input/angles.ts); never apply the factor twice
  if (/(?<![A-Za-z0-9_])pasdeg(?![A-Za-z0-9_])/.test(text)) return text;
  const trig = opts.trig !== false;
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === '"') {
      const q = text.indexOf('"', i + 1);
      const j = q < 0 ? text.length : q + 1;
      out += text.slice(i, j);
      i = j;
      continue;
    }
    CALL.lastIndex = i;
    const m = CALL.exec(text);
    if (m && (i === 0 || !/[A-Za-z0-9_]/.test(text[i - 1]!))) {
      const name = m[1]!;
      const open = i + m[0].length - 1;
      const close = closing(text, open);
      if (close > 0 && (INV.includes(name) || trig)) {
        const arg = rewriteAngles(text.slice(open + 1, close), opts);
        out += INV.includes(name) ? `(${name}(${arg})/pasdeg)` : `${name}(pasdeg*(${arg}))`;
        i = close + 1;
        continue;
      }
    }
    if (/[A-Za-z_]/.test(c)) {
      const w = /[A-Za-z_0-9]+/y;
      w.lastIndex = i;
      const word = w.exec(text)![0];
      out += word;
      i += word.length;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** One engine per route; both run the app's host (G46: Giac in radians, pasdeg with the mode). */
class Runner {
  readonly host: EngineHost;
  readonly giac: GiacApi;
  readonly route: Route;
  constructor(route: Route, giac: GiacApi) {
    this.route = route;
    this.giac = giac;
    // G46: the host runs Giac in radians and sets pasdeg with the mode itself, so both routes run the app's host; route
    // a is the parser's text as typed (R64 puts the factor in), route b the probe's own rewrite of it
    this.host = new EngineHost(giac);
  }
  /** The settings angle and the text Giac gets, for a typed (parser-output) text in `mode`. */
  prep(text: string, mode: Mode, opts: { trig?: boolean } = {}): { angle: Mode; text: string } {
    return { angle: mode, text: this.route === "a" ? appAngles(text) : rewriteAngles(text, opts) };
  }
  /** `chip`: Giac text that reaches the engine as a chip does (input/emit.ts "Chip"), not through the parser. */
  home(text: string, mode: Mode, digits = 12, chip = false): HomeResult {
    const p = this.prep(chip ? "" : text, mode);
    if (chip) p.text = text;
    return this.host.home(p.text, { ...defaultHomeSettings, angle: p.angle, digits, workDigits: Math.max(30, digits + 10) }).result;
  }
  cas(text: string, mode: Mode, digits = 12): { ok: boolean; text: string; error?: string } {
    const p = this.prep(text, mode);
    const r = this.host.cas(p.text, { ...defaultCasSettings, angle: p.angle, digits }).result;
    return { ok: r.ok, text: r.text, ...(r.error ? { error: r.error } : {}) };
  }
  units(job: UnitJob, mode: Mode): Quantity | UnitError {
    const s = { ...defaultHomeSettings, angle: mode };
    if (this.route === "a") return this.host.units(job, s);
    const rw = (t: string): string => rewriteAngles(t, { trig: false });
    const j: UnitJob = { ...job, expr: rw(job.expr), ...(job.end ? { end: rw(job.end) } : {}), ...(job.unc ? { unc: { ...job.unc, expr: rw(job.unc.expr) } } : {}) };
    return this.host.units(j, s);
  }
}

async function runners(): Promise<Record<Route, Runner>> {
  const a = new Runner("a", (await loadNodeGiac()).giac);
  const b = new Runner("b", (await loadNodeGiac()).giac);
  for (const r of [a, b]) {
    r.giac.eval("timeout 2");
    r.giac.eval("ckevery 10");
  }
  return { a, b };
}

// --- values -------------------------------------------------------------------------------------------------------

type Z = [number, number];
const num = (v: DecimalValue): number => (v.digits === "" ? 0 : (v.neg ? -1 : 1) * Number(`0.${v.digits}e${v.exp + 1}`));
/** A Giac float text (`-0.448+0.893*i`, `1.2e-5`, `0.5*i`) as [re, im]; null if it is not one. */
function zOfText(t: string): Z | null {
  const s = t.replace(/\s/g, "");
  const m = /^([-+]?[\d.]+(?:e[-+]?\d+)?)?(?:([-+]?[\d.]*(?:e[-+]?\d+)?)\*?i)?$/.exec(s);
  if (!m || (!m[1] && m[2] === undefined)) return null;
  const im = m[2] === undefined ? 0 : m[2] === "" || m[2] === "+" ? 1 : m[2] === "-" ? -1 : Number(m[2]);
  return [m[1] ? Number(m[1]) : 0, im];
}
/** Right to the shown digits: each part within 10^-(digits-2) of itself (doubles: at most 1e-14); a part that is
 *  exactly 0 must show as 0. */
function close(got: Z, want: Z, digits = 12): boolean {
  const tol = Math.max(10 ** -(digits - 2), 1e-14);
  const ok = (g: number, w: number): boolean => (w === 0 ? g === 0 : Math.abs(g - w) <= tol * Math.abs(w));
  return ok(got[0], want[0]) && ok(got[1], want[1]);
}
const fmtZ = (z: Z): string => `${+z[0].toPrecision(12)}${z[1] ? `${z[1] < 0 ? "" : "+"}${+z[1].toPrecision(12)}i` : ""}`;

// --- the matrix -------------------------------------------------------------------------------------------------------

/** One step before the measured one: a typed text (parser output) in a view and a mode. */
interface Step {
  view: "home" | "cas";
  mode: Mode;
  text: string;
}
interface MCase {
  id: string;
  from: string;
  /** What the user typed, as our parser emits it (Giac text). */
  text: string;
  view: "home" | "cas" | "solve" | "root" | "plot" | "units";
  mode: Mode;
  before?: Step[];
  /** CAS: a Giac expression run raw on the result (`pcasans`) in the same engine, whose value is checked. */
  then?: string;
  want: Z | string;
  source: "oracle" | "derived";
  note?: string;
  digits?: number;
}

const DEG: Mode = "deg";
const RAD: Mode = "rad";
const C: MCase[] = [
  // D4: hyperbolic functions of an imaginary number read the angle mode (F29: a hyperbolic function has no angle)
  { id: "D4-cosh90i", from: "D4", text: "cosh(90*i)", view: "home", mode: DEG, want: [-0.44807361612917, 0], source: "oracle" },
  { id: "D4-sinh90i", from: "D4", text: "sinh(90*i)", view: "home", mode: DEG, want: [0, 0.893996663600558], source: "oracle" },
  { id: "D4-cosh1+i", from: "D4", text: "cosh(1+i)", view: "home", mode: DEG, want: [0.833730025131149, 0.988897705762865], source: "oracle" },
  { id: "D4-store", from: "D4", text: "H4", view: "home", mode: RAD, before: [{ view: "home", mode: DEG, text: "H4:=cosh(90*i)" }], want: [-0.44807361612917, 0], source: "oracle", note: "stored in DEG, read in RAD" },
  { id: "D4-solve", from: "D4", text: "cosh(i*x)=1/2", view: "solve", mode: DEG, want: [1.0471975511966, 0], source: "oracle", note: "x = acosh(1/2)/i = π/3; the root is not an angle" },
  // D5: one complex input, two values; the analytic reading z° = zπ/180 (the definition of the degree, extended)
  { id: "D5-cos30+i", from: "D5", text: "cos(30+i)", view: "home", mode: DEG, want: [0.866157310344793, -0.00872708931479756], source: "derived", note: "cos((30+i)·π/180), mpmath" },
  { id: "D5-tan45+i", from: "D5", text: "tan(45+i)", view: "home", mode: DEG, want: [0.999391074313146, 0.0348924144079494], source: "derived" },
  { id: "D5-abs-sin1+i", from: "D5", text: "abs(sin(1+i))", view: "home", mode: DEG, want: [0.0246826830406654, 0], source: "derived" },
  { id: "D5-cos-i", from: "D5", text: "cos(i)", view: "home", mode: DEG, want: [1.00015231257626, 0], source: "derived" },
  // D6: inverse trig with a complex result
  { id: "D6-acos2", from: "D6", text: "acos(2)", view: "home", mode: DEG, want: [0, 75.4561292902169], source: "oracle", note: "acos(2)·180/π" },
  { id: "D6-acos1.5", from: "D6", text: "acos(1.5)", view: "home", mode: DEG, want: [0, 55.142813255406], source: "oracle" },
  { id: "D6-asin2-20", from: "D6", text: "asin(2)", view: "home", mode: DEG, digits: 20, want: [90, -75.456129290216892004], source: "oracle", note: "at 20 digits (doubles hold 15–16; the tolerance is 1e-14)" },
  // D7: symbolic calculus. A CAS result is checked by its value as the same engine reads it afterwards.
  { id: "D7-int-atan", from: "D7", text: "integrate(1/(1+x^2),x)", view: "cas", mode: DEG, then: "evalf(subst(pcasans,x=1)-subst(pcasans,x=0))", want: [0.785398163397448, 0], source: "oracle", note: "F(1)−F(0) = π/4 for any antiderivative" },
  { id: "D7-int-asin", from: "D7", text: "integrate(1/sqrt(1-x^2),x)", view: "cas", mode: DEG, then: "evalf(subst(pcasans,x=1/2)-subst(pcasans,x=0))", want: [0.523598775598299, 0], source: "oracle" },
  { id: "D7-desolve", from: "D7", text: "desolve(y''+y=0,y)", view: "cas", mode: DEG, then: "normal(diff(pcasans,x,2)+pcasans)", want: [0, 0], source: "derived", note: "the residual y''+y of the solution must be exactly 0" },
  { id: "D7-ilaplace", from: "D7", text: "ilaplace(1/(s^2+1),s,t)", view: "cas", mode: DEG, then: "evalf(subst(pcasans,t=1))", want: [0.841470984807897, 0], source: "oracle", note: "the inverse transform is sin(t), t not an angle" },
  { id: "D7-laplace", from: "D7", text: "laplace(sin(t),t,s)", view: "cas", mode: DEG, then: "evalf(subst(pcasans,s=1))", want: [0.0174479775620379, 0], source: "oracle", note: "typed in DEG: the transform of sin(t°) = (π/180)/(s²+(π/180)²) at s = 1" },
  { id: "D7-defint-atan", from: "D7", text: "integrate(1/(1+x^2),x,0,1)", view: "home", mode: DEG, want: [0.785398163397448, 0], source: "oracle" },
  { id: "D7-defint-xsinx", from: "D7", text: "integrate(x*sin(x),x,0,90)", view: "home", mode: DEG, want: [3282.80635001174, 0], source: "oracle" },
  { id: "D7-limit", from: "D7", text: "limit((1+1/n)^n,n,inf)", view: "home", mode: DEG, want: [2.71828182845905, 0], source: "oracle" },
  { id: "D7-series", from: "D7", text: "series(exp(x),x,0,3)", view: "cas", mode: DEG, then: "evalf(subst(convert(pcasans,polynom),x=1))", want: [2.66666666666667, 0], source: "derived", note: "1+x+x²/2+x³/6 at 1 = 8/3" },
  { id: "D7-int-sin-0-90", from: "D7 right", text: "integrate(sin(x),x,0,90)", view: "home", mode: DEG, want: [57.2957795130823, 0], source: "derived", note: "180/π, right today" },
  { id: "D7-solve-sin", from: "D7 right", text: "solve(sin(x)=1/2,x)", view: "cas", mode: DEG, want: "[30,150]", source: "derived", note: "right today; text" },
  { id: "D7-diff-sin", from: "D7 right", text: "diff(sin(x),x)", view: "cas", mode: DEG, then: "evalf(subst(pcasans,x=60))", want: [0.00872664625997165, 0], source: "derived", note: "π/180·cos 60° = π/360" },
  // D8: the Function app's curve against its numbers
  { id: "D8-plot", from: "D8", text: "\\sin\\left(x\\right)", view: "plot", mode: DEG, want: [0, 0], source: "derived", note: "the drawn curve at x = 180: sin 180° = 0" },
  { id: "D8-root", from: "D8", text: "sin(x)", view: "root", mode: DEG, want: [180, 0], source: "derived", note: "Root near 170" },
  // D12: a complex power of a negative number
  { id: "D12-(-8)^0.2", from: "D12", text: "(-8)^0.2", view: "home", mode: DEG, want: [1.22624046096256, 0.890915844450196], source: "oracle" },
  { id: "D12-(-1)^0.1", from: "D12", text: "(-1)^0.1", view: "home", mode: DEG, want: [0.951056516295154, 0.309016994374947], source: "oracle" },
  { id: "D12-cas", from: "D12", text: "(-32)^(1/5)", view: "cas", mode: DEG, then: "evalf(pcasans)", want: [1.61803398874989, 1.17557050458495], source: "oracle" },
  // the check's findings 1–4: values that leave their evaluation, and exp in DEG
  { id: "F1-atan-store", from: "F1", text: "TH1", view: "home", mode: RAD, before: [{ view: "home", mode: DEG, text: "TH1:=(atan(3/4))" }], want: [36.869897645844, 0], source: "oracle", note: "the value it showed when stored" },
  { id: "F1-sin-store", from: "F1", text: "S1", view: "home", mode: RAD, before: [{ view: "home", mode: DEG, text: "S1:=sin(1)" }], want: [0.0174524064372835, 0], source: "oracle" },
  { id: "F1-sin-store-rad", from: "F1", text: "V1", view: "home", mode: DEG, before: [{ view: "home", mode: RAD, text: "V1:=sin(1)" }], want: [0.841470984807897, 0], source: "oracle" },
  { id: "F1-ans-text", from: "F1", text: "sin(1)", view: "home", mode: DEG, then: "full", want: [0.0174524064372835, 0], source: "oracle", note: "the result's full text (Ans, \\res chip) read again in RAD" },
  { id: "F1-ans-text-rad", from: "F1", text: "atan(3/4)", view: "home", mode: RAD, then: "full", want: [0.643501108793284, 0], source: "oracle", note: "a RAD result's full text read again in DEG" },
  { id: "F2-exp-store", from: "F2", text: "A2", view: "home", mode: RAD, before: [{ view: "home", mode: DEG, text: "A2:=exp(i*90)" }], want: [-0.44807361612917, 0.893996663600558], source: "oracle" },
  { id: "F2-exp-store-2", from: "F2", text: "C2", view: "home", mode: RAD, before: [{ view: "home", mode: DEG, text: "C2:=exp(1+30*i)" }], want: [0.419298913242881, -2.6857484097145], source: "oracle" },
  { id: "F3-int-exp", from: "F3", text: "integrate(exp(i*x),x,0,90)", view: "home", mode: DEG, want: [0.893996663600558, 1.44807361612917], source: "oracle", note: "exp ignores the mode (F29)" },
  { id: "F4-fn-rad", from: "F4", text: "gr4(90)", view: "home", mode: DEG, before: [{ view: "home", mode: RAD, text: "gr4(x):=exp(i*x)" }], want: [-0.44807361612917, 0.893996663600558], source: "oracle" },
  { id: "F4-library", from: "F4", text: "q4(90)", view: "home", mode: DEG, before: [{ view: "cas", mode: RAD, text: "q4(w):=exp(i*w)" }], want: [-0.44807361612917, 0.893996663600558], source: "oracle", note: "importLibrary defines through cas() in RAD" },
  // the user's own functions follow the mode at call time (as on the G2), under both routes
  { id: "fn-deg-call-deg", from: "S14", text: "f5(30)", view: "home", mode: DEG, before: [{ view: "home", mode: DEG, text: "f5(x):=sin(x)" }], want: [0.5, 0], source: "derived" },
  { id: "fn-deg-call-rad", from: "S14", text: "f6(pi/6)", view: "home", mode: RAD, before: [{ view: "home", mode: DEG, text: "f6(x):=sin(x)" }], want: [0.5, 0], source: "derived" },
  // plain cases that are right today (controls)
  { id: "ctl-sin30", from: "control", text: "sin(30)", view: "home", mode: DEG, want: [0.5, 0], source: "derived" },
  { id: "ctl-asin", from: "control", text: "asin(1/2)", view: "home", mode: DEG, want: [30, 0], source: "derived" },
  { id: "ctl-arg", from: "control", text: "arg(1+i)", view: "home", mode: DEG, want: [45, 0], source: "derived" },
  { id: "ctl-polar", from: "control", text: "2*(cos(30)+i*sin(30))", view: "home", mode: DEG, want: [1.73205080756888, 1], source: "derived", note: "the polar entry 2∡30 as emit.ts writes it" },
  { id: "ctl-deg-template", from: "control", text: "sin(30*(pi/180)^angle_radian())", view: "home", mode: RAD, want: [0.5, 0], source: "derived", note: "the ° template in RAD" },
  { id: "ctl-exp-ipi", from: "control", text: "exp(i*pi)", view: "home", mode: DEG, want: [-1, 0], source: "derived" },
  { id: "ctl-sin30-rad", from: "control", text: "sin(30)", view: "home", mode: RAD, want: [-0.988031624092862, 0], source: "oracle" },
  // (c) the unit view: a bare number in sin follows the mode; an inverse gives a bare number in the mode's unit
  { id: "U-sin30-deg", from: "units d37", text: "sin(30)", view: "units", mode: DEG, want: [0.5, 0], source: "derived" },
  { id: "U-sin30deg-rad", from: "units d26", text: "sin(30*{deg})", view: "units", mode: RAD, want: [0.5, 0], source: "derived" },
  { id: "U-asin-m-deg", from: "units, sibling", text: "asin(1/2)*2*{m}", view: "units", mode: DEG, want: [60, 0], source: "derived", note: "today's rule: an inverse gives a number in the mode's unit (d39), so 60 m" },
  { id: "U-asin-m-rad", from: "units, sibling", text: "asin(1/2)*2*{m}", view: "units", mode: RAD, want: [1.0471975511966, 0], source: "oracle" },
];

interface Got {
  verdict: "right" | "WRONG" | "error";
  shown: string;
  mark: string;
}

function homeGot(r: HomeResult, want: Z | string, digits = 12): Got {
  const m = markOf(r, { format: "STD", digits });
  const mark = m ? `${m.mark}${m.mark === "⚠" && m.n !== undefined ? m.n : ""}` : "";
  if (!r.ok) return { verdict: "error", shown: r.display.slice(0, 60), mark };
  if (typeof want === "string") return { verdict: r.display === want ? "right" : "WRONG", shown: r.display, mark };
  if (r.items || !r.value) return { verdict: "WRONG", shown: r.display.slice(0, 60), mark };
  const z: Z = [num(r.value.re), num(r.value.im)];
  return { verdict: close(z, want, digits) ? "right" : "WRONG", shown: r.display, mark };
}

function zGot(text: string, want: Z | string, mark = ""): Got {
  if (/GIAC_ERROR|error|radian mode/i.test(text)) return { verdict: "error", shown: text.slice(0, 60), mark };
  if (typeof want === "string") return { verdict: text.replace(/\s|^list/g, "") === want ? "right" : "WRONG", shown: text, mark };
  const z = zOfText(text);
  return { verdict: z && close(z, want) ? "right" : "WRONG", shown: text.slice(0, 60), mark };
}

let unitTable: ReturnType<typeof factorTable> | null | undefined;
function units(): ReturnType<typeof factorTable> | null {
  if (unitTable !== undefined) return unitTable;
  const f = process.env.FIND_INDEX_JSON ?? `${root}app/src/find/_gen/find-index.json`;
  unitTable = existsSync(f) ? factorTable(JSON.parse(readFileSync(f, "utf8")) as IndexItem[]) : null;
  return unitTable;
}

function runCase(R: Runner, c: MCase): Got {
  for (const b of c.before ?? []) (b.view === "home" ? R.home(b.text, b.mode) : R.cas(b.text, b.mode));
  switch (c.view) {
    case "home": {
      const r = R.home(c.text, c.mode, c.digits ?? 12);
      if (c.then !== "full") return homeGot(r, c.want, c.digits ?? 12);
      // the result's full text, as Ans and a \res chip carry it, read again in the other mode
      return homeGot(R.home(`(${r.full})`, c.mode === "deg" ? "rad" : "deg", 12, true), c.want);
    }
    case "cas": {
      const r = R.cas(c.text, c.mode);
      if (!r.ok) return { verdict: "error", shown: r.text.slice(0, 60), mark: "" };
      if (!c.then) return zGot(r.text, c.want);
      const v = R.giac.eval(c.then);
      return { ...zGot(v, c.want), shown: `${r.text.slice(0, 50)} → ${v.slice(0, 30)}` };
    }
    case "solve": {
      const p = R.prep(c.text, c.mode);
      const out = R.host.solve({ kind: "equations", equations: [p.text], unknowns: ["x"], guesses: ["1"] }, { ...defaultHomeSettings, angle: p.angle });
      if (!out.ok) return { verdict: "error", shown: out.info ?? out.error, mark: "" };
      return homeGot(out.roots[0]!.result, c.want);
    }
    case "root": {
      const p = R.prep(c.text, c.mode);
      const r = R.host.analyze({ kind: "root", f: p.text, x0: "170" }, { ...defaultHomeSettings, angle: p.angle });
      if (!r.ok) return { verdict: "error", shown: r.info ?? r.error ?? "", mark: "" };
      return homeGot(r.x!, c.want);
    }
    case "plot": {
      // the curve: emit-js's JS source; route b multiplies the argument of each angle function by the mode's factor
      // route a: the app's plot, which draws in degrees in DEG (R64a); route b: S14's factor on the radian source
      const deg = c.mode === "deg" ? Math.PI / 180 : 1;
      const src = R.route === "a" ? jsonToJs(parseLatex(c.text), ["x"], c.mode === "deg") : jsonToJs(parseLatex(c.text), ["x"]).replace(/Math\.(sin|cos|tan)\(/g, "Math.$1(pasdeg*");
      const f = new Function("x", "pasdeg", `return ${src};`) as (x: number, d: number) => number;
      const y = f(180, deg);
      const ok = Math.abs(y - (c.want as Z)[0]) < 1e-12;
      return { verdict: ok ? "right" : "WRONG", shown: `y(180) = ${+y.toPrecision(6)}`, mark: "" };
    }
    case "units": {
      const t = units();
      if (!t) return { verdict: "error", shown: "no Find index", mark: "" };
      const job = buildJob(requestOf(R.route === "a" ? appAngles(c.text) : c.text, undefined, t), t); // route a: the parser's text
      if (isUnitError(job)) return { verdict: "error", shown: JSON.stringify(job), mark: "" };
      const q = R.units(job, c.mode);
      if (isUnitError(q)) return { verdict: "error", shown: JSON.stringify(q), mark: "" };
      const g = homeGot(q.value, c.want);
      return { ...g, shown: `${g.shown} ${q.unit}` };
    }
  }
}

async function matrix(): Promise<void> {
  const R = await runners();
  const count = { a: { right: 0, WRONG: 0, error: 0 }, b: { right: 0, WRONG: 0, error: 0 } };
  const pad = (s: string, n: number): string => (s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n));
  console.log(`${pad("case", 18)} ${pad("mode", 4)} ${pad("right value", 26)} | ${pad("a: today", 44)} | b: route R`);
  for (const c of C) {
    const ga = runCase(R.a, c);
    const gb = runCase(R.b, c);
    count.a[ga.verdict]++;
    count.b[gb.verdict]++;
    const cell = (g: Got): string => `${g.verdict === "right" ? "ok" : g.verdict} ${g.mark} ${g.shown}`;
    const want = typeof c.want === "string" ? c.want : fmtZ(c.want);
    console.log(`${pad(c.id, 18)} ${pad(c.mode, 4)} ${pad(`${want} (${c.source})`, 26)} | ${pad(cell(ga), 44)} | ${cell(gb)}`);
  }
  console.log(`\n${C.length} cases. a (today): ${count.a.right} right, ${count.a.WRONG} wrong, ${count.a.error} error. b (route R): ${count.b.right} right, ${count.b.WRONG} wrong, ${count.b.error} error.`);
}

// --- golden: every input today and rewritten ----------------------------------------------------------------------

interface GCase {
  id: string;
  kind?: string;
  input?: string;
  latex?: string;
  before?: string[];
  beforeHome?: string[];
  eq?: string | string[];
  var?: string | string[];
  guess?: string | string[];
  f?: string | string[];
  g?: string;
  x0?: string;
  lo?: string;
  hi?: string;
  a?: string;
  b?: string;
  xs?: string[];
  to?: string;
  settings?: { angle?: Mode; digits?: number };
}
const gcases = (file: string): GCase[] => (parse(readFileSync(`${root}tests/golden/${file}`, "utf8")) as { cases: GCase[] }).cases;
const one = (x: string | string[] | undefined): string => (Array.isArray(x) ? x[0]! : x!);
const many = (x: string | string[] | undefined): string[] => (Array.isArray(x) ? x : [x!]);

function homeShown(r: HomeResult, digits: number): string {
  const m = markOf(r, { format: "STD", digits });
  return `${m ? `${m.mark}${m.n ?? ""} ` : ""}${r.ok ? r.display : `error ${r.display.slice(0, 40)}`}`;
}

function goldenOne(R: Runner, file: string, c: GCase): string {
  const mode: Mode = c.settings?.angle ?? "rad";
  const digits = c.settings?.digits ?? 12;
  const giacOf = (t: string): string => (c.latex !== undefined ? latexToGiac(t) : t);
  const hs = (angle: Mode): HomeSettings => ({ ...defaultHomeSettings, angle, digits });
  try {
    if (file === "home.yaml" || (file === "precision.yaml" && c.kind !== "cas")) {
      for (const b of c.before ?? []) R.home(giacOf(b), mode, digits);
      return homeShown(R.home(c.latex !== undefined ? giacOf(c.latex) : c.input!, mode, digits), digits);
    }
    if (file === "precision.yaml" || file === "bench.yaml") {
      for (const b of c.beforeHome ?? []) R.home(giacOf(b), mode, digits);
      for (const b of c.before ?? []) R.cas(giacOf(b), mode, digits);
      const r = R.cas(c.latex !== undefined ? giacOf(c.latex) : c.input!, mode, digits);
      return r.ok ? r.text : `error ${r.error}`;
    }
    if (file === "solve.yaml") {
      if (!c.kind) {
        const p = R.prep(one(c.eq), mode);
        return solve1(R.giac, p.text, one(c.var), one(c.guess), defaultSolveSettings).display;
      }
      const eqs = many(c.eq).map((e) => R.prep(e, mode));
      const req = c.kind === "poly" ? { kind: "poly" as const, equation: eqs[0]!.text, unknown: one(c.var) } : { kind: "equations" as const, equations: eqs.map((e) => e.text), unknowns: many(c.var), guesses: many(c.guess) };
      const r = R.host.solve(req, hs(eqs[0]!.angle));
      return r.ok ? r.roots.map((x) => homeShown(x.result, digits)).join("; ") : `no: ${r.error}`;
    }
    if (file === "function.yaml") {
      const fs = many(c.f).map((f) => R.prep(f, mode));
      const s = hs(fs[0]!.angle);
      const v = one(c.var ?? "x");
      if (c.kind === "table") return R.host.table({ fns: fs.map((f) => f.text), xs: c.xs!, variable: v }, s).map((row) => row.map((x) => x.display).join(",")).join("; ");
      const g = c.g ? R.prep(c.g, mode).text : undefined;
      const f = fs[0]!.text;
      const r =
        c.kind === "slope" ? R.host.analyze({ kind: "slope", f, x0: c.x0!, variable: v }, s)
        : c.kind === "area" ? R.host.analyze({ kind: "area", f, ...(g ? { g } : {}), a: c.a!, b: c.b!, variable: v }, s)
        : c.kind === "intersection" ? R.host.analyze({ kind: "intersection", f, g: g!, x0: c.x0!, lo: c.lo, hi: c.hi, variable: v }, s)
        : R.host.analyze({ kind: c.kind === "extremum" ? "extremum" : "root", f, x0: c.x0!, lo: c.lo, hi: c.hi, variable: v }, s);
      return r.ok ? [r.value, r.x, r.y].filter(Boolean).map((x) => homeShown(x!, digits)).join("; ") : `no: ${r.error}`;
    }
    if (file === "units.yaml") {
      const t = units();
      if (!t) return "no Find index";
      const job = buildJob(requestOf(c.input!, c.to, t), t);
      if (isUnitError(job)) return `refused ${job.error}`;
      const q = R.units(job, mode);
      return isUnitError(q) ? `refused ${q.error}` : `${homeShown(q.value, 12)} ${q.unit}${q.unc ? ` ± ${q.unc.text}` : ""}`;
    }
  } catch (e) {
    return `throws ${(e as Error).message.slice(0, 60)}`;
  }
  return "?";
}

async function golden(): Promise<void> {
  const files = ["home.yaml", "precision.yaml", "bench.yaml", "solve.yaml", "function.yaml", "units.yaml"];
  let total = 0;
  let changed = 0;
  for (const file of files) {
    const R = await runners();
    const cs = gcases(file);
    let n = 0;
    for (const c of cs) {
      const a = goldenOne(R.a, file, c);
      const b = goldenOne(R.b, file, c);
      total++;
      if (a !== b) {
        n++;
        console.log(`  ${file} ${c.id} [${c.settings?.angle ?? "rad"}] ${c.input ?? c.latex ?? one(c.eq ?? c.f)}\n      a: ${a}\n      b: ${b}`);
      }
    }
    changed += n;
    console.log(`${file}: ${cs.length} cases, ${n} changed`);
  }
  console.log(`golden: ${total} cases, ${changed} changed`);
}

// --- (a) the CAS view in DEG: three display options ---------------------------------------------------------------

/** Giac's radian result as the mode reads it (option 2): trig(u) → trig of u·180/π read in degrees, an inverse's
 *  radians → π/180 times the inverse read in degrees. The inert names pasd* let Giac do the arithmetic and keep the
 *  functions unevaluated; `normal` tidies each argument, and the whole text only when an inverse was met. */
export function backInDegrees(giac: GiacApi, text: string): string {
  let inverse = false;
  const walk = (t: string): string => {
    let out = "";
    let i = 0;
    while (i < t.length) {
      CALL.lastIndex = i;
      const m = CALL.exec(t);
      if (m && (i === 0 || !/[A-Za-z0-9_]/.test(t[i - 1]!)) && m[1] !== "arg") {
        const open = i + m[0].length - 1;
        const close = closing(t, open);
        if (close > 0) {
          const arg = walk(t.slice(open + 1, close));
          if (TRIG.includes(m[1]!)) out += `pasd${m[1]}(normal(180/pi*(${arg})))`;
          else {
            inverse = true;
            out += `(pi/180*pasd${m[1]}(${arg}))`;
          }
          i = close + 1;
          continue;
        }
      }
      out += t[i];
      i++;
    }
    return out;
  };
  const w = walk(text);
  const out = giac.eval(inverse ? `normal(${w})` : w);
  return out.replace(/pasd([a-z]+)\(/g, "$1(");
}

/** Option 3: the radian text kept, every angle the parser put in shown as u° (sin(pi*x/180) → sin(x°)). */
function markedDegrees(giac: GiacApi, text: string): string {
  const back = backInDegrees(giac, text);
  let out = "";
  let i = 0;
  const re = new RegExp(`(?<![A-Za-z0-9_])(${TRIG.join("|")})\\(`, "y");
  while (i < back.length) {
    re.lastIndex = i;
    const m = re.exec(back);
    if (m) {
      const open = i + m[0].length - 1;
      const close = closing(back, open);
      const arg = back.slice(open + 1, close);
      out += `${m[1]}(${/^[A-Za-z0-9_.]+$/.test(arg) ? arg : `(${arg})`}°)`;
      i = close + 1;
      continue;
    }
    out += back[i];
    i++;
  }
  // an inverse returns radians: shown with its factor to degrees
  return out.replace(/pi\/180\*(a(?:sin|cos|tan|sec|csc|cot))\(/g, "$1_rad(");
}

async function display(): Promise<void> {
  const { b } = await runners();
  const inputs = ["diff(sin(x),x)", "integrate(1/(1+x^2),x)", "integrate(sin(x)^2,x)", "desolve(y''+y=0,y)", "laplace(sin(t),t,s)", "(-32)^(1/5)", "solve(sin(x)=1/2,x)", "atan(3/4)", "simplify(sin(x)^2+cos(x)^2)", "series(sin(x),x,30,3)", "exp(i*x)", "f7(x):=sin(x)"];
  for (const input of inputs) {
    const r = b.cas(input, "deg");
    const t0 = performance.now();
    const two = backInDegrees(b.giac, r.text);
    const ms = performance.now() - t0;
    console.log(`${input}\n   1 as printed:      ${r.text}\n   2 rewritten back:  ${two}   (${ms.toFixed(2)} ms)\n   3 marked with °:   ${markedDegrees(b.giac, r.text)}`);
  }
}

// --- (e) Enter time --------------------------------------------------------------------------------------------------

async function bench(): Promise<void> {
  const cs = gcases("home.yaml");
  const inputs = cs.map((c) => (c.latex !== undefined ? latexToGiac(c.latex) : c.input!));
  const trig = inputs.filter((t) => rewriteAngles(t) !== t);
  const runs = Number(process.env.RUNS ?? 7);
  for (const mode of ["rad", "deg"] as const) {
    const R = await runners();
    for (const set of [{ name: "all", xs: inputs }, { name: "with an angle function", xs: trig }]) {
      const p95: Record<Route, number> = { a: 0, b: 0 };
      const med: Record<Route, number> = { a: 0, b: 0 };
      const each: Record<Route, number[]> = { a: [], b: [] };
      for (const route of ["a", "b"] as const) {
        const r = R[route];
        for (const x of set.xs) r.home(x, mode); // warm
        const per = set.xs.map((x) => {
          const ts: number[] = [];
          for (let k = 0; k < runs; k++) {
            const t0 = performance.now();
            r.home(x, mode);
            ts.push(performance.now() - t0);
          }
          return ts.sort((p, q) => p - q)[Math.floor(runs / 2)]!;
        });
        each[route] = per;
        const s = [...per].sort((p, q) => p - q);
        p95[route] = s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]!;
        med[route] = s[Math.floor(s.length / 2)]!;
      }
      console.log(`${mode} ${set.name} (${set.xs.length} inputs, median of ${runs} each): median a ${med.a.toFixed(2)} ms, b ${med.b.toFixed(2)} ms; p95 a ${p95.a.toFixed(2)} ms, b ${p95.b.toFixed(2)} ms`);
      if (set.name === "all") {
        const top = set.xs.map((x, k) => ({ x, a: each.a[k]!, b: each.b[k]! })).sort((p, q) => q.b - q.a - (p.b - p.a)).slice(0, 5);
        for (const t of top) console.log(`   slower in b: ${t.x.slice(0, 60)}  a ${t.a.toFixed(2)} ms, b ${t.b.toFixed(2)} ms`);
      }
    }
  }
}

const arg = process.argv[2];
if (arg === "--golden") await golden();
else if (arg === "--display") await display();
else if (arg === "--bench") await bench();
else await matrix();
