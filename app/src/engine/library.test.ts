// SPDX-License-Identifier: GPL-3.0-or-later
// The library file (G33) against the real engine; the sample files are the S4 probe's (tools/probes/library/).
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { giacAvailable, loadNodeGiac, nodeHost } from "./nodeGiac.ts";
import { applyDefChanges, userNamesOf, validDefs, type DefEntry } from "./defs.ts";
import { defaultCasSettings } from "./types.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { renameOurCalls, writeUserNames } from "./ourNames.ts";
import type { GiacParse } from "./bridge.ts";
import { exportLibrary, importLibrary, LibError, parseLibrary, type ImportResult } from "./library.ts";

/** G100: Giac's tree of a text, for parseLibrary; set when an engine is found. */
let parse: (text: string) => GiacParse;
beforeAll(async () => {
  if (giacAvailable()) parse = (await loadNodeGiac()).bridge.parse;
});

const file = (n: string): Uint8Array => readFileSync(new URL(`../../../tools/probes/library/${n}`, import.meta.url));

describe.skipIf(!giacAvailable())("parseLibrary (Giac's tree, no evaluation)", () => {
  it("reads the sample: four definitions, descriptions, tests with their lines (derived)", () => {
    const lib = parseLibrary(file("beams.txt"), parse);
    expect(lib.defs.map((d) => `${d.kind} ${d.name}`)).toEqual(["fn beam_M", "fn beam_w", "fn sumpow", "var g0"]);
    expect(lib.defs[0]!.desc).toBe("Maximum bending moment of a simply supported beam under a uniform load q over span L: q·L²/8");
    expect(lib.defs[0]!.tests.map((t) => t.line)).toEqual([7, 8]);
    expect(lib.defs[2]!.text).toContain("return s;");
  });
  const refused: [string, RegExp][] = [
    ["bad-assume.txt", /only definitions/],
    ["bad-semicolon.txt", /second statement/],
    ["bad-digits.txt", /changes the engine's state \(Digits\)/],
    ["bad-purge.txt", /changes the engine's state \(purge\)/],
    ["bad-read.txt", /changes the engine's state \(read\)/],
    ["bad-global.txt", /assigns a, which is not local/],
    ["bad-ours.txt", /Pascaline's own names/],
    ["bad-nodesc.txt", /needs its one-line description/],
    ["bad-header.txt", /first line must be/],
    ["bad-newer.txt", /newer Pascaline/],
    ["bad-encoding.txt", /not UTF-8/],
  ];
  for (const [name, why] of refused) {
    it(`refuses ${name} as a whole (derived)`, () => {
      expect(() => parseLibrary(file(name), parse)).toThrow(why);
      expect(() => parseLibrary(file(name), parse)).toThrow(LibError);
    });
  }
  it("refuses G50's complex helper as Pascaline's own name (derived: the audit's pastanh(z):=0 case; pastanh went with G75, pasasin, pasacos and pasacosh with G60)", () => {
    for (const name of ["pasatan"]) {
      expect(() => parseLibrary(`// pascaline library 1\n// d\n${name}(z):=0\n`, parse), name).toThrow(/pas\w+ is one of Pascaline's own names/);
    }
  });
  it("refuses paspoly1, G106f1's helper, as Pascaline's own name", () => {
    expect(() => parseLibrary("// pascaline library 1\n// d\npaspoly1(v):=5\n", parse)).toThrow(/paspoly1 is one of Pascaline's own names/);
    expect(() => parseLibrary("// pascaline library 1\n// d\npaspoly1:=5\n", parse)).toThrow(/paspoly1 is one of Pascaline's own names/);
  });
  it("refuses pasdeg, the degree factor (R64), as a name and in a body", () => {
    expect(() => parseLibrary("// pascaline library 1\n// d\npasdeg:=5\n", parse)).toThrow(/pasdeg is one of Pascaline's own names/);
    expect(() => parseLibrary("// pascaline library 1\n// d\nf(x):={local pasdeg; pasdeg:=2; return sin(x);}\n", parse)).toThrow(/pasdeg is one of Pascaline's own names/);
    expect(() => parseLibrary("// pascaline library 1\n// d\nf(x):=x*pasdegree\n", parse)).not.toThrow();
  });
  it("G93: refuses a body that clears names (rm_a_z, restart, restart_vars, restart_modes, rm_all_vars), as a value too (derived)", () => {
    for (const c of ["rm_a_z(1)", "restart(0)", "restart_vars(0)", "restart_modes()", "rm_all_vars()"]) {
      const head = c.slice(0, c.indexOf("("));
      expect(() => parseLibrary(`// pascaline library 1\n// d\nf(x):={ ${c}; return x; }\n`, parse), c).toThrow(new RegExp(`line 3: the body changes the engine's state \\(${head}\\)`));
      expect(() => parseLibrary(`// pascaline library 1\n// d\ng:=${c}\n`, parse), c).toThrow(new RegExp(`line 3: the body changes the engine's state \\(${head}\\)`));
    }
  });
  it("refuses a file over 256 kB, a description over 120 characters and more than 200 definitions", () => {
    expect(() => parseLibrary(new Uint8Array(256 * 1024 + 1), parse)).toThrow(/256 kB/);
    expect(() => parseLibrary(`// pascaline library 1\n// ${"x".repeat(121)}\nf(x):=x\n`, parse)).toThrow(/over 120/);
    const many = Array.from({ length: 201 }, (_, i) => `// d\nf${i}(x):=x+${i}\n`).join("\n");
    expect(() => parseLibrary(`// pascaline library 1\n${many}`, parse)).toThrow(/more than 200/);
  });
  it("refuses a test line that changes state, assigns or has a second statement (derived)", () => {
    const lib = (t: string): string => `// pascaline library 1\n// d\nf(x):=x\n// test: ${t}\n`;
    expect(() => parseLibrary(lib("Digits:=5 ; 1"), parse)).toThrow(/line 4: the test changes the engine's state \(Digits\)/);
    expect(() => parseLibrary(lib("purge(f)==0"), parse)).toThrow(/line 4: the test changes the engine's state \(purge\)/);
    expect(() => parseLibrary(lib("a:=3"), parse)).toThrow(/line 4: a test must not assign/);
    expect(() => parseLibrary(lib("f(1)==1 ; f(2)==2"), parse)).toThrow(/line 4: one expression per test/);
    expect(parseLibrary(lib("f(1)==1"), parse).defs[0]!.tests).toHaveLength(1);
  });
  it("refuses every form of storing into a global in a body, for fn and arrow definitions (derived)", () => {
    // G100: Giac reads the prefix forms ++a and --a as `undef++; a` (a syntax error, nothing stored into a)
    for (const f of ["++a", "--a"])
      expect(() => parseLibrary(`// pascaline library 1\n// d\nf(x):={ ${f}; return x; }\n`, parse), f).toThrow(/line 3: Giac cannot read this definition/);
    const forms = ["a++", "a--", "a+=1", "a-=1", "a*=2", "a/=2", "a=<5", "a[1]:=x", "a:=1", "a[k[1]]:=x", "a[b[1]]++", "a[f(1)][2]+=1"];
    for (const f of forms) {
      for (const d of [`f(x):={ ${f}; return x; }`, `f:=x->{ ${f}; return x; }`, `f:=(x,y)->{ ${f}; return x; }`]) {
        expect(() => parseLibrary(`// pascaline library 1\n// d\n${d}\n`, parse), d).toThrow(/the body assigns a, which is not local/);
      }
    }
    expect(() => parseLibrary("// pascaline library 1\n// d\ng(x):={ b[1]:=x; return x; }\n", parse)).toThrow(/assigns b,/);
    expect(parseLibrary("// pascaline library 1\n// d\nf(x):={ local a,k; a++; a+=1; for (k:=1;k<3;k++) { a[1]:=k; } return x; }\n", parse).defs).toHaveLength(1);
    expect(parseLibrary("// pascaline library 1\n// d\nf(x):={ local a,k; a[k[1]]:=x; return x; }\n", parse).defs).toHaveLength(1);
    expect(parseLibrary("// pascaline library 1\n// d\nf(x):={ x++; return \"a++\"; }\n", parse).defs).toHaveLength(1);
  });
  it("refuses a loop variable, an inner function and a storing value; accepts them local (derived)", () => {
    const p = (d: string): string => `// pascaline library 1\n// d\n${d}\n`;
    // G100: each loop has a body (Giac reads an empty one as a syntax error, an `undef` body)
    for (const l of ["for k from 1 to n do n; od;", "for k in [1,2] do n; od;", "pour k de 1 jusque n faire n; fpour;", "FOR k FROM 1 TO n DO n; END;", "for k FROM 1 to n do n; od;"])
      expect(() => parseLibrary(p(`f(n):={ ${l} return n; }`), parse), l).toThrow(/assigns k, which is not local/);
    expect(parseLibrary(p("f(n):={ local k; for k from 1 to n do n; od; return n; }"), parse).defs).toHaveLength(1);
    expect(parseLibrary(p("f(n):={ local k; FOR k FROM 1 TO n DO n; END; return n; }"), parse).defs).toHaveLength(1);
    expect(() => parseLibrary(p("f(x):={ g(y):=y+1; return x; }"), parse)).toThrow(/assigns g, which is not local/);
    expect(parseLibrary(p("f(x):={ local g; g(y):=y+1; return x; }"), parse).defs).toHaveLength(1);
    expect(() => parseLibrary(p("v:=a++"), parse)).toThrow(/assigns a, which is not local/);
    expect(() => parseLibrary(p("v:=(a+=10)"), parse)).toThrow(/assigns a, which is not local/);
  });
  it("refuses a test line that assigns anywhere, by := ++ -- op= or =< (derived)", () => {
    const lib = (t: string): string => `// pascaline library 1\n// d\nf(x):=x\n// test: ${t}\n`;
    // G100: Giac cannot read f(--a) (a syntax error): refused for that
    expect(() => parseLibrary(lib("f(--a)==1"), parse)).toThrow(/line 4: Giac cannot read the test/);
    for (const t of ["(a:=5)==5", "f(a++)==1", "f(a+=1)==1", "f(a-=1)==1", "f(a*=2)==1", "f(a/=2)==1", "f(a=<5)==1", "f(a[1]:=2)==1"])
      expect(() => parseLibrary(lib(t), parse), t).toThrow(/line 4: a test must not assign/);
    expect(parseLibrary(lib('f(1)==1 && "a:=5"=="a:=5"'), parse).defs[0]!.tests).toHaveLength(1);
    expect(parseLibrary(lib("f(1)<=1 and f(2)>=1"), parse).defs[0]!.tests).toHaveLength(1);
  });
  it("takes CRLF and a BOM", () => {
    expect(parseLibrary("﻿// pascaline library 1\r\n// d\r\nf(x):=x\r\n", parse).defs[0]!.name).toBe("f");
  });
});

describe.skipIf(!giacAvailable())("importLibrary (real Giac)", () => {
  let host: EngineHost;
  const fresh = async (): Promise<EngineHost> => (await nodeHost());
  beforeAll(async () => {
    host = await fresh();
  });
  const ok = (r: ImportResult): Extract<ImportResult, { ok: true }> => {
    if (!r.ok) throw new Error(r.error);
    return r;
  };

  it("imports beams.txt with its descriptions and passes its tests (derived)", async () => {
    const h = await fresh();
    const r = ok(importLibrary(h, parseLibrary(file("beams.txt"), parse), []));
    expect(r.plan).toEqual({ added: ["beam_M", "beam_w", "sumpow", "g0"], same: [], replaced: [] });
    expect(r.tests).toBe(5);
    expect(r.log.map((e) => [e.name, e.kind])).toEqual([["beam_M", "fn"], ["beam_w", "fn"], ["sumpow", "fn"], ["g0", "var"]]);
    expect(r.log[0]!.desc).toContain("Maximum bending moment");
    expect(userNamesOf(r.log).map((u) => u.desc?.slice(0, 7))).toEqual(["Maximum", "Mid-spa", "Sum of ", "Standar"]);
    expect(validDefs(JSON.parse(JSON.stringify(r.log))).map((e) => e.desc)).toEqual(r.log.map((e) => e.desc));
    expect(h.eval("beam_M(2,4)").output).toBe("4");
    expect(h.eval("sumpow(2,3)").output).toBe("20/3");
  });

  it("refuses a built-in name (bad-builtin.txt) and a failing test, listing the line (derived)", async () => {
    const a = importLibrary(await fresh(), parseLibrary(file("bad-builtin.txt"), parse), []);
    expect(a).toMatchObject({ ok: false, line: 5, dirty: false });
    expect(!a.ok && a.error).toMatch(/Beta is a built-in/);
    const b = importLibrary(await fresh(), parseLibrary(file("bad-test.txt"), parse), []);
    expect(b).toMatchObject({ ok: false, dirty: true, failures: [{ line: 6, expr: "sqq(3) == 10", got: "false" }] });
    expect(!b.ok && b.error).toBe("line 6: test failed: sqq(3) == 10 gave false");
  });

  it("reports every failing test, not only the first", async () => {
    const r = importLibrary(await fresh(), parseLibrary("// pascaline library 1\n// d\nf(x):=x\n// test: f(1) == 2\n// test: f(2) == 2\n// test: f(3) == 4\n", parse), []);
    expect(!r.ok && r.failures?.map((f) => f.line)).toEqual([4, 6]);
  });

  it("lists a clash with an own name and defines nothing; replaces on request (derived)", async () => {
    const h = await fresh();
    const mine = applyDefChanges([], h.cas("beam_M(q,L):=q*L", defaultCasSettings).defs);
    const lib = parseLibrary(file("beams.txt"), parse);
    const r = importLibrary(h, lib, mine);
    expect(r).toMatchObject({ ok: false, clashes: ["beam_M"], dirty: false });
    expect(h.eval("beam_w(384,1,5,1)").output).not.toBe("1"); // nothing of the file was defined
    expect(mine[0]!.cmds).toEqual(["beam_M(q,L):=q*L"]);
    const done = ok(importLibrary(h, lib, mine, { replace: true }));
    expect(done.plan.replaced).toEqual(["beam_M"]);
    expect(done.log.find((e) => e.name === "beam_M")!.cmds[0]).toContain("q*L^2/8");
  });

  it("importing the same file twice: all unchanged, no clash", async () => {
    const h = await fresh();
    const lib = parseLibrary(file("beams.txt"), parse);
    const first = ok(importLibrary(h, lib, []));
    const again = ok(importLibrary(h, lib, first.log));
    expect(again.plan).toEqual({ added: [], same: ["beam_M", "beam_w", "sumpow", "g0"], replaced: [] });
    expect(again.changes).toEqual([]);
  });

  it("refuses an import that would pass 500 definitions, with the numbers", async () => {
    const h = await fresh();
    const full: DefEntry[] = Array.from({ length: 500 }, (_, i) => ({ name: `v${i}`, kind: "var", cmds: [`v${i}:=(1)`], preview: "1", view: "home", time: 0 }));
    const r = importLibrary(h, parseLibrary("// pascaline library 1\n// d\nzz(x):=x\n", parse), full);
    expect(!r.ok && r.error).toMatch(/now 500, new 1/);
  });

  it("an export re-imports to the same log (derived)", async () => {
    const h = await fresh();
    const first = ok(importLibrary(h, parseLibrary(file("beams.txt"), parse), []));
    const { text, skipped } = exportLibrary(first.log);
    expect(skipped).toEqual([]);
    const back = ok(importLibrary(await fresh(), parseLibrary(text, parse), []));
    const core = (l: readonly DefEntry[]) => l.map((e) => ({ name: e.name, kind: e.kind, cmds: e.cmds, desc: e.desc }));
    expect(core(back.log)).toEqual(core(first.log));
    expect(exportLibrary(back.log).text).toBe(text);
  });

  it("export: typed definitions get a description, floats and assumptions are left out (derived)", async () => {
    const h = await fresh();
    let log: DefEntry[] = [];
    for (const s of ["beam(q,L):=q*L^2/8", "A:=5", "B:=A*2", "assume(x>0)"]) log = applyDefChanges(log, h.cas(s, defaultCasSettings).defs);
    const withFloat: DefEntry = { name: "C", kind: "var", cmds: ["C:=(1.5)"], preview: "1.5", view: "cas", time: 0, facts: { exact: false, reliableDigits: 5 } };
    const { text, skipped } = exportLibrary([...log, withFloat]);
    expect(skipped.map((s) => s.name)).toEqual(["x", "C"]);
    expect(text).toContain("// beam(q,L)\nbeam(q,L):=q*L^2/8");
    expect(text).toContain("B:=(10)");
    const back = ok(importLibrary(await fresh(), parseLibrary(text, parse), []));
    expect(back.log.map((e) => e.name)).toEqual(["beam", "A", "B"]);
  });

  it("200 library programs replay: prints the desktop median and the device estimate (a measurement, no assert)", { timeout: 60000 }, async () => {
    const h = await fresh();
    let text = "// pascaline library 1\n";
    for (let i = 1; i <= 200; i++) text += `\n// program ${i}\nlib${i}(a,b):={\n  local s,k;\n  s:=0;\n  for (k:=1;k<=b;k++) { s:=s+a^k/k; }\n  return s+${i};\n}\n`;
    const r = ok(importLibrary(h, parseLibrary(text, parse), []));
    expect(r.log).toHaveLength(200);
    const ms: number[] = [];
    for (let k = 0; k < 9; k++) ms.push((await fresh()).restore(r.log));
    const median = [...ms].sort((a, b) => a - b)[4]!;
    console.log(`G33: replay of 200 library programs, desktop median ${median.toFixed(1)} ms (${ms.map((m) => m.toFixed(1)).join(" ")}); import ${r.ms.toFixed(0)} ms`);
    // G29's budget is 50 ms on the Tab One, where the desktop's 10.8 ms (200 definitions) became 291 ms: ratio 291/10.8.
    // The device estimate uses the median (not the minimum).
    const deviceMs = median * (291 / 10.8);
    console.log(`G33: device estimate ${deviceMs.toFixed(0)} ms against the 50 ms budget`);
  });
});

// G83 (docs/04 6.2): the user's functions wait for their first use, so the 200 programs cost restore() nothing.
describe.skipIf(!giacAvailable())("200 library programs, defined on first use (G83, real Giac)", () => {
  let log: DefEntry[] = [];
  let eagerHost: EngineHost;
  const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
  beforeAll(async () => {
    eagerHost = (await nodeHost());
    let text = "// pascaline library 1\n";
    for (let i = 1; i <= 200; i++) text += `\n// program ${i}\nlib${i}(a,b):={\n  local s,k;\n  s:=0;\n  for (k:=1;k<=b;k++) { s:=s+a^k/k; }\n  return s+${i};\n}\n`;
    const r = importLibrary(eagerHost, parseLibrary(text, parse), []);
    if (!r.ok) throw new Error(r.error);
    log = r.log;
  }, 60000);
  /** An eager replay as before G83: every command straight to Giac, 25 to a call (G29). */
  const eagerReplay = async (): Promise<EngineHost> => {
    const { giac, bridge } = await loadNodeGiac();
    const h = new EngineHost(giac, bridge);
    for (let k = 0; k < log.length; k += 25) giac.eval(log.slice(k, k + 25).map((e) => e.cmds[0]).join(";") + ";");
    return h;
  };

  it("after restore() Giac holds none of them; lib7(2,3) gives what the eagerly defined one gives (derived: 2+4/2+8/3+7 = 41/3)", async () => {
    const { giac, bridge } = await loadNodeGiac();
    const h = new EngineHost(giac, bridge);
    h.restore(log);
    expect(giac.eval("VARS")).not.toMatch(/\blib\d+\b/);
    expect(h.home("lib7(2,3)", defaultHomeSettings).result.exact).toBe("41/3");
    expect(eagerHost.home("lib7(2,3)", defaultHomeSettings).result.exact).toBe("41/3");
    expect(giac.eval("VARS")).not.toMatch(/\blib8\b/); // only what the input named
    expect(h.cas("VARS", defaultCasSettings).result.text.match(/\blib\d+\b/g)).toHaveLength(200); // typed: all of them
  });

  it("a unit request for 2 m and a root analysis of x^2-2 leave every program pending (G83f1: their keys and JSON load nothing)", async () => {
    const { giac, bridge } = await loadNodeGiac();
    const h = new EngineHost(giac, bridge);
    h.restore(log);
    // the job calc/units.ts makes for `2 m` (calc/units.test.ts); its key `expr` matched LOAD_ALL before G83f1
    expect(h.units({ expr: "2*(((1)*pasdimL^(1)))", check: "pasz1*(((1)*pasdimL^(1)))", inexact: false, shows: [{ text: "m", dim: "m1", factor: "1" }] }, defaultHomeSettings)).toMatchObject({ dimension: "m1" });
    expect(h.analyze({ kind: "root", f: "x^2-2", x0: "1" }, defaultHomeSettings).ok).toBe(true);
    expect(giac.eval("VARS")).not.toMatch(/\blib\d+\b/);
  });

  it("restore() of the 200 takes under 50 ms in Node, and a first call at most 10 ms more than after an eager replay (median of 7)", { timeout: 120000 }, async () => {
    const restoreMs: number[] = [];
    const lazyFirst: number[] = [];
    const eagerFirst: number[] = [];
    for (let k = 0; k < 7; k++) {
      const h = (await nodeHost());
      restoreMs.push(h.restore(log));
      let t0 = performance.now();
      h.home("lib7(2,3)", defaultHomeSettings);
      lazyFirst.push(performance.now() - t0);
      const e = await eagerReplay();
      t0 = performance.now();
      e.home("lib7(2,3)", defaultHomeSettings);
      eagerFirst.push(performance.now() - t0);
    }
    console.log(`G83: restore of 200 library programs, Node median ${median(restoreMs).toFixed(2)} ms; first lib7 call lazy ${median(lazyFirst).toFixed(2)} ms, eager ${median(eagerFirst).toFixed(2)} ms`);
    expect(median(restoreMs)).toBeLessThan(50);
    expect(median(lazyFirst) - median(eagerFirst)).toBeLessThanOrEqual(10);
  });
});

// G46 (route R, S14 R14 section 5): a library file is Giac text in radians, without our degree factor.
describe.skipIf(!giacAvailable())("the degree factor in library files (G46, real Giac)", () => {
  const fresh = async (): Promise<EngineHost> => (await nodeHost());
  const deg = { ...defaultHomeSettings, angle: "deg" as const };

  it("the import puts the factor in: a body's sin follows the mode at call time (derived: sin 30° = 1/2, sin(pi/6) = 1/2)", async () => {
    const h = await fresh();
    const r = importLibrary(h, parseLibrary("// pascaline library 2\n// sine\nsn(x):=sin(x)\n", parse), []);
    expect(r.ok).toBe(true);
    expect(r.ok && r.log[0]!.cmds[0]).toContain("pasdeg");
    expect(h.home("sn(30)", deg).result.display).toBe("0.5");
    expect(h.home("sn(pi/6)", defaultHomeSettings).result.display).toBe("0.5");
  });

  it("the export writes the body without it, and a file round-trips (derived)", async () => {
    const h = await fresh();
    const log = applyDefChanges([], h.home("sqa(x):=sin(pasdeg*x)^2+asin(x)/pasdeg", deg).defs);
    const { text } = exportLibrary(log);
    expect(text).not.toContain("pasdeg");
    expect(text).toContain("sin(x)");
    const back = importLibrary(await fresh(), parseLibrary(text, parse), []);
    expect(back.ok && exportLibrary(back.log).text).toBe(text);
    expect(back.ok && back.log[0]!.cmds[0]).toBe("sqa(x):=sin(pasdeg*(x))^2+(asin(x)/pasdeg)");
  });

  it("a test line runs in radians whatever the mode, and the mode's factor is put back (derived: sin(pi/2) = 1)", async () => {
    const h = await fresh();
    const lib = parseLibrary("// pascaline library 3\n// sine\nsn(x):=sin(x)\n// test: sn(pi/2) == 1\n", parse);
    const first = importLibrary(h, lib, []);
    expect(first).toMatchObject({ ok: true, tests: 1 });
    // The same file again defines nothing (no cas() resets the mode), so the tests meet DEG's pasdeg and put it back.
    h.home("1", deg);
    const again = importLibrary(h, lib, first.ok ? first.log : []);
    expect(again).toMatchObject({ ok: true, tests: 1, plan: { same: ["sn"] } });
    expect(h.eval("pasdeg").output).toBe("pi/180");
    expect(h.home("sn(90)", deg).result.display).toBe("1");
  });

  it("a version-2 file's pasexp reads as exp (derived: exp(i*pi) = -1)", async () => {
    const h = await fresh();
    const r = importLibrary(h, parseLibrary("// pascaline library 2\n// phasor\nph(w):=pasexp(i*w)\n", parse), []);
    expect(r.ok && r.log[0]!.cmds[0]).toBe("ph(w):=exp(i*w)");
    expect(h.home("ph(pi)", deg).result.display).toBe("-1");
  });
});

// G54: our names for Giac's functions in library text (ourNames.ts), as the parser renames them.
describe.skipIf(!giacAvailable())("our function names in library files (G54, real Giac)", () => {
  const fresh = async (): Promise<EngineHost> => (await nodeHost());
  const text = "// pascaline library 3\n// median of a list\nm(L):=median(L)\n// test: median([1,2,3,4]) == 5/2\n// remainder\nr(a,b):=irem(a,b)\n// test: r(-7,3) == 2\n";

  it("a definition's median is ours, and the test line passes (derived: the median of 1,2,3,4 is 5/2)", async () => {
    const h = await fresh();
    const r = importLibrary(h, parseLibrary(text, parse), []);
    expect(r).toMatchObject({ ok: true, tests: 2 });
    expect(h.home("m([1,2,3,4])", defaultHomeSettings).result.display).toBe("2.5");
  });

  it("a name right after a digit is ours too (derived: 2 * 5/2 = 5)", async () => {
    const h = await fresh();
    const t = "// pascaline library 3\n// twice the median\nm(L):=2median(L)\n";
    expect(importLibrary(h, parseLibrary(t, parse), [])).toMatchObject({ ok: true });
    expect(h.home("m([1,2,3,4])", defaultHomeSettings).result.display).toBe("5");
  });

  it("irem in a body gives what a typed mod gives (derived: -7 mod 3 = 2, G45)", async () => {
    const h = await fresh();
    importLibrary(h, parseLibrary(text, parse), []);
    expect(h.home("r(-7,3)", defaultHomeSettings).result.display).toBe("2");
    expect(h.home("r(15/2,2)", defaultHomeSettings).result.display).toBe("1.5"); // 7.5 = 3*2 + 1.5, where raw irem is an error
  });

  it("the export writes the user's names back, and a file round-trips", async () => {
    const h = await fresh();
    const r = importLibrary(h, parseLibrary(text, parse), []);
    const out = exportLibrary(r.ok ? r.log : []).text;
    expect(out).toContain("m(L):=median(L)");
    expect(out).not.toContain("pasmedian");
    const back = importLibrary(await fresh(), parseLibrary(out, parse), []);
    expect(back.ok && exportLibrary(back.log).text).toBe(out);
  });
});

describe("renameOurCalls (no engine)", () => {
  it("renames whole names, calls only, outside strings", () => {
    expect(renameOurCalls('median(L)+mod (a,b)+irem(1,2)+percentile(L,5)')).toBe("pasmedian(L)+pasmod (a,b)+pasmod(1,2)+paspercentile(L,5)");
    expect(renameOurCalls('"median(x)"+median+x.mod(2)+mymedian(L)+pasmedian(L)+1e3+1e3median(L)')).toBe('"median(x)"+median+x.mod(2)+mymedian(L)+pasmedian(L)+1e3+1e3*pasmedian(L)');
    expect(renameOurCalls("2median(L)+2.5mod(a,b)")).toBe("2*pasmedian(L)+2.5*pasmod(a,b)");
  });
  it("writeUserNames is the inverse", () => {
    expect(writeUserNames("pasmedian(L)+pasmod(a,b)+paspercentile(L,5)")).toBe("median(L)+mod(a,b)+percentile(L,5)");
  });
});
