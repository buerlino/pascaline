// SPDX-License-Identifier: GPL-3.0-or-later
// G67: Giac's settings read after every call that ran user text, put back, and never stored in the definitions log
// (real Giac build; the engine parts are skipped when none is found, see nodeGiac.ts).
import { describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { giacAvailable, loadNodeGiac, nodeHost } from "./nodeGiac.ts";
import { applyDefChanges, type DefChange, type DefEntry } from "./defs.ts";
import { defaultCasSettings } from "./types.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { contextDiff, flagIn, hostContext, isFlagName, namesUnreadFlag } from "./flags.ts";
import type { GiacApi } from "./host.ts";
import type { GiacBridge } from "./bridge.ts";
import { LibError, parseLibrary } from "./library.ts";
import { gated } from "./ctxGate.ts";

const HEAD = "// pascaline library 1\n";

describe("flag words (no engine)", () => {
  it("finds a setting outside strings and words, not inside a longer name", () => {
    expect(flagIn("approx_mode:=1", "typed")).toBe("approx_mode");
    expect(flagIn("f(x):=x+myepsilon", "typed")).toBeNull();
    expect(flagIn('print("approx_mode")', "typed")).toBeNull();
    expect(isFlagName("Digits")).toBe(true);
    expect(isFlagName("beam")).toBe(false);
    expect(namesUnreadFlag("timeout 0.001", "typed")).toBe(true);
    expect(namesUnreadFlag("sin(1)", "typed")).toBe(false);
  });

  it.skipIf(!giacAvailable())("a library's top-level setting, or a body that calls a setter, is refused", async () => {
    const parse = (await loadNodeGiac()).bridge.parse;
    expect(() => parseLibrary(`${HEAD}// on\napprox_mode:=1\n`, parse)).toThrow(LibError);
    expect(() => parseLibrary(`${HEAD}// sets it\nf(x):={ approx_mode(1); return x; }\n`, parse)).toThrow(/engine's state \(approx_mode\)/);
    expect(() => parseLibrary(`${HEAD}// hex\ng(x):={ integer_format(16); return x; }\n`, parse)).toThrow(/integer_format/);
    expect(() => parseLibrary(`${HEAD}// eps\nh(x):=x+epsilon\n`, parse)).toThrow(/epsilon/);
    expect(parseLibrary(`${HEAD}// plain\nk(x):=x+1\n`, parse).defs).toHaveLength(1);
  });
});

describe("the host's context (no engine)", () => {
  it("compares field by field: Giac's float epsilon and a quoted autosimplify are the same setting", () => {
    const want = hostContext(12);
    expect(contextDiff({ ...want, epsilon: 9.999999999999965e-13, proba_epsilon: 9.999999999999957e-16, autosimplify: "'regroup'" }, want)).toEqual([]);
    expect(contextDiff({ ...want, epsilon: 1e-60, eval_level: 1, decimal_digits: 40 }, want)).toEqual(["decimal_digits", "epsilon", "eval_level"]);
    expect(contextDiff({ ...want, autosimplify: "'simplify'", angle_radian: false }, want)).toEqual(["angle_radian", "autosimplify"]);
    expect(contextDiff({ ...want, autosimplify: "''regroup''" }, want)).toEqual(["autosimplify"]);
  });
});

describe.skipIf(!giacAvailable())("Giac's settings (real Giac)", () => {
  const fresh = async (): Promise<EngineHost> => (await nodeHost());
  const cas = { ...defaultCasSettings };

  it("the host's context is a fresh engine's, at 12, 20 and 30 digits, set by text or through bridge-1", async () => {
    const { giac, bridge } = await loadNodeGiac();
    expect(contextDiff(bridge.ctxGet(), hostContext(12))).toEqual([]);
    for (const d of [20, 30, 12]) {
      giac.eval(`Digits:=${d}`);
      expect(contextDiff(bridge.ctxGet(), hostContext(d))).toEqual([]);
      bridge.ctxSet({ decimal_digits: d + 1 });
      expect(contextDiff(bridge.ctxGet(), hostContext(d + 1))).toEqual([]);
    }
    // the whole context set back is the host's again (G102's restore)
    bridge.ctxSet({ ...hostContext(12), approx_mode: true });
    expect(contextDiff(bridge.ctxGet(), hostContext(12))).toEqual(["approx_mode"]);
    bridge.ctxSet(hostContext(12));
    expect(contextDiff(bridge.ctxGet(), hostContext(12))).toEqual([]);
  });

  it("G102: after each of G67's leak inputs the settings are back through giac_ctx_set, and no getter list is sent as text", async () => {
    const { giac, bridge } = await loadNodeGiac();
    const sent: string[] = [];
    let sets = 0;
    const spy: GiacApi = { ...giac, eval: (t) => (sent.push(t), giac.eval(t)) };
    const counted: GiacBridge = { ...bridge, ctxSet: (f) => (sets++, bridge.ctxSet(f)) };
    const host = new EngineHost(spy, counted);
    const leaks: [view: "cas" | "home", input: string][] = [
      ["cas", "approx_mode:=1"],
      ["cas", "cas_setup(1,0,0,1,0,[1e-12,1e-15],12,[1,100,0,25],0,1,0,1)"],
      ["home", "angle_radian:=0"],
      ["cas", "angle_radian:=0"],
      ["cas", "integer_format(16)"],
      ["cas", "complex_mode:=1"],
      ["cas", "xcas_mode(1)"],
      ["home", "approx_mode:=1"],
    ];
    for (const [view, input] of leaks) {
      const s0 = sets;
      const r = view === "cas" ? host.cas(input, cas).result : host.home(input, defaultHomeSettings).result;
      expect(r.settingReset, input).toBe(true);
      expect(sets, input).toBeGreaterThan(s0);
      expect(contextDiff(bridge.ctxGet(), hostContext(12)), input).toEqual([]);
    }
    expect(sent.filter((t) => /\b(cas_setup|integer_format|xcas_mode|autosimplify|eval_level)\(\)/.test(t))).toEqual([]);
    expect(host.cas("1/3", cas).result.text).toBe("1/3");
    expect(host.cas("255", cas).result.text).toBe("255");
    expect(host.home("sin(1)", defaultHomeSettings).result.display).toBe("0.841470984808");
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
    const { giac, bridge } = await loadNodeGiac();
    const host = new EngineHost(giac, bridge);
    // a throw in a program left eval_level at 1 (phase-1 kept it for the rest of the session)
    const refused = host.home("pasmedian([a,1,2])", defaultHomeSettings).result;
    expect(refused.ok).toBe(false);
    expect(refused.settingReset).toBeUndefined();
    expect(contextDiff(bridge.ctxGet(), hostContext(12))).toEqual([]);
    // (-32)^(1/5) left epsilon at 1e-60
    expect(host.home("(-32)^(1/5)", defaultHomeSettings).result.settingReset).toBeUndefined();
    expect(contextDiff(bridge.ctxGet(), hostContext(12))).toEqual([]);
    expect(host.cas("f67(x):={ approx_mode:=1; return x; }", cas).result.ok).toBe(true);
    expect(host.cas("f67(2)", cas).result.settingReset).toBe(true);
    expect(host.cas("1/3", cas).result.text).toBe("1/3");
  });

  it("G102: a Digits set right after an interrupted call is set (ctx_set clears ctrl_c, G75: one call, no retry), and adjacent sets are one", async () => {
    const L = await loadNodeGiac();
    let sets = 0;
    const { giac, bridge } = gated(L.giac, { ...L.bridge, ctxSet: (f) => (sets++, L.bridge.ctxSet(f)) });
    giac.eval("timeout 0.001");
    giac.eval("ckevery 10");
    // The host's rule (host.ts isTimeout): giac_2.1.0-1 (G77) says "User interrupt or Out of memory", the snapshot before "Stopped by user interruption."
    expect(giac.eval("factor(x^200-1)")).toMatch(/^GIAC_ERROR.*interrupt/i);
    giac.digits(13);
    expect(giac.eval("Digits")).toBe("13");
    expect(sets).toBe(1);
    giac.eval("timeout 10");
    sets = 0;
    giac.digits(20);
    giac.digits(12);
    giac.digits(30);
    expect(bridge.ctxGet().decimal_digits).toBe(30);
    expect(sets).toBe(1);
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
