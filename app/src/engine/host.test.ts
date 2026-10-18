// SPDX-License-Identifier: GPL-3.0-or-later
// EngineHost against the real Giac build (skipped when no build is found; see nodeGiac.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost, REPLAY_BATCH } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { formatComplex, markOf, type FormatOptions } from "./format.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { latexToGiac } from "../input/latex-to-giac.ts";

describe.skipIf(!giacAvailable())("EngineHost (real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    host = new EngineHost((await loadNodeGiac()).giac);
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
    const home = (i: string, digits = 12) => host.home(i, { ...defaultHomeSettings, digits }).result;
    it("an unaudited function is named", () => {
      expect(home("normald_icdf(10^-10)").why).toEqual({ unaudited: ["normald_icdf"] });
      expect(host.cas("normald_icdf(10^-10)", defaultCasSettings).result.numeric?.why).toEqual({ unaudited: ["normald_icdf"] });
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
      expect(host.home("sin(pasc_a)", { ...defaultHomeSettings, angle: "deg" }, { a }).result.uncDigits).toBe(1);
      expect(host.home("sin(pasc_a)", defaultHomeSettings, { a }).result.uncDigits).toBe(0);
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
    new EngineHost(giac).restore(log);
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
    new EngineHost(giac).restore([mk("b1", "var", "b1:=(1)"), mk("bad", "var", "bad:=(2+)"), mk("b3", "var", "b3:=(3)")]);
    expect(calls.length).toBe(4); // one batch, then the three one at a time
    expect(raw.eval("b1+b3")).toBe("4");
  });

  it("G19: an entry Giac refuses outright (a reserved name) does not abort the rest of its batch", async () => {
    const { giac, raw } = await counting();
    new EngineHost(giac).restore([mk("c1", "var", "c1:=(1)"), mk("pi", "var", "pi:=(3)"), mk("c3", "var", "c3:=(3)"), mk("c4", "fn", "c4(x):=x+1")]);
    expect(raw.eval("c1+c3+c4(0)")).toBe("5"); // derived: 1+3+1
  });
});
