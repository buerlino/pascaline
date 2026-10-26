// SPDX-License-Identifier: GPL-3.0-or-later
// G109: a value of Giac's list type (`list[…]`, subtype 23) is read and shown as a list, with braces as the G2 shows one,
// and copied with braces; Ans, chips and stored names keep Giac's text, so the type goes on. A solve result is Giac's
// list type too and shows in braces (owner, 2026-10-25); a `[ ]` vector or matrix shows as before. Expected values are derived by hand (golden g109-*).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings, precisionFacts } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { formatConfirmed, markOf } from "./format.ts";
import { bracesOf } from "./giacPrint.ts";
import { homeItem } from "../state/results.ts";
import { copyFull } from "../clipboard/text.ts";
import { giacOfEntry } from "../input/entry.ts";
import { parsePastedNumber } from "../clipboard/paste.ts";
import { homeResultToLatex } from "../render/home.ts";

describe("text helpers", () => {
  it("writes Giac's list type with braces, at any depth, and leaves vectors and strings alone", () => {
    expect(bracesOf("list[1,16]")).toBe("{1,16}");
    expect(bracesOf("list[]")).toBe("{}");
    expect(bracesOf("list[[1,2],[3,4]]")).toBe("{[1,2],[3,4]}");
    expect(bracesOf("[list[1,2],3]")).toBe("[{1,2},3]");
    expect(bracesOf("list[list[1,2],L[1]]")).toBe("{{1,2},L[1]}");
    expect(bracesOf("[1,4]")).toBe("[1,4]");
    expect(bracesOf('mylist[1]+"list[2]"')).toBe('mylist[1]+"list[2]"');
  });

  it("draws braces in LaTeX as braces, not as a group", () => {
    expect(homeResultToLatex("{1,16}")).toBe("\\{1,16\\}");
  });
});

