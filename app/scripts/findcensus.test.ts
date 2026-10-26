// SPDX-License-Identifier: GPL-3.0-or-later
// G110: the Find census's pure parts on fixed inputs (no engine): the help example as keyboard LaTeX, the number variants, the
// classes, and the gate's comparison with its known file. The LaTeX strings are what the keys write (checked through our parser).
import { describe, expect, it } from "vitest";
import { latexToGiac } from "../src/input/latex-to-giac.ts";
import { decimalFromString, ZERO_VALUE } from "../src/engine/format.ts";
import { argsLatex, helpExamples, samplesOf } from "../../tools/probes/findcensus/samples.ts";
import { classify, loggedOnly, onNumbers, rawText } from "../../tools/probes/findcensus/classify.ts";
import { censusStage, classStrings, hitDeadline, knownText, timingChanges, timingSuspects } from "../../tools/probes/findcensus/stage.ts";
import type { Row } from "../../tools/probes/findcensus/run.ts";
import type { Answer } from "../../tools/probes/findcensus/worker.ts";
import { casMark } from "../src/goldenRun.ts";
import { exactReading, listTypeOf } from "../../tools/probes/findcensus/exact.ts";
import type { GiacValue } from "../src/engine/bridge.ts";

const answer = (o: Partial<Answer>): Answer => ({ ok: true, text: "", left: [], ...o });
const num = (s: string): Answer["value"] => ({ re: decimalFromString(s)!, im: ZERO_VALUE });

describe("findcensus samples", () => {
  it("reads Giac's help blocks: every name of a block, its example lines, not its text lines", () => {
    const ex = helpExamples("# erfc\n1 Renvoie …\n2 Returns …\n0 Real(x0)\n-1 erf\nerfc(1)\nerfc(1/(sqrt(2)))*1/2\n\n# gcd igcd\n2 GCD\ngcd(45,75)\n");
    expect(ex.get("erfc")).toEqual(["erfc(1)", "erfc(1/(sqrt(2)))*1/2"]);
    expect(ex.get("igcd")).toEqual(["gcd(45,75)"]);
  });
  it("writes the arguments as the keys do, and our parser reads them back as Giac's text", () => {
    const cases: [string, string][] = [
      ["x-1/6*x^3,x", "x-(1/6)*x^3,x"],
      ["[[1,2],[3,4]]", "[[1,2],[3,4]]"],
      ["[1,2,3],2", "list[1,2,3],2"], // braces are Giac's list type (R80)
      ["2,sqrt(2)", "2,sqrt(2)"],
      ["-(x+1)^2", "-(x+1)^2"],
      ["a-(b+c),a-(-b)", "a-(b+c),a-(-b)"],
      ["x<=2,x>0", "x<=2,x>0"],
      ["(1/2)^3", "(1/2)^3"],
      ["log(x)", "ln(x)"],
    ];
    for (const [giac, back] of cases) {
      const latex = `\\operatorname{gcd}\\left(${argsLatex(giac)}\\right)`;
      expect(latexToGiac(latex).replace(/\s/g, "")).toBe(`gcd(${back})`);
    }
  });
  it("takes the first whole-line call it can type, and adds the other number kinds of its last argument", () => {
    const s = samplesOf("erfc", ["erfc"], ["erfc(1/(sqrt(2)))*1/2", "erfc(1)"]);
    expect(Array.isArray(s) && s.map((x) => [x.k, x.kind ?? "", x.latex])).toEqual([
      [0, "", "\\operatorname{erfc}\\left(1\\right)"],
      [1, "decimal", "\\operatorname{erfc}\\left(0.5\\right)"],
      [2, "negative", "\\operatorname{erfc}\\left(-2\\right)"],
      [3, "list", "\\operatorname{erfc}\\left(\\left\\{1,2\\right\\}\\right)"],
    ]);
    expect(Array.isArray(s) && s[2]!.py).toEqual(["(-N('2'))"]);
  });
  it("has no variants when an argument is no number, and no sample for what the keys cannot type", () => {
    const s = samplesOf("diff", ["diff"], ["diff(x^2,x)"]);
    expect(Array.isArray(s) && s.length).toBe(1);
    expect(Array.isArray(s) && s[0]!.py).toBeNull();
    expect(samplesOf("cat", ["cat"], ['cat("a",1)'])).toEqual({ none: 'no example the keys can type (character "\\"")' });
    expect(samplesOf("x", ["x"], ["y:=x(2)"])).toEqual({ none: "no example the keys can type" });
    expect(samplesOf("x", ["x"], [])).toEqual({ none: "no example in Giac's help" });
  });
});

