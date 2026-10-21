// SPDX-License-Identifier: GPL-3.0-or-later
// G63: the engine half of the view sweep: expressions in x (G61's generator) are asked the same value from Home (x stored), CAS evalf,
// Num, the plot evaluator (against Giac's evalf(…, 20)), Solve (the residual at a root), Slope (against Home's diff) and Area
// (against Home's int); views.ts compares them. In process, one engine; Home's own deadline bounds a case.
import { compileDefinition } from "../../../app/src/apps/function/compile.ts";
import { markOf, type ComplexValue } from "../../../app/src/engine/format.ts";
import { defaultHomeSettings, pasdegCommand, type HomeResult, type HomeSettings } from "../../../app/src/engine/homeEval.ts";
import { EngineHost } from "../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../app/src/engine/nodeGiac.ts";
import { defaultCasSettings } from "../../../app/src/engine/types.ts";
import { generate, type Case } from "./gen.ts";
import { compareViews, comparePlot, numView, type View } from "./views.ts";

export const XS = ["-2.7", "-1", "-0.5", "0", "0.3", "1", "2", "4.5"];
const SLOPE_XS = ["0.3", "1"];
const AREAS: [string, string][] = [["0", "1"], ["-1", "0.5"]];
const DIGITS = 12;

/** Inputs that were found wrong and stay in every run: F56 (Area refused ∫₀¹ ln x, hunt N6; G70). */
export const PINNED_X: Case[] = [
  { latex: "\\ln\\left(x\\right)", mp: "", angle: false },
  { latex: "x\\times \\ln\\left(x\\right)", mp: "", angle: false },
  { latex: "\\frac{1-\\cos\\left(x\\right)}{x^{2}}", mp: "", angle: true },
  { latex: "\\frac{1}{x}", mp: "", angle: false },
];

export interface ViewFailure {
  id: string;
  check: string;
  detail: string;
}
export interface ViewSweepResult {
  failures: ViewFailure[];
  compared: number;
  cases: number;
}

/** The view of a Home-style result at the digits it ran at. A failed result is a refusal (a timeout is not compared). */
export function viewOfResult(r: HomeResult): View {
  if (!r.ok) return r.error === "timeout" ? { kind: "other" } : { kind: "refused" };
  if (!r.value || r.items) return { kind: "other" };
  const m = markOf(r, { format: "STD", digits: DIGITS });
  const claim = m === null ? DIGITS : m.mark === "⚠" ? (m.n === undefined || m.n < 1 ? null : m.n) : DIGITS;
  return numView(r.value as ComplexValue, claim);
}

/** Cases with no fixed x in them are not interesting for a function; the generator's depth 2 keeps the engine's work small. */
export function viewCases(seed: number, count: number): Case[] {
  const seen = new Set<string>();
  return [...PINNED_X, ...generate(seed, count, { x: true, depth: 2 })].filter((c) => {
    if (!c.latex.includes("x") || seen.has(c.latex)) return false;
    seen.add(c.latex);
    return true;
  });
}

export interface Limits {
  roots: number;
  slopes: number;
  areas: number;
}