describe.skipIf(!giacAvailable())("G109 on the real engine", () => {
  let host: EngineHost;
  beforeAll(async () => {
    const { giac, bridge } = await loadNodeGiac();
    host = new EngineHost(giac, bridge);
  });
  const home = (input: string) => host.home(input, defaultHomeSettings).result;
  const cas = (input: string) => host.cas(input, defaultCasSettings).result;
  // a CAS result's items, each with its mark
  const marks = (input: string) =>
    (cas(input).numeric?.items ?? []).map((it) => `${it.display} ${markOf(precisionFacts(it), { format: "STD", digits: defaultCasSettings.digits })?.mark ?? "none"}`);
  // as the app copies: the port passes `exact` only for a rational (calc/engine.ts HOME_KEYS)
  const copy = (input: string) => {
    const { exact: _exact, ...r } = home(input);
    return copyFull({ latex: "", status: "done", text: r.display, ...homeItem(r, false) });
  };

  it("shows a list-type power with braces, and copies text the entry reads back as the same list", () => {
    const r = home("list[1,4]^2");
    expect(r).toMatchObject({ ok: true, display: "{1,16}" });
    expect(r.facts.exact).toBe(true);
    // the views draw it again from its facts (other formats): with braces too
    expect(formatConfirmed(precisionFacts(r), { format: "STD", digits: 12 })).toBe("{1,16}");
    const text = copy("list[1,4]^2");
    expect(text).toBe("{1,16}");
    // the copied text itself through the paste reader (golden invariant (c)) and the entry: the same list, and typed
    // braces are Giac's list type (R80), so it comes back with braces
    const pasted = parsePastedNumber(text ?? "");
    expect(pasted?.latex).toBe("\\left\\{1,16\\right\\}");
    const back = home(giacOfEntry(pasted!.latex, "home").giac);
    expect(back).toMatchObject({ ok: true, display: "{1,16}" });
    expect(back.items?.map((it) => it.display)).toEqual(["1", "16"]);
    expect(back.items?.map((it) => it.display)).toEqual(r.items?.map((it) => it.display));
  });

  it("keeps Giac's text for chips and stored names, so the type goes on", () => {
    expect(home("list[1,4]")).toMatchObject({ display: "{1,4}", full: "list[1,4]", exact: "list[1,4]" });
    const { exact: _exact, ...port } = home("list[1,4]");
    expect(homeItem(port, false)).toMatchObject({ full: "list[1,4]", drawn: "{1,4}" });
    expect(home("K:=list[1,4]")).toMatchObject({ ok: true, display: "{1,4}" });
    expect(home("K^2")).toMatchObject({ ok: true, display: "{1,16}" });
  });

  it("shows a list-type value that is no number as Giac's text with braces", () => {
    const r = home("list[1/3,BesselJ(1,2)]");
    expect(r).toMatchObject({ ok: true, display: "{1/3,BesselJ(1,2)}" });
    expect(copy("list[1/3,BesselJ(1,2)]")).toBe("{1/3,BesselJ(1,2)}");
    expect(r.full).toBe("list[1/3,BesselJ(1,2)]");
  });

  it("shows a list of two lists as its two rows, never a matrix", () => {
    const r = home("list[[1,2],[3,4]]");
    expect(r).toMatchObject({ ok: true, display: "{[1,2],[3,4]}" });
    expect(r.shape).toBeUndefined();
    expect(r.latex ?? "").not.toContain("array");
  });

  it("shows an empty list", () => {
    expect(home("list[]")).toMatchObject({ ok: true, display: "{}" });
  });

  it("adds a number to a stored list elementwise, with no refusal", () => {
    expect(home("M:=list[1,4]")).toMatchObject({ ok: true, display: "{1,4}" });
    expect(home("M+1")).toMatchObject({ ok: true, display: "{2,5}" });
    expect(cas("M+1")).toMatchObject({ ok: true });
  });

  // host.ts isList (G106's check): a stored list-type value is a list, so an assignment adding to a vector inside it is
  // guarded and refused before it stores (phase-1 refused the result but stored list[poly1[1,5]] under N, poly1[1,5] under P)
  it("counts a stored list-type value as a list for G106's check", () => {
    expect(home("L:=list[[1,4]]")).toMatchObject({ ok: true });
    expect(cas("N:=L+1")).toMatchObject({ ok: false, error: "listPlusNumber" });
    expect(home("N")).toMatchObject({ ok: true, display: "N" });
    expect(cas("P:=head(L)+1")).toMatchObject({ ok: false, error: "listPlusNumber" });
    expect(home("P")).toMatchObject({ ok: true, display: "P" });
  });

  // the owner, 2026-10-25: a solve result is Giac's list type and shows in braces, in Home and CAS, through a name too
  it("shows a solve result in braces, and its stored value is a list", () => {
    expect(home("solve(x^2=4,x)")).toMatchObject({ ok: true, display: "{-2,2}" });
    expect(home("solve(x^2=2,x)")).toMatchObject({ ok: true, display: "{-1.41421356237,1.41421356237}" });
    expect(cas("solve(x^2=4,x)")).toMatchObject({ ok: true, text: "{-2,2}", full: "list[-2,2]" });
    // CAS draws Giac's latex(), a list in braces (the view tidies `\mathrm{-2}`)
    expect(cas("solve(x^2=4,x)").latex).toBe("\\{\\mathrm{-2},2\\}");
    expect(home("S:=solve(x^2=4,x)")).toMatchObject({ ok: true, display: "{-2,2}" });
    expect(home("S^2")).toMatchObject({ ok: true, display: "{4,4}" });
    expect(home("S+1")).toMatchObject({ ok: true, display: "{-1,3}" });
  });

  // fix round 1: a list type inside a vector is shown and copied with braces in Home, as CAS shows it (one rule)
  it("shows a list type nested in a vector with braces, in Home and CAS alike", () => {
    for (const [input, want] of [["[list[1,2],3]", "[{1,2},3]"], ["[solve(x^2=4,x),1]", "[{-2,2},1]"]] as const) {
      expect(home(input)).toMatchObject({ ok: true, display: want });
      expect(copy(input)).toBe(want);
      expect(cas(input)).toMatchObject({ ok: true, text: want });
    }
  });

  // fix round 1: in DEG a symbolic list-type result copies the degree text it shows, not the radian text of `full`
  it("copies a DEG list-type result as shown", () => {
    const deg = { ...defaultHomeSettings, angle: "deg" as const };
    const { exact: _exact, ...r } = host.home("solve(sin(x)=y,x)", deg).result;
    expect(r.full).toBe("list[asin(y),-asin(y)+pi]");
    expect(r.display).not.toBe(bracesOf(r.full));
    expect(r.display.startsWith("{")).toBe(true);
    expect(copyFull({ latex: "", status: "done", text: r.display, ...homeItem(r, false) })).toBe(r.display);
  });

  // R80f1 (run 251's audit): a CAS float result of Giac's list type gets its items, each with its own mark, as a [ ] vector's
  it("gives a CAS float list-type result its items, each with a mark, as a vector's", () => {
    // Ci(1) = 0.337403922900968…, Ci(2) = 0.422980828774865… (no MPFR path: ⚠, as for the vector)
    expect(marks("evalf(Ci(list[1,2]))")).toEqual(marks("evalf(Ci([1,2]))"));
    expect(marks("evalf(Ci(list[1,2]))")).toHaveLength(2);
    expect(marks("evalf(Ci(list[1,2]))")[0]).toMatch(/^0\.337403922901 /);
    // 1.5 and 2 are exact numbers made floats: each item ≈
    expect(marks("approx(list[3/2,2])")).toEqual(["1.5 ≈", "2 ≈"]);
    expect(marks("approx(list[3/2,2])*1.0")).toEqual(["1.5 ≈", "2 ≈"]);
    expect(marks("approx(list[3/2,2])*1.0")).toEqual(marks("approx([3/2,2])*1.0"));
  });

  // R80f1 fix round 1: the texts typed braces emit in CAS. Typed decimals are exact there (P9) and Ci of an integer stays
  // exact, so neither has a float, and so no items: the same as the [ ] vector gives (the float forms are above)
  it("shows CAS Ci({1,2}) and {1.5,2}*1.0 as the vector does, exact and without items", () => {
    const typed = giacOfEntry("\\operatorname{Ci}\\left(\\left\\{1,2\\right\\}\\right)", "cas").giac;
    expect(typed).toBe("Ci(list[1,2])");
    expect(cas(typed)).toMatchObject({ ok: true, text: "{Ci(1),Ci(2)}" });
    expect(cas("Ci([1,2])")).toMatchObject({ ok: true, text: "[Ci(1),Ci(2)]" });
    expect(marks(typed)).toEqual([]);
    expect(marks(typed)).toEqual(marks("Ci([1,2])"));
    expect(cas("list[1.5,2]*1.0")).toMatchObject({ ok: true, text: "{3/2,2}" });
    expect(marks("list[1.5,2]*1.0")).toEqual([]);
    expect(marks("list[1.5,2]*1.0")).toEqual(marks("[1.5,2]*1.0"));
  });

  it("guards: a vector and a matrix show as before", () => {
    expect(home("[1,4]")).toMatchObject({ ok: true, display: "[1,4]" });
    expect(home("[[1,2],[3,4]]")).toMatchObject({ ok: true, display: "[[1,2],[3,4]]", shape: [2, 2] });
    expect(home("[1,4]^2")).toMatchObject({ ok: true, display: "17" });
  });
});
