// SPDX-License-Identifier: GPL-3.0-or-later
// G46: the stored log brought to route R (Giac in radians, the degrees in the text), and the DEG display rule.
import { fakeGiac } from "./fakeGiac.ts";
import { beforeAll, describe, expect, it } from "vitest";
import { migrateAngleDefs, withoutPasexp } from "./angleMigration.ts";
import { backInDegrees, needsDegrees } from "./degrees.ts";
import { validDefs, type DefEntry } from "./defs.ts";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import { defaultCasSettings } from "./types.ts";
import { DATA_VERSION, migratedText, unstamp } from "../state/storage.ts";

const entry = (x: Partial<DefEntry> & Pick<DefEntry, "name" | "kind" | "cmds">): DefEntry => ({ preview: "", view: "home", time: 0, ...x });
/** A version-2 log as IndexedDB holds it, brought up to DATA_VERSION. */
const migrate = (log: DefEntry[]): DefEntry[] => validDefs(unstamp("defs", { "@pascaline": 2, value: log }).value);

describe("the version-3 step of the stored log (pure)", () => {
  it("is DATA_VERSION 3 and writes the record back", () => {
    expect(DATA_VERSION).toBe(3);
    expect(unstamp("defs", { "@pascaline": 2, value: [] }).upgraded).toBe(true);
  });

  it("pasexp( becomes exp( everywhere, never inside a string", () => {
    expect(withoutPasexp('ph(w):=pasexp(i*w)+pasexp (1)+"pasexp(2)"', "typed")).toBe('ph(w):=exp(i*w)+exp (1)+"pasexp(2)"');
    // A version-2 variable's command is Giac's print: `\` is itself, so the string closes at its quote and the call
    // after it is found (G105f2).
    expect(withoutPasexp('V:=(["C:\\",pasexp(1)])', "printed")).toBe('V:=(["C:\\",exp(1)])');
    // A function's command is typed: `\"` stays inside the string, and the call inside it is left alone.
    expect(withoutPasexp('g(w):={local s; s:="a\\"pasexp(1)"; pasexp(w)}', "typed")).toBe('g(w):={local s; s:="a\\"pasexp(1)"; exp(w)}');
    expect(migrate([entry({ name: "ph", kind: "fn", cmds: ["ph(w):=pasexp(i*w)"] })])[0]!.cmds).toEqual(["ph(w):=exp(i*w)"]);
  });

  it("functions and inputs kept as typed get the factor; one that has it already is left alone", () => {
    const out = migrate([
      entry({ name: "f", kind: "fn", cmds: ["f(x):=sin(x)+asin(x)"] }),
      entry({ name: "g", kind: "fn", cmds: ["g(x):=sin(pasdeg*x)"] }),
      entry({ name: "", kind: "other", cmds: ["(A:=cos(60))+1"] }),
    ]);
    expect(out.map((e) => e.cmds[0])).toEqual(["f(x):=sin(pasdeg*(x))+(asin(x)/pasdeg)", "g(x):=sin(pasdeg*x)", "(A:=cos(pasdeg*(60)))+1"]);
  });

  it("a value whose mode was recorded (G34) is read in it; a symbolic one follows the mode; an older one is flagged", () => {
    const out = migrate([
      entry({ name: "D", kind: "var", cmds: ["D:=(sin(1))"], angle: "deg" }),
      entry({ name: "R", kind: "var", cmds: ["R:=(sin(1))"], angle: "rad" }),
      entry({ name: "S", kind: "var", cmds: ["S:=(sin(x))"], early: true }),
      entry({ name: "T", kind: "var", cmds: ["T:=(atan(3/4))"], preview: "36.8698976458" }),
      entry({ name: "Q", kind: "var", cmds: ["Q:=(sqrt(2))"], preview: "1.41421356237" }),
    ]);
    expect(out.map((e) => [e.cmds[0], e.migrate ?? null])).toEqual([
      ["D:=(sin((pi/180)*(1)))", null],
      ["R:=(sin(1))", null],
      ["S:=(sin(pasdeg*(x)))", null],
      ["T:=(atan(3/4))", "angle"],
      ["Q:=(sqrt(2))", null],
    ]);
  });

  it("a version-2 library text loses pasexp only (its bodies get the factor on import)", () => {
    expect(migratedText("library", "f(x):=pasexp(i*x)+sin(x)", 2)).toBe("f(x):=exp(i*x)+sin(x)");
    // typed: the escaped quote keeps the string open, so the pasexp inside it is text (G105f2)
    expect(migratedText("library", 'k:="a\\"pasexp(1)"', 2)).toBe('k:="a\\"pasexp(1)"');
  });

  it("a function command with a typed escaped quote still gets the factor after the string (G105f2)", () => {
    const out = migrate([entry({ name: "f", kind: "fn", cmds: ['f(x):=when(x=="a\\"b",sin(x),0)'] })]);
    expect(out[0]!.cmds).toEqual(['f(x):=when(x=="a\\"b",sin(pasdeg*(x)),0)']);
  });

  it("the DEG display rule applies to a text with a trig function and no factor", () => {
    expect(needsDegrees("1/180*pi*atan(x)")).toBe(true);
    expect(needsDegrees("(x)->sin(pasdeg*x)")).toBe(false);
    expect(needsDegrees("x^2+exp(x)")).toBe(false);
  });
});