describe("findcensus classes", () => {
  const value = { kind: "value", re: "0.157299207050285130658779364917390740703933", im: "0" } as const;
  it("judges a number against the oracle: checked, wrong, or unchecked without one", () => {
    expect(classify("erfc", "home", "erfc(1)", answer({ text: "0.15729920705", value: num("0.15729920705"), mark: "≈" }), value).cls).toBe("checked");
    expect(classify("erfc", "home", "erfc(1)", answer({ text: "0.15829920705", value: num("0.15829920705"), mark: "≈" }), value).cls).toBe("wrong");
    expect(classify("erfc", "home", "erfc(1)", answer({ text: "0.15729920705", value: num("0.15729920705"), mark: "≈" }), { kind: "skip", reason: "no oracle" }).cls).toBe("unchecked");
    expect(classify("perm", "home", "perm(4,2)", answer({ text: "0", value: num("0"), mark: "=" }), { kind: "novalue" }).cls).toBe("wrong");
  });
  it("puts a name left behind, a hang, a crash and a parser refusal before the answer", () => {
    expect(classify("GF", "home", "GF(2,8)", answer({ text: "GF(2,8)", left: ["name K", "name g"] }), null)).toEqual({ cls: "state", detail: "name K; name g" });
    expect(classify("f", "cas", "f(1)", { hang: true }, null).cls).toBe("hang");
    expect(classify("plot", "home", "plot(x,x)", answer({ ok: false, crash: "window is not defined" }), null).cls).toBe("crash");
    expect(classify("sst", "home", "", { parserError: "unexpected closing delimiter" }, null)).toEqual({ cls: "refused", detail: "parser: unexpected closing delimiter" });
    expect(classify("znorder", "home", "znorder(17,0.5)", answer({ ok: false, error: "engine", text: "Bad Argument Type" }), null).cls).toBe("refused");
  });
  it("calls a store, assume or purge that left only what the definitions log holds defined, anything more state", () => {
    expect(classify("sto", "home", "sto(2,a)", answer({ text: "2", value: num("2"), mark: "=", left: ["name a", "logged a"] }), null)).toEqual({ cls: "defined", detail: "name a; logged a" });
    expect(classify("purge", "cas", "purge(t)", answer({ text: "t", left: ["logged purge t"] }), null).cls).toBe("defined");
    expect(classify("purge", "cas", "purge(t)", answer({ text: "1", left: ["purged t", "logged purge t"] }), null).cls).toBe("defined");
    // the log does not hold the name, a setting moved, or the command is not one that stores
    expect(classify("sto", "home", "sto(2,a)", answer({ text: "2", left: ["name a"] }), null).cls).toBe("state");
    expect(classify("assume", "cas", "assume(a>0)", answer({ text: "a", left: ["name a", "logged a", "setting 1: 0 -> 1"] }), null).cls).toBe("state");
    expect(classify("QR", "cas", "QR(A,Q,R)", answer({ text: "", left: ["name Q", "logged Q"] }), null).cls).toBe("state");
    expect(loggedOnly(["name a", "logged a", "name b"])).toBe(false);
    expect(loggedOnly(["a program call throws prompt is not defined", "logged a"])).toBe(false);
  });
  it("judges a CAS exact form on numbers as its value against the oracle, and calls it symbolic without one", () => {
    // CAS exponential(2.1,-2) = 21/10*exp(21/5), where the density is 0 (F95)
    const zero = { kind: "value", re: "0", im: "0" } as const;
    const exact = answer({ text: "21/10*exp(21/5)", value: num("140.0412951859"), mark: "=", exact: true });
    expect(classify("exponential", "cas", "exponential(21/10,-2)", exact, zero).cls).toBe("wrong");
    expect(classify("exponential", "cas", "exponential(21/10,-2)", exact, { kind: "skip", reason: "no oracle" })).toEqual({ cls: "symbolic", detail: "21/10*exp(21/5)" });
    // Airy_Ai(0), mpmath at 100 digits (the census's oracle output)
    const ai = { kind: "value", re: "0.3550280538878172392600631860041831763979791741991772405833265103008100424501267129571742460540402717", im: "0" } as const;
    expect(classify("Airy_Ai", "cas", "Airy_Ai(0)", answer({ text: "Airy_Ai(0)", value: { re: decimalFromString(ai.re, 60)!, im: ZERO_VALUE }, mark: "=", exact: true }), ai).cls).toBe("checked");
    // a form Giac reads to 12 digits only (Airy_Ai: a C double) claims 11
    expect(classify("Airy_Ai", "cas", "Airy_Ai(0)", answer({ text: "Airy_Ai(0)", value: num("0.355028053888"), mark: "⚠", n: 11, exact: true }), ai).cls).toBe("checked");
    expect(classify("Airy_Ai", "cas", "Airy_Ai(0)", answer({ text: "Airy_Ai(0)", value: num("0.355028053888"), mark: "=", exact: true }), ai).cls).toBe("wrong");
  });
  describe("a list answer, item by item (G110f1)", () => {
    // erfc(1), erfc(2): mpmath at 100 digits (oracle.py's output for erfc({1,2}))
    const items = {
      kind: "items",
      items: [
        { kind: "value", re: "0.1572992070502851306587793649173907407039330020336970915400621021652827459039891587380166746518551115", im: "0" },
        { kind: "value", re: "0.004677734981047265837930743632747071389108202959939923261647673799562719280004822632370991980319319512", im: "0" },
      ],
    } as const;
    const item = (t: string, v: string, mark: "=" | "≈") => ({ text: t, value: num(v), mark });
    it("classes a Home list wrong when one item's own mark is wrong (the second drawn = though not exact)", () => {
      const a = answer({ text: "[0.15729920705,4.67773498105E-3]", items: [item("0.15729920705", "0.15729920705", "≈"), item("4.67773498105E-3", "0.00467773498105", "=")] });
      expect(classify("erfc", "home", "erfc([1,2])", a, items).cls).toBe("wrong");
    });
    it("classes a Home list on numbers with no oracle unchecked, not symbolic", () => {
      const a = answer({ text: "[1.89511781636,4.95423435217]", items: [item("1.89511781636", "1.89511781636", "≈"), item("4.95423435217", "4.95423435217", "≈")] });
      expect(classify("Ei", "home", "Ei([1,2])", a, { kind: "skip", reason: "no oracle for this function" }).cls).toBe("unchecked");
      expect(classify("Ei", "home", "Ei([1,2])", a, null).cls).toBe("unchecked");
    });
    it("classes a CAS numeric list whose items all match the oracle checked", () => {
      const a = answer({ text: "[0.15729920705,0.00467773498105]", items: [item("0.15729920705", "0.15729920705", "≈"), item("0.00467773498105", "0.00467773498105", "≈")] });
      expect(classify("erfc", "cas", "erfc([1,2])", a, items).cls).toBe("checked");
    });
    // CAS erfc({1,2}) stays exact, [erfc(1),erfc(2)]: bridge-3's readings at 60 and 80 digits (the oracle's digits, cut), item by item
    const sig = (t: string, n: number) => t.slice(0, (/^0\.0*/.exec(t)?.[0].length ?? 0) + n);
    const listValue = (res: readonly string[]): GiacValue => ({
      kind: "list",
      text: "[erfc(1),erfc(2)]",
      shape: [2],
      elements: ["erfc(1)", "erfc(2)"],
      kinds: ["other", "other"],
      at: { "60": res.map((r) => [sig(r, 60), "0"] as [string, string]), "80": res.map((r) => [sig(r, 80), "0"] as [string, string]) },
    });
    const cas = (v: GiacValue) => {
      const r = exactReading(v, 12);
      if (!r || !("items" in r)) throw new Error("no items");
      return answer({ text: v.text, items: r.items });
    };
    it("reads a CAS exact list item by item and classes it checked when every item matches the oracle", () => {
      const a = cas(listValue(items.items.map((o) => o.re)));
      expect(a.items?.map((it) => [it.mark, it.exact])).toEqual([["=", true], ["=", true]]);
      expect(classify("erfc", "cas", "erfc([1,2])", a, items).cls).toBe("checked");
    });
    it("classes a CAS exact list wrong when one item disagrees with the oracle", () => {
      const bad = items.items[1].re.replace("0.0046777349810472", "0.0046777349810473");
      const a = cas(listValue([items.items[0].re, bad]));
      expect(classify("erfc", "cas", "erfc([1,2])", a, items)).toMatchObject({ cls: "wrong", detail: expect.stringContaining("item 2") });
    });
    it("gives a CAS exact list item Giac computed in a C double the digits it prints, less one (15 printed: ≈ at 12)", () => {
      const v = listValue(items.items.map((o) => o.re));
      const d = (r: string) => [sig(r, 15), "0"] as [string, string];
      const a = cas({ ...v, kinds: ["float", "other"], at: { "60": [d(items.items[0].re), v.at!["60"]![1]!], "80": [d(items.items[0].re), v.at!["80"]![1]!] }, doubles: { "60": [1, 0], "80": [1, 0] } });
      expect(a.items?.map((it) => `${it.mark}${it.n ?? ""}`)).toEqual(["≈", "="]);
      expect(classify("erfc", "cas", "erfc([1,2])", a, items).cls).toBe("checked");
    });
  });
  it("reads a CAS list-type answer shown in braces as Giac's list type again, not a set (R80f1)", () => {
    expect(listTypeOf("{Ci(1),Ci(2)}")).toBe("list[Ci(1),Ci(2)]");
    expect(listTypeOf("[{1,2},3]")).toBe("[list[1,2],3]");
    expect(listTypeOf('{"{a}",1}')).toBe('list["{a}",1]');
    expect(listTypeOf("[Ci(1),Ci(2)]")).toBe("[Ci(1),Ci(2)]");
  });
  it("reads a CAS mark by the golden runner's rule (goldenRun.ts casMark)", () => {
    const facts = { exact: true, reliableDigits: null };
    expect(casMark({ ok: true, text: "-7/3", latex: "", facts } as never, 12)).toEqual({ mark: "=" });
    expect(casMark({ ok: true, text: "21/10*exp(21/5)", latex: "", facts } as never, 12)).toBeNull();
    expect(casMark({ ok: true, text: "true", latex: "", approximate: true, facts: { ...facts, warn: "unaudited" } } as never, 12)).toEqual({ mark: "⚠" });
    expect(casMark({ ok: false, text: "1/2", latex: "", facts } as never, 12)).toBeNull();
  });
  it("calls Giac's words, objects and strings raw, and a plain expression symbolic", () => {
    expect(rawText("circle", "pnt(pnt[circle…])", "home", "circle(0,1)")).toBe("a graphic object");
    expect(rawText("graph", "an undirected unweighted graph with 5 vertices and 4 edges", "cas", "graph(5)")).toBe("a graph object");
    expect(rawText("str", '"123/100"', "cas", "str(1.23)")).toBe("a string");
    expect(rawText("znorder", "undef", "home", "znorder(17,0.5)")).toBe("undef");
    expect(classify("diff", "cas", "diff(x^2,x)", answer({ text: "2*x" }), null)).toEqual({ cls: "symbolic", detail: "2*x" });
  });
  it("calls an unevaluated call on numbers raw in Home, and in CAS only with a float in it (an exact form otherwise)", () => {
    expect(onNumbers("Ei(1)")).toBe(true);
    expect(onNumbers("sin(pasdeg*x)")).toBe(false);
    expect(onNumbers("Ei([1,2])+pi")).toBe(true);
    expect(onNumbers("Ci(list[1,2])")).toBe(true);
    expect(onNumbers("Ci(list(1))")).toBe(true);
    expect(onNumbers("Ci(list)")).toBe(false);
    expect(rawText("Ei", "Ei(1)", "cas", "Ei(1)")).toBeNull();
    expect(rawText("Airy_Ai", "[Airy_Ai(1),Airy_Ai(2)]", "home", "Airy_Ai([1,2])")).toBe("Airy_Ai( came back unevaluated");
    expect(rawText("binomial_icdf", "binomial_icdf(4,0.5,3.0)", "cas", "binomial_icdf(4,0.5,3)")).toBe("binomial_icdf( came back unevaluated");
    expect(rawText("piecewise", "piecewise(x>0,1,2)", "home", "piecewise(x>0,1,2)")).toBeNull();
  });
});

