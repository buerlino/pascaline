// SPDX-License-Identifier: GPL-3.0-or-later
// EngineHost against the real Giac build (skipped when no build is found; see nodeGiac.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost, REPLAY_BATCH } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { formatComplex, markOf, type FormatOptions } from "./format.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { latexToGiac } from "../input/latex-to-giac.ts";
import { exportLibrary } from "./library.ts";
import { ICDF_DEFINITIONS, icdfPolished } from "./icdf.ts";

describe.skipIf(!giacAvailable())("EngineHost (real Giac)", () => {
  let host: EngineHost;
  let giac: Awaited<ReturnType<typeof loadNodeGiac>>["giac"];
  beforeAll(async () => {
    giac = (await loadNodeGiac()).giac;
    host = new EngineHost(giac);
  });

  it("Home: 1/3 -> 0.333333333333 (source: device, G2 item 16)", () => {
    const { result } = host.home("1/3", defaultHomeSettings);
    expect(result).toMatchObject({ ok: true, display: "0.333333333333", path: "exact", approximate: false });
  });

  it("Home: the value re-formats in SCI and ENG without the engine (derived)", () => {
    const { result } = host.home("12345.6789", defaultHomeSettings);
    expect(result.display).toBe("12345.6789");
    expect(result.value).toBeDefined();
    expect(formatComplex(result.value!, { format: "SCI", digits: 4 }).text).toBe("1.235E4");
    expect(formatComplex(result.value!, { format: "ENG", digits: 4 }).text).toBe("12.35E3");
  });

  it("Home: 1-0.9-0.1 -> 0 (derived)", () => {
    expect(host.home("1-0.9-0.1", defaultHomeSettings).result.display).toBe("0");
  });

  it("Home: a variable is logged as its exact value, a function as its definition", () => {
    const r = host.home("hb:=0.1", defaultHomeSettings);
    expect(r.result.display).toBe("0.1");
    expect(r.defs).toMatchObject([{ set: { name: "hb", kind: "var", cmds: ["hb:=(1/10)"], preview: "0.1", view: "home" } }]);
    expect(host.home("1/3", defaultHomeSettings).defs).toEqual([]);
    expect(host.home("hf(x):=x^2+0.5", defaultHomeSettings).defs).toMatchObject([{ set: { name: "hf", kind: "fn", cmds: ["hf(x):=x^2+(5/10^1)"] } }]);
    expect(host.home("purge(hb)", defaultHomeSettings).defs).toEqual([{ purge: ["hb"] }]);
  });

  it("CAS: 1/2+1/6 stays exact (derived: 2/3) with a LaTeX fraction", () => {
    const { result } = host.cas("1/2+1/6", defaultCasSettings);
    expect(result.ok).toBe(true);
    expect(result.text).toBe("2/3");
    expect(result.latex).toMatch(/frac/);
    expect(result.latex.startsWith('"')).toBe(false);
  });

  it("CAS: sqrt(8) simplifies to 2*sqrt(2) (derived)", () => {
    const { result } = host.cas("sqrt(8)", defaultCasSettings);
    expect(result.text.replace(/\s/g, "")).toBe("2*sqrt(2)");
    expect(result.latex).toMatch(/sqrt/);
  });

  it("CAS: a syntax error is reported, not shown as undef", () => {
    const { result } = host.cas("1/", defaultCasSettings);
    expect(result).toMatchObject({ ok: false, error: "syntax", latex: "" });
  });

  it("Home: a syntax error does not show the previous answer again", () => {
    host.home("7", defaultHomeSettings);
    const { result } = host.home("1/", defaultHomeSettings);
    expect(result).toMatchObject({ ok: false, error: "syntax" });
    expect(result.display).not.toBe("7");
  });

  it("CAS: the hard timeout stops a long job and the engine stays usable", () => {
    const { result } = host.cas("sum((10001/10000)^k,k,1,2000)", { ...defaultCasSettings, hardTimeoutS: 0.05 });
    expect(result).toMatchObject({ ok: false, timedOut: true });
    expect(host.cas("7*6", defaultCasSettings).result.text).toBe("42");
  });

  it("switching CAS -> Home restores Home's 300 ms budget", () => {
    host.cas("1+1", defaultCasSettings);
    const { result } = host.home("sum(1.0001^k,k,1,2000)", defaultHomeSettings);
    expect(result.path).toBe("float-timeout");
    expect(result.approximate).toBe(true);
    expect(result.totalMs).toBeLessThan(2000);
  });

  it("CAS keeps its own Ans; Home's Ans is unaffected", () => {
    host.home("2/4", defaultHomeSettings);
    host.cas("x^2", defaultCasSettings);
    expect(host.eval("pasans").output).toBe("1/2");
    expect(host.eval("pcasans").output).toBe("x^2");
  });
  describe("CAS: the stored values a result used (F28, G20)", () => {
    const home = (i: string) => host.home(i, defaultHomeSettings);
    const cas = (i: string) => host.cas(i, defaultCasSettings).result;

    it("lists a stored variable with its preview and the view it was stored in", () => {
      home("ux:=3");
      const r = cas("int(ux^2,ux)");
      expect(r.uses).toEqual([{ name: "ux", preview: "3", view: "home" }]);
      cas("uy:=7");
      expect(cas("uy+1").uses).toEqual([{ name: "uy", preview: "7", view: "cas" }]);
    });

    it("lists nothing for a name the input assigns itself", () => {
      home("uz:=3");
      const r = cas("uz:=5");
      expect(r.uses).toBeUndefined();
    });

    it("does not list a user function called by name", () => {
      cas("uf(t):=t^2");
      const r = cas("uf(2)");
      expect(r.text).toBe("4");
      expect(r.uses).toBeUndefined();
    });

    it("is absent when no stored variable appears, and Home results have none", () => {
      home("ua:=2");
      expect(cas("1/2+1/6").uses).toBeUndefined();
      expect("uses" in home("ua+1").result).toBe(false);
    });
  });

  // R18f3 (F35): a test the rule leaves open stays as typed, also when a later step meets it again: the result path
  // (regroup) and an Ans chip that carries it. Giac's own `==` would compare the expressions: 0, 1 or false.
  const CLOSED = "((cos(pi/7)-cos(2*pi/7)+cos(3*pi/7))==(1/2))"; // true in exact maths (derived), simplify cannot tell
  const ans = (value: string): string => latexToGiac("\\ans", { chips: { ans: { value, exact: true } } });
  it("Home and CAS: an open test with a product stays as typed, never Giac's 0 (derived)", () => {
    expect(host.home(latexToGiac("xy==2"), defaultHomeSettings).result.display).toBe("((x*y)==2)");
    // drawn from Giac's latex() (owner, 2026-10-15), as CAS does; numbers keep our formatter (no latex)
    expect(host.home(latexToGiac("xy==2"), defaultHomeSettings).result.latex).toBe("(x\\cdot y)==2");
    expect(host.home("1/3", defaultHomeSettings).result.latex).toBeUndefined();
    expect(host.cas(latexToGiac("xy==2"), defaultCasSettings).result.text).toBe("((x*y)==2)");
  });
  it("Home and CAS: Ans holding an open test stays as typed (derived)", () => {
    expect(host.home(ans("((x*y)==2)"), defaultHomeSettings).result.display).toBe("((x*y)==2)");
    expect(host.home(ans(CLOSED), defaultHomeSettings).result.display).toBe(CLOSED);
    expect(host.cas(ans(CLOSED), defaultCasSettings).result.text).toBe(CLOSED);
    expect(host.home(ans("(x*y)<>2"), defaultHomeSettings).result.display).toBe("(x*y)<>2");
    expect(host.home(ans("[((x*y)==2),1]"), defaultHomeSettings).result.display).toBe("[((x*y)==2),1]");
    expect(host.home(ans("((x<>2) and ((y==3)))"), defaultHomeSettings).result.display).toBe("((x<>2) and ((y==3)))");
  });
  it("Home: Ans holding an open test is decided once its names have values (derived)", () => {
    host.home("pasw:=2", defaultHomeSettings);
    expect(host.home(ans("(pasw==2)"), defaultHomeSettings).result.display).toBe("true");
    expect(host.home(ans("pasw<>3"), defaultHomeSettings).result.display).toBe("true");
    expect(host.home(ans("((pasw*pasw)==5)"), defaultHomeSettings).result.display).toBe("false");
    expect(host.home(ans("[(pasw==2),(pasw<>2),(x==2)]"), defaultHomeSettings).result.display).toBe("[true,false,(x==2)]");
    host.home("purge(pasw)", defaultHomeSettings);
  });

  // G27 (F36, docs/04 2.3 #17): a result that is not a number but holds a float is ⚠ without a count, in Home and CAS.
  describe("a non-number with a float in it (G27, F36)", () => {
    const o: FormatOptions = { format: "STD", digits: 12 };
    const home = (i: string) => host.home(i, defaultHomeSettings).result;
    const cas = (i: string) => host.cas(i, defaultCasSettings).result;
    const SYMFLOAT = ["evalf(x+sin(10^22))", "evalf(x^2-2=0)", "evalf([1/3,x])"];

    it("Home: ⚠ (unchecked), with Giac's text kept", () => {
      for (const i of SYMFLOAT) {
        const r = home(i);
        expect(r, i).toMatchObject({ ok: true, approximate: true, warn: "unchecked" });
        expect(markOf(r, o), i).toEqual({ mark: "⚠", warn: "unchecked" });
      }
      expect(home("evalf(x^2-2=0)").display).toBe("x^2-2.0=0.0");
    });

    it("CAS: approximate and unchecked, so the history row draws ⚠", () => {
      for (const i of SYMFLOAT) {
        const r = cas(i);
        expect(r, i).toMatchObject({ ok: true, approximate: true, warn: "unchecked" });
        expect(r.numeric, i).toBeUndefined();
      }
      expect(cas("evalf([1/3,x])").text).toBe("[0.333333333333,x]");
    });

    it("guards: an exact non-number keeps no mark (derived)", () => {
      for (const i of ["x+1/3", "factor(x^2-1)", "x+0.5"]) {
        const h = home(i);
        expect(h.approximate, i).toBe(false);
        expect(h.warn, i).toBeUndefined();
        expect(markOf(h, o), i).toBeNull();
        const c = cas(i);
        expect(c.approximate, i).toBeUndefined();
        expect(c.warn, i).toBeUndefined();
        expect(c.numeric, i).toBeUndefined();
      }
    });

    it("guards: a float that is a number keeps its own mark (oracle: sqrt(2) = 1.41421356237…)", () => {
      expect(markOf(home("evalf(sqrt(2))"), o)).toEqual({ mark: "≈" });
      const c = cas("evalf(sqrt(2))");
      expect(c.numeric && markOf(c.numeric, o)).toEqual({ mark: "≈" });
      expect(c.approximate).toBeUndefined();
      // an unaudited function's float stays ⚠ "unaudited", not "unchecked"
      expect(markOf(home("BesselJ(1,2)"), o)).toMatchObject({ mark: "⚠", warn: "unaudited" });
    });
  });

  // G22: the reasons behind a mark, as facts (R36 words them).
  describe("why the mark (G22)", () => {
    const home = (i: string, digits = 12, over: Partial<typeof defaultHomeSettings> = {}) => host.home(i, { ...defaultHomeSettings, digits, ...over }).result;
    // A polish cut by Home's 300 ms budget shows the warning (decisions.md, G44f2f1): a test expecting the polished value sets its own.
    const polishBudget = { budgetMs: 5000 };
    it("an unaudited function is named", () => {
      // G44: σ < 0 is no distribution, so the polish refuses it and Giac's number stays unaudited.
      expect(home("normald_icdf(2,-1,0.3)").why).toEqual({ unaudited: ["normald_icdf"] });
      expect(host.cas("normald_icdf(2,-1,0.3)", defaultCasSettings).result.numeric?.why).toEqual({ unaudited: ["normald_icdf"] });
    });
    it("G44: a polished inverse distribution function is audited for that input, in Home and CAS", () => {
      const r = home("normald_icdf(10^-10)", 12, polishBudget);
      expect([r.why, r.warn, r.display, r.exact]).toEqual([undefined, undefined, "-6.3613409024", undefined]);
      const c = host.cas("normald_icdf(10^-10)", defaultCasSettings).result.numeric;
      expect([c?.why, c?.warn, c?.display]).toEqual([undefined, undefined, "-6.3613409024"]);
      // with an unaudited function next to it, the input stays unaudited (and names only that one)
      expect(home("normald_icdf(0.3)+romberg(exp(-x^2),x,0,1)").why).toEqual({ unaudited: ["normald_icdf", "romberg"] });
    });
    it("G44f1: erf and erfc are audited when read through ours (oracle: mpmath)", () => {
      const r = home("evalf(erf(10^-12))");
      expect([r.why, r.warn, r.display]).toEqual([undefined, undefined, "1.1283791671E-12"]);
      expect(home("erf(i)").why).toEqual({ unaudited: ["erf"] });
    });
    it("G44f1: an inverse function Giac gives as infinity inside (0, 1) is polished, else ⚠; at p = 1 it is exact", () => {
      // mpmath findroot on the upper tail: 18257418581.9499815596…
      const r = home("fisher_icdf(3,4,1-10^-20)", 12, polishBudget);
      expect([r.why, r.warn, r.display]).toEqual([undefined, undefined, "18257418581.9"]);
      // Newton does not converge from the centre here (today): Giac's +infinity with ⚠, not as an exact value
      const f = home("fisher_icdf(3,4,1-10^-400)");
      expect([f.display, f.warn, f.approximate, f.why]).toEqual(["+infinity", "unaudited", true, { unaudited: ["fisher_icdf"] }]);
      const e = home("fisher_icdf(3,4,1)");
      expect([e.display, e.warn, e.approximate]).toEqual(["+infinity", undefined, false]);
    });
    it("G44f1 fix 1: a polish that converges at P but not at P + 20 leaves Giac's infinity with ⚠ (regression)", () => {
      // pasicdf made to fall back from Digits 60 (P + 20 at 12 digits) on: before the fix, the one-precision check at
      // P saw it converge and showed +infinity with no mark.
      icdfPolished(giac, "");
      giac.eval(ICDF_DEFINITIONS.pasicdf!.replace(/^pasicdf\(/, "pasicdf0("));
      giac.eval("pasicdf(k,a,b,p,x0):={ if (Digits>=60) { pasicdff:=1; return x0; } return pasicdf0(k,a,b,p,x0); }");
      try {
        const f = home("fisher_icdf(3,4,1-10^-20)");
        expect([f.display, f.warn, f.approximate, f.why]).toEqual(["+infinity", "unaudited", true, { unaudited: ["fisher_icdf"] }]);
      } finally {
        giac.eval(ICDF_DEFINITIONS.pasicdf!);
        giac.eval("purge(pasicdf0)");
      }
      expect(home("fisher_icdf(3,4,1-10^-20)", 12, polishBudget).display).toBe("18257418581.9");
    });
    it("G44f1 fix 2: erf of a non-real argument kept exact is Giac's own erf, so ⚠ unaudited (regression)", () => {
      // Giac keeps erf(sqrt(2)*i) exact; its value went through Giac's erf (the flag), not ours: it showed ≈.
      for (const [input, fn] of [["erf(sqrt(2)*i)", "erf"], ["sqrt(2)+erfc(sqrt(2)*i)", "erfc"]] as const) {
        const r = home(input);
        expect([r.path, r.warn, r.why]).toEqual(["exact", "unaudited", { unaudited: [fn] }]);
      }
      // a real argument on the exact path stays audited
      expect([home("erf(1/2)").warn, home("erf(1/2)").why]).toEqual([undefined, undefined]);
    });
    it("G44f1 fix 3: in DEG erf next to a complex tanh keeps tanh read through ours (oracle: mpmath)", () => {
      // mpmath erf(1/2)+tanh(1+1j) at 45 digits: 1.60442320515174108115849871510393625… + 0.27175258531951171652884372249858892…i (Giac's tanh is coth)
      const r = host.home("erf(1/2)+tanh(1+i)", { ...defaultHomeSettings, angle: "deg", digits: 30 }).result;
      expect([r.display, r.warn]).toEqual(["1.6044232051517410811584987151+0.271752585319511716528843722499*i", undefined]);
    });
    it("a result from a stored float names the stored name when it limits the digits", () => {
      host.home("B:=BesselJ(1,2)", defaultHomeSettings);
      expect(home("B*2").why).toEqual({ inherited: ["B"] });
      expect(host.cas("B*2", defaultCasSettings).result.numeric?.why).toEqual({ inherited: ["B"] });
    });
    it("a stored name whose move costs digits below the setting is named", () => {
      host.home("G:=evalf(sqrt(2))", defaultHomeSettings);
      const r = home("G-1.414213562373095048801688724");
      expect(r.reliableDigits).toBeLessThan(12);
      expect(r.why).toEqual({ inherited: ["G"] });
    });
    // The index is 1 for the stored value and 10 (an error) once G is moved in its last confirmed digit: the
    // threshold lies between G and G·(1+10^-39), so only the perturbation check fails, not the first evaluation.
    const FLIP = "[0,0][1+9*(sign(G-1.41421356237309504880168872420969807857037187537694807317668)+1)/2]";
    it("a stored float whose perturbation check cannot run says once and unchecked", () => {
      host.home("G:=evalf(sqrt(2))", defaultHomeSettings);
      const r = home(`G+0*${FLIP}`);
      expect(r.warn).toBe("unchecked");
      expect(r.why).toEqual({ once: true });
    });
    it("once is absent when a warning is already there", () => {
      host.home("G:=evalf(sqrt(2))", defaultHomeSettings);
      host.home("U:=BesselJ(1,2)", defaultHomeSettings);
      const fromName = home(`G+0*U+0*${FLIP}`); // a stored name's warning
      expect(fromName.warn).toBe("unaudited");
      expect(fromName.why?.once).toBeUndefined();
      const fromResult = home(`G+0*BesselJ(1,2)+0*${FLIP}`); // the result's own warning
      expect(fromResult.warn).toBe("unaudited");
      expect(fromResult.why?.once).toBeUndefined();
    });
    it("a value evaluated only once says so", () => {
      expect(home("BesselJ(1,2)", 30).why).toEqual({ once: true });
    });
    it("a float test with only audited functions has no empty why (home and CAS)", () => {
      const t = latexToGiac("\\operatorname{evalf}(\\sin(0.5))==0.479425538604203");
      const h = home(t);
      expect(h.approximate).toBe(true);
      expect(h.why).toBeUndefined();
      expect("why" in h).toBe(false);
      expect(host.cas(t, defaultCasSettings).result.why).toBeUndefined();
    });
    it("a float test with an unaudited function names it, in CAS too", () => {
      const t = latexToGiac("\\operatorname{normald\\_icdf}(0.3)==-0.5244005127080407");
      const h = home(t);
      expect(h.warn).toBe("unaudited");
      expect(h.why).toEqual({ unaudited: ["normald_icdf"] });
      expect(host.cas(t, defaultCasSettings).result.why).toEqual({ unaudited: ["normald_icdf"] });
    });
    it("CAS: a float in a non-number says it was not compared", () => {
      const r = host.cas("evalf(x-0.54764225985)", defaultCasSettings).result;
      expect(r).toMatchObject({ warn: "unchecked", why: { once: true } });
      expect(home("evalf(x-0.54764225985)").why).toEqual({ once: true });
    });
    it("a stored float without a warning that costs no digits is not a reason", () => {
      host.home("Bn:=evalf(sqrt(2))", defaultHomeSettings); // 39 confirmed digits, no warn: the mark is ≈
      const r = home("Bn*2");
      expect(r.approximate).toBe(true);
      expect(r.why).toBeUndefined();
    });
    it("a list result carries why on the top level only", () => {
      host.home("B:=BesselJ(1,2)", defaultHomeSettings);
      const r = home("[B,1]");
      const m = home("[[B]]");
      for (const x of [r, m]) {
        expect(x.items).toBeDefined();
        expect(x.why).toEqual({ inherited: ["B"] });
        for (const it of x.items!) expect(it.why).toBeUndefined();
      }
    });
    it("an exact rational has no why", () => {
      expect(home("1/3").why).toBeUndefined();
      expect("why" in home("1/3")).toBe(false);
    });
  });
  // G26 (deep-dive item 17): the digits a constant's uncertainty leaves. All values derived by hand from the table:
  // G = 6.67430E-11 with σ = 0.00015E-11 (CODATA 2018, as the chip table holds it, input/chips.test.ts).
  describe("exp in DEG is Giac's exp, in radians (G46; G21f1's pasexp is gone)", () => {
    const deg = { ...defaultHomeSettings, angle: "deg" as const };
    const casDeg = { ...defaultCasSettings, angle: "deg" as const };
    it("Home g(x):=exp(i*x) shows exp in display, exact, full and latex; the log holds exp, not pasexp (derived)", () => {
      const r = host.home("g21(x):=exp(i*x)", deg);
      for (const f of [r.result.display, r.result.exact, r.result.full, r.result.latex]) expect(f ?? "").not.toMatch(/pasexp/);
      expect(r.result.display).toContain("exp(");
      expect(r.defs).toMatchObject([{ set: { name: "g21", kind: "fn" } }]);
      expect(JSON.stringify(r.defs)).not.toContain("pasexp");
      expect(JSON.stringify(r.defs.map((d) => ("set" in d ? d.set.preview : ""))).includes("pasexp")).toBe(false);
    });
    it("g(90) is still -0.448073616129+0.893996663601*i in DEG (source: oracle, exp(i*90) as radians)", () => {
      expect(host.home("g21(90)", deg).result.display).toBe("-0.448073616129+0.893996663601*i");
    });
    it("CAS g(x):=exp(i*x) shows exp in text and latex", () => {
      const r = host.cas("g21c(x):=exp(i*x)", casDeg);
      expect(r.result.text).not.toMatch(/pasexp/);
      expect(r.result.latex).not.toMatch(/pasexp/);
      expect(r.result.latex).toMatch(/exp|e\^/);
      expect(r.defs.map((d) => ("set" in d ? d.set.preview : "")).join()).not.toMatch(/pasexp/);
      host.home("purge(g21,g21c)", defaultHomeSettings);
    });
  });

  // G49 (deep check 2026-10-19 D1, D3): a chip named `pasr_<k>` lends its facts as a stored float does (M4-7), and Store
  // keeps the facts of an inexact input. Values: romberg's as the session's chip carries it (Giac's P-digit float).
  describe("chips by name and Store (G49)", () => {
    const romberg = { value: "0.7468241328124270416001155918698308916810", reliableDigits: 11, warn: "unaudited" as const, exact: false };
    const opts: FormatOptions = { format: "STD", digits: 12 };
    const home = (i: string, chips?: Parameters<EngineHost["home"]>[3], consts?: Parameters<EngineHost["home"]>[2]) => host.home(i, defaultHomeSettings, consts, chips);

    it("a named chip is moved in its last confirmed digit: the cancellation has no confirmed digit (oracle 2.70253994674E-14)", () => {
      const r = home("pasr_1-0.7468241328124", { "1": romberg }).result;
      expect(markOf(r, opts)).toMatchObject({ mark: "⚠", n: 0 });
      expect(r.display).toBe("3E-14");
      // The same value put in as a literal (today's chip) claims a digit it does not have.
      expect(markOf(home(`(${romberg.value})-0.7468241328124`).result, opts)?.mark).not.toBe("⚠");
    });

    it("the chip's name lives for the run only", () => {
      home("pasr_1*2", { "1": romberg });
      expect(host.home("pasr_1", defaultHomeSettings).result.display).toBe("pasr_1");
    });

    it("an exact chip is a literal: (1/3)·3 = 1 (derived)", () => {
      const r = home("pasr_1*3", { "1": { value: "1/3", reliableDigits: null, exact: true } }).result;
      expect(r.display).toBe("1");
      expect(markOf(r, opts)?.mark).toBe("=");
    });

    it("a function defined from a chip gets its value, and keeps working after the run", () => {
      const r = home("hg49f(x):=x*pasr_1", { "1": { value: "2", reliableDigits: null, exact: false } });
      expect(JSON.stringify(r.defs)).not.toContain("pasr_");
      expect(host.home("hg49f(3)", defaultHomeSettings).result.display).toBe("6");
      host.home("purge(hg49f)", defaultHomeSettings);
    });

    it("Store from a chip or an inexact constant keeps inexact facts though the value prints exactly", () => {
      const G = { value: "6.67430E-11", unc: "0.00015E-11" };
      const a = home("hg49a:=pasc_G*2", undefined, { G });
      expect(a.defs).toMatchObject([{ set: { name: "hg49a", cmds: ["hg49a:=(66743/500000000000000)"], facts: { reliableDigits: null, inexact: true } } }]);
      const half = host.home("hg49a/2", defaultHomeSettings).result;
      expect(half.display).toBe("6.6743E-11");
      expect(markOf(half, opts)?.mark).toBe("≈");
      // an exact constant (c) stores an exact value, as before
      expect(home("hg49c:=pasc_c*2", undefined, { c: { value: "299792458" } }).defs).toMatchObject([{ set: { name: "hg49c" } }]);
      expect(JSON.stringify(home("hg49c:=pasc_c*2", undefined, { c: { value: "299792458" } }).defs)).not.toContain("facts");
      const b = home("hg49b:=pasr_1*1", { "1": { value: "5", reliableDigits: null, exact: false } });
      expect(b.defs).toMatchObject([{ set: { name: "hg49b", facts: { inexact: true } } }]);
      host.home("purge(hg49a,hg49b,hg49c)", defaultHomeSettings);
    });

    // G49f1: the chip of the undecided floor (g38-floor-sin1e100, oracle -372376123662), as the session carries it.
    it("a function built from an inexact chip, constant or stored name with facts keeps them: its call is never =", () => {
      const floorChip = { value: "899450126402", reliableDigits: null, warn: "unchecked" as const, exact: false };
      const q = home("hg49q(x):=x+pasr_1", { "1": floorChip });
      expect(q.defs).toMatchObject([{ set: { name: "hg49q", kind: "fn", facts: { reliableDigits: null, warn: "unchecked", inexact: true } } }]);
      const call = host.home("hg49q(0)", defaultHomeSettings).result;
      expect(call.display).toBe("899450126402");
      expect(markOf(call, opts)?.mark).toBe("⚠");
      // a stored name with facts in the body
      home("hg49s:=pasr_1*1", { "1": floorChip });
      const s = host.home("hg49r(x):=x+hg49s", defaultHomeSettings);
      expect(s.defs).toMatchObject([{ set: { name: "hg49r", kind: "fn", facts: { warn: "unchecked", inexact: true } } }]);
      expect(markOf(host.home("hg49r(0)", defaultHomeSettings).result, opts)?.mark).toBe("⚠");
      // an inexact constant (G, CODATA 2018 σ): ≈, not =
      home("hg49g(x):=x*pasc_G", undefined, { G: { value: "6.67430E-11", unc: "0.00015E-11" } });
      expect(markOf(host.home("hg49g(1)", defaultHomeSettings).result, opts)?.mark).toBe("≈");
      // guard: a function of exact values stores no facts and its call stays =
      const e = host.home("hg49e(x):=x+1", defaultHomeSettings);
      expect(JSON.stringify(e.defs)).not.toContain("facts");
      expect(markOf(host.home("hg49e(2)", defaultHomeSettings).result, opts)?.mark).toBe("=");
      host.home("purge(hg49q,hg49r,hg49s,hg49g,hg49e)", defaultHomeSettings);
    });

    // G49f3: a call takes the facts of the names the function's body holds now, not only those stored at definition.
    // The undecided floor: oracle -372376123662 (g38-floor-sin1e100), Giac 899450126402 at 40 digits; stored with sto,
    // which runs once and keeps it with ⚠ (name:= decides it again and refuses it, G57).
    it("a function defined in CAS from a stored name with facts: its Home call is never =", () => {
      host.home("sto(floor(sin(10^100)*10^12),hg3a)", defaultHomeSettings);
      host.cas("hg3f(x):=x+hg3a", defaultCasSettings);
      const call = host.home("hg3f(0)", defaultHomeSettings).result;
      expect(call.display).toBe("899450126402");
      expect(markOf(call, opts)?.mark).toBe("⚠");
      host.home("purge(hg3a,hg3f)", defaultHomeSettings);
    });

    it("a name the body holds that got facts after the definition: the call is never =", () => {
      host.home("hg3b:=5", defaultHomeSettings);
      host.home("hg3g(x):=x+hg3b", defaultHomeSettings);
      host.home("sto(floor(sin(10^100)*10^12),hg3b)", defaultHomeSettings);
      const call = host.home("hg3g(0)", defaultHomeSettings).result;
      expect(call.display).toBe("899450126402");
      expect(markOf(call, opts)?.mark).toBe("⚠");
      // through a second function, and a recursive one ends
      host.home("hg3h(x):=hg3g(x)*1", defaultHomeSettings);
      expect(markOf(host.home("hg3h(0)", defaultHomeSettings).result, opts)?.mark).toBe("⚠");
      host.home("hg3r(n):=when(n<=0,hg3b,hg3r(n-1))", defaultHomeSettings);
      expect(markOf(host.home("hg3r(2)", defaultHomeSettings).result, opts)?.mark).toBe("⚠");
      host.home("purge(hg3b,hg3g,hg3h,hg3r)", defaultHomeSettings);
    });

    it("guard: a function of exact stored names (Home or CAS) stays =", () => {
      host.home("hg3c:=7", defaultHomeSettings);
      host.home("hg3e(x):=x+hg3c", defaultHomeSettings);
      host.cas("hg3k(x):=hg3e(x)+hg3c", defaultCasSettings);
      expect(markOf(host.home("hg3e(1)", defaultHomeSettings).result, opts)?.mark).toBe("=");
      const k = host.home("hg3k(1)", defaultHomeSettings).result;
      expect(k.display).toBe("15");
      expect(markOf(k, opts)?.mark).toBe("=");
      host.home("purge(hg3c,hg3e,hg3k)", defaultHomeSettings);
    });

    // G49f4: name:=x->body is a function for the facts too (definedBy reads it as a variable). The undecided floor:
    // oracle -372376123662 (g38-floor-sin1e100), Giac 899450126402 at 40 digits.
    it("an arrow function whose body name got facts after the definition: the call is never =", () => {
      host.home("hg4b:=5", defaultHomeSettings);
      host.home("hg4g:=x->x+hg4b", defaultHomeSettings);
      host.home("sto(floor(sin(10^100)*10^12),hg4b)", defaultHomeSettings);
      const call = host.home("hg4g(0)", defaultHomeSettings).result;
      expect(call.display).toBe("899450126402");
      expect(markOf(call, opts)?.mark).toBe("⚠");
      host.home("purge(hg4b,hg4g)", defaultHomeSettings);
    });

    it("an arrow function from a stored name with facts (Home or CAS, one or more parameters): the call is never =", () => {
      host.home("sto(floor(sin(10^100)*10^12),hg4a)", defaultHomeSettings);
      host.home("hg4h:=x->x+hg4a", defaultHomeSettings);
      const call = host.home("hg4h(0)", defaultHomeSettings).result;
      expect(call.display).toBe("899450126402");
      expect(markOf(call, opts)?.mark).toBe("⚠");
      host.cas("hg4k:=(x,y)->x*y+hg4a", defaultCasSettings);
      expect(markOf(host.home("hg4k(0,1)", defaultHomeSettings).result, opts)?.mark).toBe("⚠");
      host.home("purge(hg4a,hg4h,hg4k)", defaultHomeSettings);
    });

    it("guard: an exact arrow function stays =", () => {
      host.home("hg4s:=x->x^2", defaultHomeSettings);
      const call = host.home("hg4s(3)", defaultHomeSettings).result;
      expect(call.display).toBe("9");
      expect(markOf(call, opts)?.mark).toBe("=");
      host.home("purge(hg4s)", defaultHomeSettings);
    });

    it("a float stored from a chip keeps its facts without the flag (the float shows it)", () => {
      const r = home("hg49d:=pasr_1*2", { "1": romberg });
      expect(r.defs).toMatchObject([{ set: { name: "hg49d", facts: { reliableDigits: 11, warn: "unaudited" } } }]);
      expect(JSON.stringify(r.defs)).not.toContain("inexact");
      host.home("purge(hg49d)", defaultHomeSettings);
    });
  });

  describe("uncDigits from a constant's uncertainty (G26)", () => {
    const G = { value: "6.67430E-11", unc: "0.00015E-11" };
    const C = { value: "299792458" };
    const home = (i: string, consts?: Parameters<EngineHost["home"]>[2], digits = 12) => host.home(i, { ...defaultHomeSettings, digits }, consts).result;
    const facts = (r: ReturnType<typeof home>) => ({ ...r, exactMs: 0, totalMs: 0 });

    it("G·5.972ᴇ24: σ = 1.5E-15·5.972E24 = 8.958E9 under a value of 3.98589196E14, so 5 digits hold (derived)", () => {
      const r = home("pasc_G*5.972E24", { G });
      expect(r.uncDigits).toBe(5);
      // the value is what the input with G's digits gives today
      const { uncDigits, ...rest } = r;
      expect(facts(rest as typeof r)).toEqual(facts(home("(6.67430E-11)*5.972E24")));
      expect(home("pasc_G*5.972E24", { G }, 30).uncDigits).toBe(5);
    });

    it("G alone: 6.6743E-11 ± 1.5E-15 keeps 4 digits; an assignment's right side counts (derived)", () => {
      expect(home("pasc_G", { G }).uncDigits).toBe(4);
      expect(home("hgu:=pasc_G*2", { G }).uncDigits).toBe(5); // 1.33486E-10 ± 3E-15
      host.home("purge(hgu)", defaultHomeSettings);
    });

    it("two constants combine in quadrature, not by sum or by the larger one (derived)", () => {
      const a = { value: "3", unc: "0.6" };
      const b = { value: "4", unc: "0.6" };
      // 7 ± sqrt(0.36+0.36) = 0.849: 1 digit (a plain sum, 1.2, would leave 0)
      expect(home("pasc_a+pasc_b", { a, b }).uncDigits).toBe(1);
      // 20·4 = 80 ± sqrt((4·0.2)²+(20·0.035)²) = sqrt(0.64+0.49) = 1.063: 1 digit (the larger term, 0.8, would leave 2)
      expect(home("pasc_a*pasc_b", { a: { value: "20", unc: "0.2" }, b: { value: "4", unc: "0.035" } }).uncDigits).toBe(1);
    });

    it("σ follows the angle mode: sin(a) with a = 30 ± 1 (derived)", () => {
      const a = { value: "30", unc: "1" };
      // degrees: 0.5 ± cos(30°)·π/180 = 0.0151, so 1 digit; radians: sin(30) = -0.988 ± |cos(30)| = 0.154, so 0
      expect(host.home("sin(pasdeg*pasc_a)", { ...defaultHomeSettings, angle: "deg" }, { a }).result.uncDigits).toBe(1);
      expect(host.home("sin(pasdeg*pasc_a)", defaultHomeSettings, { a }).result.uncDigits).toBe(0);
    });

    it("an exact constant (c) gives none; nor does a σ of 0", () => {
      const r = home("pasc_c*2", { c: C });
      expect(r.display).toBe("599584916");
      expect("uncDigits" in r).toBe(false);
      expect("uncDigits" in home("pasc_c*2", { c: { value: "299792458", unc: "0" } })).toBe(false);
      expect("uncDigits" in home("pasc_G-pasc_G", { G })).toBe(false);
      expect(home("pasc_c*pasc_G", { c: C, G }).uncDigits).toBe(5); // 2.0009E-2 ± 4.497E-7: digits at 1E-2…1E-6 hold (derived)
    });

    it("without the table everything is as today", () => {
      expect("uncDigits" in home("(6.67430E-11)*5.972E24")).toBe(false);
      expect(facts(home("1/3", {}))).toEqual(facts(home("1/3")));
      expect(home("pasc_G*2").display).toBe(home("pasc_G*2", {}).display);
      expect("uncDigits" in home("pasc_G*2")).toBe(false);
    });
  });
});

describe.skipIf(!giacAvailable())("EngineHost.restore: the defs replay in few engine calls (G29)", () => {
  const mk = (name: string, kind: "var" | "fn" | "other", cmd: string, extra: object = {}) =>
    ({ name, kind, cmds: [cmd], preview: "", view: "cas" as const, time: 0, ...extra });
  const counting = async () => {
    const { giac } = await loadNodeGiac();
    const calls: string[] = [];
    return { giac: { ...giac, eval: (s: string) => (calls.push(s), giac.eval(s)) }, calls, raw: giac };
  };

  it("200 definitions take 8 engine calls (was 200), and every name is set", async () => {
    const { giac, calls, raw } = await counting();
    const log = [
      ...Array.from({ length: 150 }, (_, i) => mk(`dv${i + 1}`, "var", `dv${i + 1}:=(${i + 1}/7+${i + 1})`)),
      ...Array.from({ length: 50 }, (_, i) => mk(`df${i + 1}`, "fn", `df${i + 1}(x):=x^2+${i + 1}*x+sin(${i + 1})`)),
    ];
    const host = new EngineHost(giac);
    calls.length = 0; // R64: the constructor sets pasdeg; only the replay is counted
    host.restore(log);
    expect(calls.length).toBe(Math.ceil(200 / REPLAY_BATCH));
    expect(raw.eval("dv7*7")).toBe("56"); // derived: 7*(1+7)
    expect(raw.eval("df3(0)")).toBe("sin(3)");
  });

  it("G3's order: a symbolic value goes first, even inside a batch", async () => {
    const { giac, raw } = await counting();
    new EngineHost(giac).restore([mk("K", "var", "K:=(5)"), mk("S", "var", "S:=(K*x+1)", { early: true })]);
    expect(raw.eval("S")).toBe("K*x+1"); // S was set while K was free, so it still holds the name K
    expect(raw.eval("K")).toBe("5");
  });

  it("G19: a broken entry never stops the ones after it, in a batch or alone", async () => {
    const { giac, raw } = await counting();
    new EngineHost(giac).restore([mk("a1", "var", "a1:=(1)"), mk("bad", "var", "bad:=(2"), mk("a3", "var", "a3:=(3)"), mk("o", "other", "o1,o2:=4,5"), mk("a5", "var", "a5:=(5)")]);
    expect(raw.eval("a1+a3+a5+o1+o2")).toBe("18"); // derived: 1+3+5+4+5
  });

  it("G19: a bad entry with matched brackets inside a batch is rerun one at a time; its neighbours are set", async () => {
    const { giac, calls, raw } = await counting();
    const host = new EngineHost(giac);
    calls.length = 0; // R64: the constructor sets pasdeg; only the replay is counted
    host.restore([mk("b1", "var", "b1:=(1)"), mk("bad", "var", "bad:=(2+)"), mk("b3", "var", "b3:=(3)")]);
    expect(calls.length).toBe(7); // one batch, three purges, then the three one at a time
    expect(raw.eval("b1+b3")).toBe("4");
  });

  it("G19: an entry Giac refuses outright (a reserved name) does not abort the rest of its batch", async () => {
    const { giac, raw } = await counting();
    new EngineHost(giac).restore([mk("c1", "var", "c1:=(1)"), mk("pi", "var", "pi:=(3)"), mk("c3", "var", "c3:=(3)"), mk("c4", "fn", "c4(x):=x+1")]);
    expect(raw.eval("c1+c3+c4(0)")).toBe("5"); // derived: 1+3+1
  });

  it("a rerun keeps G3's order: an early entry, the name it uses and a refused entry in one batch (S is K*x+1)", async () => {
    const { giac, raw } = await counting();
    new EngineHost(giac).restore([mk("S", "var", "S:=(K*x+1)", { early: true }), mk("K", "var", "K:=(5)"), mk("pi", "var", "pi:=(3)")]);
    expect(raw.eval("S")).toBe("K*x+1");
    expect(raw.eval("K")).toBe("5");
  });

  it("functions that use a global (a warning, no error) do not make the batch run twice", async () => {
    const { giac, calls, raw } = await counting();
    const log = Array.from({ length: 50 }, (_, i) => mk(`g${i}`, "fn", `g${i}(x):=ga*x+${i}`));
    const host = new EngineHost(giac);
    calls.length = 0; // R64: the constructor sets pasdeg; only the replay is counted
    host.restore(log);
    expect(calls.length).toBe(Math.ceil(50 / REPLAY_BATCH));
    expect(raw.eval("g3(2)")).toBe("ga*2+3");
  });
});

describe.skipIf(!giacAvailable())("G34, G46: a carried value keeps what it showed when the angle mode changes", () => {
  let host: EngineHost;
  beforeAll(async () => {
    host = new EngineHost((await loadNodeGiac()).giac);
  });
  const rad = defaultHomeSettings;
  const deg = { ...defaultHomeSettings, angle: "deg" as const };

  it("DEG TH:=atan(3/4) keeps its exact radian text with the mode; RAD reads 36.8698976458 (source: oracle)", () => {
    // G46: Giac runs in radians, so the text means the same in every mode (G34's decimal is no longer needed)
    const r = host.home("TH:=(atan(3/4)/pasdeg)", deg);
    expect(r.result.display).toBe("36.8698976458");
    expect(r.result.exact).toBe("atan(3/4)/(pi/180)");
    expect(r.defs).toMatchObject([{ set: { name: "TH", kind: "var", angle: "deg", cmds: ["TH:=(atan(3/4)/(pi/180))"] } }]);
    const back = host.home("TH", rad).result;
    expect(back.display).toBe("36.8698976458");
    expect(markOf(back, { format: "STD", digits: 12 })?.mark).toBe("≈");
  });

  it("an angle-free exact value keeps its text and is stored without facts (derived)", () => {
    const r = host.home("R34:=sqrt(2)", deg);
    expect(r.result.exact).toBe("sqrt(2)");
    expect(r.defs).toMatchObject([{ set: { cmds: ["R34:=(sqrt(2))"], angle: "deg" } }]);
    expect((r.defs[0] as { set: { facts?: unknown } }).set.facts).toBeUndefined();
    expect(host.home("sin(pasdeg*15)", deg).result.exact).toBe("(sqrt(6)-sqrt(2))/4");
  });

  it("a stored log replays in the other mode (source: oracle, sin(1°) = 0.0174524064373)", async () => {
    const r = host.home("S34:=sin(pasdeg*1)", deg);
    const fresh = new EngineHost((await loadNodeGiac()).giac);
    fresh.restore(r.defs.flatMap((d) => ("set" in d ? [d.set] : [])));
    expect(fresh.home("S34", rad).result.display).toBe("0.0174524064373");
    host.home("purge(TH,R34,S34)", rad);
  });

  it("the library export writes exp(90*i) as Giac's radian text (source: oracle, exp(90i) = -0.448073616129+0.893996663601i)", () => {
    const a = host.home("A34:=exp(i*90)", deg);
    const r = host.home("R35:=sqrt(2)", deg);
    const log = [...a.defs, ...r.defs].flatMap((d) => ("set" in d ? [d.set] : []));
    const out = exportLibrary(log);
    expect(out.text).toContain("A34:=(exp(90*i))");
    expect(out.text).toContain("R35:=(sqrt(2))");
    expect(out.skipped).toEqual([]);
    expect(host.home("A34", rad).result.display).toBe("-0.448073616129+0.893996663601*i");
    host.home("purge(A34,R35)", rad);
  });
});

// G48 (night check 2026-10-19 2.2): no `=` through an assignment that runs once, and a stored name takes the facts of
// what its input read. F is the undecided floor: oracle -372376123662 (g38-floor-sin1e100), Giac 899450126402 at 40 digits.
// A plain name:=F is refused (G57); the forms that run once keep it with ⚠, so the fixtures store it with sto.
describe.skipIf(!giacAvailable())("G48: assignments that run once, and the facts a store lends", () => {
  const F = "floor(sin(10^100)*10^12)";
  const opts: FormatOptions = { format: "STD", digits: 12 };
  let host: EngineHost;
  const home = (i: string) => host.home(i, defaultHomeSettings);
  const mark = (i: string) => markOf(home(i).result, opts)?.mark;
  beforeAll(async () => {
    host = new EngineHost((await loadNodeGiac()).giac);
  });

  it("[q1,q2]:=[F,1] is ⚠, and then q1 is ⚠", () => {
    const r = home(`[hq1,hq2]:=[${F},1]`).result;
    expect(markOf(r, opts)?.mark).toBe("⚠");
    expect(r.why?.decided).toBe(true);
    expect(mark("hq1")).toBe("⚠");
    expect(mark("hq2")).toBe("⚠");
  });

  it("q5,q6:=F,1 is ⚠", () => {
    expect(mark(`hq5,hq6:=${F},1`)).toBe("⚠");
    expect(mark("hq5")).toBe("⚠");
  });

  it("F=>pE is ⚠, and then pE is ⚠", () => {
    expect(mark(`${F}=>hpE`)).toBe("⚠");
    expect(mark("hpE")).toBe("⚠");
  });

  it("CAS [r1,r2]:=[F,1] is ⚠", () => {
    const r = host.cas(`[hr1,hr2]:=[${F},1]`, defaultCasSettings).result;
    expect(r.warn).toBe("unchecked");
    expect(r.why?.decided).toBe(true);
  });

  it("pA:=F, pu:=unapply(x+pA,x): pu(0) is ⚠ (the stored function lends what its input read)", () => {
    home(`sto(${F},hpA)`);
    home("hpu:=unapply(x+hpA,x)");
    const call = home("hpu(0)").result;
    expect(call.display).toBe("899450126402");
    expect(markOf(call, opts)?.mark).toBe("⚠");
  });

  it("sto(F,pC) runs once: pC is ⚠ and in the definitions log, and a restore brings it back", async () => {
    const r = home(`sto(${F},hpC)`);
    expect(markOf(r.result, opts)?.mark).toBe("⚠");
    expect(mark("hpC")).toBe("⚠");
    const set = r.defs.flatMap((c) => ("set" in c ? [c.set] : []));
    expect(set.map((e) => [e.name, e.kind])).toEqual([["hpC", "var"]]);
    const fresh = new EngineHost((await loadNodeGiac()).giac);
    fresh.restore(set);
    const back = fresh.home("hpC", defaultHomeSettings).result;
    expect(back.display).toBe(r.result.display);
    expect(markOf(back, opts)?.mark).toBe("⚠");
  });

  it("guards stay =: [a1,b1]:=[1,2] then a1; sq:=unapply(x^2,x) then sq(3) = 9; sto(5,p5) then p5", () => {
    expect(mark("[ha1,hb1]:=[1,2]")).toBe("=");
    expect(mark("ha1")).toBe("=");
    home("hsq:=unapply(x^2,x)");
    const sq = home("hsq(3)").result;
    expect(sq.display).toBe("9");
    expect(markOf(sq, opts)?.mark).toBe("=");
    const s = home("sto(5,hp5)");
    expect(markOf(s.result, opts)?.mark).toBe("=");
    expect(s.defs).toMatchObject([{ set: { name: "hp5", kind: "var" } }]);
    expect(mark("hp5")).toBe("=");
  });
});

// G51 (night check 2026-10-19 2.7): a CAS result without a float that read a stored name, or called a function, with
// facts takes their warn and why.inherited. F is the undecided floor: oracle -372376123662 (g38-floor-sin1e100), Giac
// 899450126402 at 40 digits, stored with sto (runs once, ⚠; name:=F is refused, G57).
describe.skipIf(!giacAvailable())("G51: a CAS result that reads stored facts gets their mark", () => {
  const F = "floor(sin(10^100)*10^12)";
  let host: EngineHost;
  const cas = (i: string) => host.cas(i, defaultCasSettings).result;
  beforeAll(async () => {
    host = new EngineHost((await loadNodeGiac()).giac);
    host.home(`sto(${F},gA)`, defaultHomeSettings);
  });

  it("CAS pA, pA+1 and pf(0) with pf(x):=x+pA are ⚠ and name pA", () => {
    host.cas("gf(x):=x+gA", defaultCasSettings);
    for (const [input, text] of [["gA", "899450126402"], ["gA+1", "899450126403"], ["gf(0)", "899450126402"]] as const) {
      const r = cas(input);
      expect(r.text, input).toBe(text);
      expect(r.approximate, input).toBe(true);
      expect(r.warn, input).toBe("unchecked");
      expect(r.why?.inherited, input).toEqual([input === "gf(0)" ? "gf" : "gA"]);
    }
  });

  it("a CAS assignment from pA is ⚠ too, and the name it stores keeps the facts", () => {
    const r = cas("gB:=gA*2");
    expect(r.warn).toBe("unchecked");
    expect(r.why?.inherited).toEqual(["gA"]);
    expect(cas("gB").warn).toBe("unchecked");
  });

  it("guards: CAS pB:=5 then pB+1 is 6, and factor(x^2-1), stay unmarked", () => {
    expect(cas("gE:=5").warn).toBeUndefined();
    const r = cas("gE+1");
    expect(r.text).toBe("6");
    expect(r.approximate).toBeUndefined();
    expect(r.warn).toBeUndefined();
    expect(r.why).toBeUndefined();
    const f = cas("factor(x^2-1)");
    expect(f.approximate).toBeUndefined();
    expect(f.warn).toBeUndefined();
    host.cas("gg(x):=x+gE", defaultCasSettings);
    expect(cas("gg(1)").warn).toBeUndefined();
  });
});