describe.skipIf(!giacAvailable())("G46 on the real engine", () => {
  let host: EngineHost;
  const rad = defaultHomeSettings;
  const deg = { ...defaultHomeSettings, angle: "deg" as const };
  beforeAll(async () => {
    host = (await nodeHost());
  });

  // The check's findings 1 and 2 as version-2 logs (source: oracle, mpmath: atan(3/4) = 36.8698976458°,
  // sin(1) = 0.841470984808, exp(90i) = -0.448073616129+0.893996663601i).
  it("a flagged value keeps the reading that matches its preview, read in either mode afterwards", async () => {
    const h = (await nodeHost());
    const log = migrate([
      entry({ name: "TH", kind: "var", cmds: ["TH:=(atan(3/4))"], preview: "36.8698976458" }),
      entry({ name: "V", kind: "var", cmds: ["V:=(sin(1))"], preview: "0.841470984808" }),
      entry({ name: "A", kind: "var", cmds: ["A:=(cos(16200/pi)+i*sin(16200/pi))"], preview: "-0.448073616129+0.893996663601*i" }),
      entry({ name: "X", kind: "var", cmds: ["X:=(sin(1))"], preview: "5" }),
    ]);
    h.restore(log);
    expect(h.home("TH", rad).result.display).toBe("36.8698976458");
    expect(h.home("TH", deg).result.display).toBe("36.8698976458");
    expect(h.home("V", deg).result.display).toBe("0.841470984808");
    expect(h.home("A", rad).result.display).toBe("-0.448073616129+0.893996663601*i");
    const changed = h.takeMigrated().flatMap((c) => ("set" in c ? [c.set] : []));
    expect(changed.map((e) => [e.name, e.angle ?? null, e.migrate ?? null])).toEqual([
      ["TH", "deg", null],
      ["V", "rad", null],
      ["A", "deg", null],
      ["X", null, null],
    ]);
    expect(changed[0]!.cmds).toEqual(["TH:=((atan(3/4)/(pi/180)))"]);
    // matches neither reading: kept as it was, and listed
    expect(changed[3]!.cmds).toEqual(["X:=(sin(1))"]);
    expect(h.unmatched).toEqual(["X"]);
    expect(h.takeMigrated()).toEqual([]);
  });

  it("a migrated function follows the mode at call time; exp ignores it (F29; derived, oracle exp(90i))", async () => {
    const h = (await nodeHost());
    h.restore(migrate([entry({ name: "f", kind: "fn", cmds: ["f(x):=sin(x)"] }), entry({ name: "ph", kind: "fn", cmds: ["ph(w):=pasexp(i*w)"] })]));
    expect(h.home("f(30)", deg).result.display).toBe("0.5");
    expect(h.home("f(pi/6)", rad).result.display).toBe("0.5");
    expect(h.home("ph(90)", deg).result.display).toBe("-0.448073616129+0.893996663601*i");
  });

  it("CAS in DEG draws the result in degrees and carries the radian text (derived; S14 option 2)", () => {
    const casDeg = { ...defaultCasSettings, angle: "deg" as const };
    const a = host.cas("integrate(1/(1+x^2),x)", casDeg).result;
    expect(a).toMatchObject({ ok: true, text: "1/180*pi*atan(x)", full: "atan(x)" });
    expect(a.latex).toMatch(/\\pi/);
    const d = host.cas("diff(sin(pasdeg*x),x)", casDeg).result;
    expect(d).toMatchObject({ text: "pi/180*cos(x)", full: "pi/180*cos(pi/180*x)" });
    // RAD and angle-free results are untouched
    expect(host.cas("integrate(1/(1+x^2),x)", defaultCasSettings).result).toMatchObject({ text: "atan(x)" });
    expect(host.cas("integrate(1/(1+x^2),x)", defaultCasSettings).result.full).toBeUndefined();
    expect(backInDegrees(fakeGiac((t) => host.eval(t).output), "atan(x)")).toBe("1/180*pi*atan(x)");
  });

  it("Home in DEG draws a symbolic result in degrees, and Ans keeps the radian text (derived)", () => {
    const r = host.home("diff(sin(pasdeg*x),x)", deg).result;
    expect(r.display).toBe("pi/180*cos(x)");
    expect(r.exact).toBe("pi/180*cos(pi/180*x)");
    expect(r.full).toBe(r.exact);
  });
});