describe("findcensus stage", () => {
  const row = (name: string, view: "home" | "cas", k: number, cls: Row["cls"]): Row => ({ id: `${view} ${name}/${k}`, name, view, latex: "L", cls, detail: "d", ms: 1 });
  const rows = [row("erfc", "home", 0, "checked"), row("erfc", "home", 1, "wrong"), row("erfc", "cas", 0, "symbolic"), row("erfc", "cas", 1, "symbolic")];
  it("writes one class string per function, `-` without a sample", () => {
    expect(Object.fromEntries(classStrings(rows, ["cat"]))).toEqual({ erfc: "cw|ss", cat: "-" });
  });
  it("passes when every class and every finding is known", () => {
    const r = censusStage(rows, ["cat"], { findings: { F95: ["home erfc/1"] }, classes: { erfc: "cw|ss", cat: "-" } });
    expect(r).toMatchObject({ ok: true, summary: "1 findings filed, 0 class changes, 0 new findings, 0 now passing" });
  });
  it("fails on a class change, naming the input, on a new finding and on a finding that went away", () => {
    const r = censusStage(rows, ["cat"], { findings: { F95: ["cas erfc/0"] }, classes: { erfc: "cc|ss", cat: "-" } });
    expect(r.ok).toBe(false);
    expect(r.lines).toContain("CHANGED home erfc/1: was checked, now wrong (L  =>  d)");
    expect(r.lines).toContain("NEW finding home erfc/1 [wrong]: L  =>  d");
    expect(r.lines).toContain("NOW PASSING cas erfc/0: listed under F95, now symbolic (remove it)");
  });
  it("fails on a lost function and on an unfiled finding", () => {
    const r = censusStage(rows, [], { findings: { unfiled: ["home erfc/1"] }, classes: { erfc: "cw|ss", cat: "-" } });
    expect(r.lines).toEqual(["GONE cat: in the known file, not in this run", "NEW finding home erfc/1 [wrong]: L  =>  d"]);
  });
  it("rewrites the known file: the header kept, findings kept or unfiled, classes sorted", () => {
    const t = knownText("# head\n# more\nfindings:\n  F1: []\nclasses: {}\n", rows, ["cat"], { findings: { F1: ["cas erfc/0"] } });
    expect(t).toBe('# head\n# more\nfindings:\n  unfiled: ["home erfc/1"]\nclasses:\n  "cat": "-"\n  "erfc": "cw|ss"\n');
  });
  it("runs an input whose class came from a clock again alone, and reports a change that holds as timing, not failed", () => {
    const hang = { ...row("ecm_factor", "cas", 0, "hang"), detail: "no answer before the deadline" };
    const late = { ...row("ellipse", "home", 0, "refused"), detail: "timeout: Took too long" };
    const now = [{ ...hang, cls: "symbolic" as const }, late, row("erfc", "home", 0, "wrong")];
    expect(hitDeadline(hang)).toBe(true);
    expect(hitDeadline(late)).toBe(true);
    expect(hitDeadline(row("erfc", "home", 0, "refused"))).toBe(false);
    const known = { findings: { F97: ["cas ecm_factor/0"] }, classes: { ecm_factor: "|h", ellipse: "s|", erfc: "c|" }, deadline: ["cas ecm_factor/0"] };
    // ecm_factor was a hang (on the deadline list), ellipse hit Home's time-out now; erfc's move is a class change
    expect(timingSuspects(now, known).map((r) => r.id)).toEqual(["cas ecm_factor/0", "home ellipse/0"]);
    const timing = timingChanges(now, new Set(["cas ecm_factor/0", "home ellipse/0"]), known);
    expect([...timing]).toEqual(["cas ecm_factor/0", "home ellipse/0"]);
    const r = censusStage(now, [], known, timing);
    expect(r.lines.filter((l) => l.startsWith("TIMING")).length).toBe(2);
    expect(r.lines).toContain("CHANGED home erfc/0: was checked, now wrong (L  =>  d)");
    expect(r.summary).toBe("1 findings filed, 1 class changes, 1 new findings, 0 now passing");
    // without the timing set the same run fails on all three moves, and the hang that answered is "now passing"
    expect(censusStage(now, [], known).summary).toBe("1 findings filed, 3 class changes, 1 new findings, 1 now passing");
    // a retry that matched the known class is no change at all
    expect([...timingChanges([hang], new Set([hang.id]), known)]).toEqual([]);
  });
  it("writes the inputs that hit a deadline into the known file", () => {
    const hang = row("ecm_factor", "cas", 0, "hang");
    expect(knownText("# h\n", [hang], [], {})).toBe('# h\nfindings:\n  unfiled: ["cas ecm_factor/0"]\ndeadline: ["cas ecm_factor/0"]\nclasses:\n  "ecm_factor": "|h"\n');
  });
});
