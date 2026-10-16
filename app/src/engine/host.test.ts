// SPDX-License-Identifier: GPL-3.0-or-later
// EngineHost against the real Giac build (skipped when no build is found; see nodeGiac.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { formatComplex } from "./format.ts";
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
});