export async function viewSweep(seed: number, count: number, lim: Limits): Promise<ViewSweepResult> {
  const { giac } = await loadNodeGiac();
  giac.eval(pasdegCommand("rad"));
  const host = new EngineHost(giac);
  const cases = viewCases(seed, count);
  const failures: ViewFailure[] = [];
  let compared = 0;
  const diff = (angle: string, check: string, x: string, latex: string, d: string | null): void => {
    compared++;
    if (d !== null) failures.push({ id: `${angle} ${x} ${latex}`, check, detail: d });
  };
  /** Giac keeps an assumption on x after some calls (F64: Home's int of tanh(√x)); it would change every later case, so it is a finding and is cleared. */
  const leak = (angle: string, latex: string, where: string): void => {
    const about = host.eval("about(x)").output.trim();
    if (about === "x") return;
    failures.push({ id: `${angle} ${where} ${latex}`, check: "leak", detail: `x holds ${about}` });
    host.eval("purge(x)");
  };
  for (const angle of ["rad", "deg"] as const) {
    const s: HomeSettings = { ...defaultHomeSettings, angle, digits: DIGITS, workDigits: 30 };
    const cs = cases
      .filter((c) => angle === "rad" || c.angle)
      .map((c) => ({ c, k: compileDefinition(c.latex, angle) }))
      .filter((e) => e.k.giac !== "" && e.k.error === "");
    // Num: one call
    const table = host.table({ fns: cs.map((e) => e.k.giac), xs: XS }, s);
    leak(angle, "(Num table)", "num");
    // Home with x stored
    const home: View[][] = [];
    for (const x of XS) {
      host.home(`x:=${x}`, s);
      home.push(cs.map((e) => viewOfResult(host.home(e.k.giac, s).result)));
      host.home("purge(x)", s);
      leak(angle, "(Home with x stored)", x);
    }
    cs.forEach((e, fi) => {
      XS.forEach((x, xi) => {
        const h = home[xi]![fi]!;
        diff(angle, "num", x, e.c.latex, compareViews(h, viewOfResult(table[xi]![fi]!)));
        const cas = host.cas(`evalf(subst(${e.k.giac},x=(${x})))`, { ...defaultCasSettings, angle, digits: DIGITS }).result;
        leak(angle, e.c.latex, `cas ${x}`);
        diff(angle, "cas", x, e.c.latex, compareViews(h, cas.ok ? (cas.numeric ? viewOfResult(cas.numeric) : { kind: "other" }) : { kind: "refused" }));
      });
    });
    // The plot evaluator against Giac's evalf(…, 20), in the mode Home just left
    host.home("0", s);
    cs.forEach((e) => {
      if (!e.k.fn) return;
      for (const x of XS) {
        const out = host.eval(`evalf(subst(${e.k.giac},x=(${x})),20)`).output.trim();
        if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(out)) continue; // not a real number: not compared
        diff(angle, "plot", x, e.c.latex, comparePlot(e.k.fn(Number(x)), Number(out)));
      }
    });
    cs.slice(0, lim.slopes).forEach((e) => {
      for (const x of SLOPE_XS) {
        const a = host.analyze({ kind: "slope", f: e.k.giac, x0: x }, s);
        const h = host.home(`subst(diff(${e.k.giac},x),x=(${x}))`, s).result;
        leak(angle, e.c.latex, `slope ${x}`);
        diff(angle, "slope", x, e.c.latex, compareViews(viewOfResult(h), a.ok && a.value ? viewOfResult(a.value) : { kind: "refused" }));
      }
    });
    cs.slice(0, lim.areas).forEach((e) => {
      for (const [lo, hi] of AREAS) {
        const a = host.analyze({ kind: "area", f: e.k.giac, a: lo, b: hi }, s);
        const h = host.home(`int(${e.k.giac},x,${lo},${hi})`, s).result;
        leak(angle, e.c.latex, `area ${lo}..${hi}`);
        diff(angle, "area", `${lo}..${hi}`, e.c.latex, compareViews(viewOfResult(h), a.ok && a.value ? viewOfResult(a.value) : { kind: "refused" }));
      }
    });
    cs.slice(0, lim.roots).forEach((e) => {
      if (!e.k.fn) return;
      const r = host.analyze({ kind: "root", f: e.k.giac, x0: "1", lo: "-10", hi: "10" }, s);
      leak(angle, e.c.latex, "root");
      // The residual of the root each app shows: the Function app's Root and the Solve app's answer for f(x)=0 (same settings, same guess).
      const residual = (check: string, ok: boolean, warn: boolean, xv: ComplexValue | undefined, display: string): void => {
        if (!ok || warn || !xv || xv.im.digits !== "") return;
        const xr = numView(xv, DIGITS);
        if (xr.kind !== "num") return;
        // the root is shown to 12 digits: f there is as small as f' times that rounding
        const h = 1e-6 * Math.max(1, Math.abs(xr.v));
        const slope = (e.k.fn!(xr.v + h) - e.k.fn!(xr.v - h)) / (2 * h);
        const res = Math.abs(e.k.fn!(xr.v));
        const tol = 1e-9 * Math.max(1, Math.abs(xr.v) * Math.abs(Number.isFinite(slope) ? slope : 1));
        compared++;
        if (!(res <= tol)) failures.push({ id: `${angle} ${check} ${e.c.latex}`, check, detail: `f(${display}) = ${res.toExponential(2)}, tolerance ${tol.toExponential(2)}` });
      };
      residual("root", r.ok, r.warn, r.x?.value, r.x?.display ?? "");
      const so = host.solve({ kind: "equations", equations: [`(${e.k.giac})=0`], unknowns: ["x"], guesses: ["1"] }, s);
      residual("solve", so.ok, so.warn, so.roots[0]?.result.value, so.roots[0]?.result.display ?? "");
    });
  }
  return { failures, compared, cases: cases.length };
}
