// SPDX-License-Identifier: GPL-3.0-or-later
// G67: Giac's settings read after every call that ran user text, put back, and never stored in the definitions log
// (real Giac build; the engine parts are skipped when none is found, see nodeGiac.ts).
import { describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { applyDefChanges, type DefChange, type DefEntry } from "./defs.ts";
import { defaultCasSettings } from "./types.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { FLAGS_READ, flagIn, flagsExpected, isFlagName, namesUnreadFlag } from "./flags.ts";
import { LibError, parseLibrary } from "./library.ts";

const HEAD = "// pascaline library 1\n";

describe("flag words (no engine)", () => {
  it("finds a setting outside strings and words, not inside a longer name", () => {
    expect(flagIn("approx_mode:=1")).toBe("approx_mode");
    expect(flagIn("f(x):=x+myepsilon")).toBeNull();
    expect(flagIn('print("approx_mode")')).toBeNull();
    expect(isFlagName("Digits")).toBe(true);
    expect(isFlagName("beam")).toBe(false);
    expect(namesUnreadFlag("timeout 0.001")).toBe(true);
    expect(namesUnreadFlag("sin(1)")).toBe(false);
  });

  it("a library's top-level setting, or a body that calls a setter, is refused", () => {
    expect(() => parseLibrary(`${HEAD}// on\napprox_mode:=1\n`)).toThrow(LibError);
    expect(() => parseLibrary(`${HEAD}// sets it\nf(x):={ approx_mode(1); return x; }\n`)).toThrow(/engine's state \(approx_mode\)/);
    expect(() => parseLibrary(`${HEAD}// hex\ng(x):={ integer_format(16); return x; }\n`)).toThrow(/integer_format/);
    expect(() => parseLibrary(`${HEAD}// eps\nh(x):=x+epsilon\n`)).toThrow(/epsilon/);
    expect(parseLibrary(`${HEAD}// plain\nk(x):=x+1\n`).defs).toHaveLength(1);
  });
});

describe.skipIf(!giacAvailable())("Giac's settings (real Giac)", () => {
  const fresh = async (): Promise<EngineHost> => new EngineHost((await loadNodeGiac()).giac);
  const cas = { ...defaultCasSettings };

  it("the expected read is what a fresh engine prints, at 12, 20 and 30 digits", async () => {
    const { giac } = await loadNodeGiac();
    expect(giac.eval(FLAGS_READ)).toBe(flagsExpected(12));
    for (const d of [20, 30, 12]) {
      giac.eval(`Digits:=${d}`);
      expect(giac.eval(FLAGS_READ)).toBe(flagsExpected(d));
    }
  });

  it("the log never stores a setting, in any form; a plain value still is", async () => {
    const host = await fresh();
    const all: DefChange[] = [];
    for (const input of ["approx_mode:=1", "approx_mode:=0", "angle_radian:=0", "complex_mode:=1", "complex_variables:=1", "Digits:=14", "epsilon:=1e-9", "increasing_power:=1", "scientific_format:=1", "purge(epsilon)", "(approx_mode:=1)+1"]) {
      const r = host.cas(input, cas);
      expect(r.defs, input).toEqual([]);
      all.push(...r.defs);
    }
    expect(host.home("approx_mode:=1", defaultHomeSettings).defs).toEqual([]);
    const a = host.cas("a67:=2", cas).defs;
    expect(a).toHaveLength(1);
    expect(applyDefChanges([], [...all, ...a]).map((e) => e.cmds.join(";"))).toEqual(["a67:=(2)"]);
  });

  it("a setting typed in CAS is put back, said on the result, and the mode set again", async () => {
    const host = await fresh();
    const r = host.cas("approx_mode:=1", cas).result;
    expect(r.settingReset).toBe(true);
    expect(host.cas("1/3", cas).result.text).toBe("1/3");
    expect(host.cas("1/3", cas).result.settingReset).toBeUndefined();
    // Home and CAS run the input inside their own precision, which puts Digits back already
    host.cas("Digits:=5", cas);
    expect(host.cas("evalf(pi)", cas).result.text).toBe("3.14159265359");
    expect(host.home("approx_mode:=1", defaultHomeSettings).result.settingReset).toBe(true);
    expect(host.home("1/4", defaultHomeSettings).result.facts.exact).toBe(true);
  });

  it("each parser mode and the hex format are put back (one restore call, or each command alone)", async () => {
    const host = await fresh();
    for (const flag of ["xcas_mode(1)", "xcas_mode(3)", "python_compat(1)", "calc_mode(1)", "integer_format(16)", "cas_setup(1,0,1,1,1,[1e-9,1e-15],20,[1,100,0,25],1,0,1,0)"]) {
      expect(host.cas(flag, cas).result.settingReset, flag).toBe(true);
      expect(host.cas("255+1/3", cas).result.text, flag).toBe("766/3");
      expect(host.cas("factor(x^4-1)", cas).result.text, flag).toBe("(x-1)*(x+1)*(x^2+1)");
    }
  });

  it("Giac's own leaks are put back without a word; a stored function that sets one is said", async () => {
    const { giac } = await loadNodeGiac();
    const host = new EngineHost(giac);
    // a throw in a program left eval_level at 1 (phase-1 kept it for the rest of the session)
    const refused = host.home("pasmedian([a,1,2])", defaultHomeSettings).result;
    expect(refused.ok).toBe(false);
    expect(refused.settingReset).toBeUndefined();
    expect(giac.eval(FLAGS_READ)).toBe(flagsExpected(12));
    // (-32)^(1/5) left epsilon at 1e-60
    expect(host.home("(-32)^(1/5)", defaultHomeSettings).result.settingReset).toBeUndefined();
    expect(giac.eval(FLAGS_READ)).toBe(flagsExpected(12));
    expect(host.cas("f67(x):={ approx_mode:=1; return x; }", cas).result.ok).toBe(true);
    expect(host.cas("f67(2)", cas).result.settingReset).toBe(true);
    expect(host.cas("1/3", cas).result.text).toBe("1/3");
  });

  it("a stored log with settings in it (before G67) does not set them again, and drops the named ones", async () => {
    const t = 0;
    const stored: DefEntry[] = [
      { name: "approx_mode", kind: "var", cmds: ["approx_mode:=(1)"], preview: "1", view: "cas", time: t },
      { name: "Digits", kind: "var", cmds: ["Digits:=(14)"], preview: "14", view: "cas", time: t },
      { name: "", kind: "other", cmds: ["(approx_mode:=1)+1"], preview: "2", view: "cas", time: t },
      { name: "b67", kind: "var", cmds: ["b67:=(3)"], preview: "3", view: "cas", time: t },
    ];
    const host = await fresh();
    host.restore(stored);
    expect(host.takeMigrated()).toEqual([{ purge: ["approx_mode", "Digits"] }]);
    expect(host.home("1/4", defaultHomeSettings).result.facts.exact).toBe(true);
    expect(host.cas("b67+1/3", cas).result.text).toBe("10/3");
  });
});
