// SPDX-License-Identifier: GPL-3.0-or-later
// stages solve and function
import { EngineHost, type GiacApi } from "../../src/engine/host.ts";
import { type Case, type Expect } from "../../src/goldenRun.ts";
import { precisionFacts, type HomeResult } from "../../src/engine/homeEval.ts";
import { markOf } from "../../src/engine/format.ts";
import { defaultSolveSettings, solve1, type SolveResult } from "../../src/engine/solve1.ts";
import { root, ROUNDS, cases, freshEngine, report, str, list, expectAt, caseSettings, same } from "./lib.ts";

/** What a case produced: the shown text(s), and whether ⚠ was raised. `n`: per shown value, the confirmed digits when
 *  it is shown with ⚠ n (fewer than the case's digits); `expect` is then compared rounded to them. */
interface Got {
  shown: Expect;
  warn: boolean;
  n?: (number | undefined)[];
}

/** ⚠ n of one result at `digits` (undefined when every digit shown is confirmed), and whether it carries ⚠ at all. */
function confirmedN(r: HomeResult, digits: number): { n: number | undefined; warn: boolean } {
  const m = markOf(precisionFacts(r), { format: "STD", digits });
  return { n: m?.mark === "⚠" && m.n !== undefined && m.n < digits ? Math.max(1, m.n) : undefined, warn: m?.mark === "⚠" };
}

/** The results' texts, ⚠ n per result, and whether any is ⚠. */
function shownOf(rs: HomeResult[], digits: number): { shown: string[]; n: (number | undefined)[]; warn: boolean } {
  const cs = rs.map((r) => confirmedN(r, digits));
  return { shown: rs.map((r) => r.display), n: cs.map((c) => c.n), warn: cs.some((c) => c.warn) };
}

/** `expect` with each entry rounded to the digits its result was shown with (⚠ n). */
function expectShown(expect: Expect | undefined, n: (number | undefined)[] | undefined): Expect | undefined {
  if (expect === undefined || !n?.some((x) => x !== undefined)) return expect;
  const at = (e: Expect, k: number | undefined): Expect => (k === undefined || typeof e !== "string" ? e : (expectAt(e, k) ?? `${e} (cannot round to ${k})`));
  if (typeof expect === "string") return at(expect, n[0]);
  return expect.map((e, i) => at(e, n[i]));
}


export function solveCase(host: EngineHost, _g: GiacApi, c: Case): Got {
  const s = caseSettings(c);
  if (!c.kind) {
    const r: SolveResult = solve1(host.giac, str(c.eq), str(c.var), str(c.guess), defaultSolveSettings);
    return { shown: r.display, warn: r.warn };
  }
  const r =
    c.kind === "poly"
      ? host.solve({ kind: "poly", equation: str(c.eq), unknown: str(c.var) }, s)
      : host.solve({ kind: "equations", equations: list(c.eq), unknowns: list(c.var), guesses: list(c.guess) }, s);
  if (r.ok) {
    const o = shownOf(r.roots.map((x) => x.result), s.digits);
    // One equation (kind one): a single root, shown as a string like the solve1 cases.
    return { shown: c.kind === "one" ? o.shown[0]! : o.shown, n: o.n, warn: r.warn || o.warn };
  }
  return { shown: r.error === "bad-input" && c.kind === "poly" ? "not a polynomial" : r.error === "no-root" ? "no root found" : r.info, warn: r.warn };
}

export function functionCase(host: EngineHost, c: Case): Got {
  const s = caseSettings(c);
  if (c.kind === "table") {
    const rows = host.table({ fns: list(c.f), xs: c.xs!, variable: str(c.var ?? "x") }, s);
    return { shown: rows.map((row) => row.map((x) => x.display)), warn: false };
  }
  const f = str(c.f);
  const variable = str(c.var ?? "x");
  const r =
    c.kind === "slope"
      ? host.analyze({ kind: "slope", f, x0: c.x0!, variable }, s)
      : c.kind === "area"
        ? host.analyze({ kind: "area", f, ...(c.g ? { g: c.g } : {}), a: c.a!, b: c.b!, variable }, s)
        : c.kind === "intersection"
          ? host.analyze({ kind: "intersection", f, g: c.g!, x0: c.x0!, lo: c.lo, hi: c.hi, variable }, s)
          : host.analyze({ kind: c.kind === "extremum" ? "extremum" : "root", f, x0: c.x0!, lo: c.lo, hi: c.hi, variable }, s);
  if (!r.ok) return { shown: r.error === "no-root" ? (c.kind === "area" ? "no area" : "no root found") : r.info, warn: r.warn };
  if (c.kind === "slope" || c.kind === "area") {
    const o = shownOf([r.value!], s.digits);
    return { shown: o.shown[0]!, n: o.n, warn: r.warn || o.warn };
  }
  const o = shownOf([r.x!, r.y!], s.digits);
  return { shown: c.kind === "extremum" ? [...o.shown, r.extremum!] : o.shown, n: o.n, warn: r.warn || o.warn };
}

/** Runs every case of `file` ROUNDS times on fresh engines; a case passes when every round shows `expect`
 *  and raises ⚠ exactly when the case says status "warn". */
export async function stageCases(stage: string, file: string, run: (host: EngineHost, g: GiacApi, c: Case) => Got): Promise<void> {
  const cs = cases(file);
  const runs = new Map<string, Got[]>(cs.map((c) => [c.id, []]));
  for (let r = 0; r < ROUNDS; r++) {
    const { giac: g, bridge } = await freshEngine();
    g.eval("timeout 2");
    g.eval("ckevery 10");
    const host = new EngineHost(g, bridge);
    for (const c of cs) runs.get(c.id)!.push(run(host, g, c));
  }
  let pass = 0;
  for (const c of cs) {
    const rs = runs.get(c.id)!;
    const wantWarn = c.status === "warn";
    if (rs.every((x) => same(x.shown, expectShown(c.expect, x.n)) && x.warn === wantWarn)) pass++;
    else
      console.log(
        `  ${stage} ${c.id}: got ${rs.map((x) => `${JSON.stringify(x.shown)}${x.warn ? ` ⚠${x.n?.some((k) => k !== undefined) ? JSON.stringify(x.n) : ""}` : ""}`).join(" / ")}, expect ${JSON.stringify(c.expect)}${wantWarn ? " ⚠" : ""}`,
      );
  }
  report(stage, pass === cs.length, `${pass}/${cs.length} match, rounds ${ROUNDS}`);
}
