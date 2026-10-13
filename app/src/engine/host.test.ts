// SPDX-License-Identifier: GPL-3.0-or-later
// EngineHost against the real Giac build (skipped when no build is found; see nodeGiac.ts).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { defaultCasSettings } from "./types.ts";
import { formatComplex } from "./format.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";

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
});
