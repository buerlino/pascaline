// SPDX-License-Identifier: GPL-3.0-or-later
// The library file (G33) against the real engine; the sample files are the S4 probe's (tools/probes/library/).
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { applyDefChanges, userNamesOf, validDefs, type DefEntry } from "./defs.ts";
import { defaultCasSettings } from "./types.ts";
import { exportLibrary, importLibrary, LibError, parseLibrary, type ImportResult } from "./library.ts";

const file = (n: string): Uint8Array => readFileSync(new URL(`../../../tools/probes/library/${n}`, import.meta.url));

describe("parseLibrary (no engine)", () => {
  it("reads the sample: four definitions, descriptions, tests with their lines (derived)", () => {
    const lib = parseLibrary(file("beams.txt"));
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
      expect(() => parseLibrary(file(name))).toThrow(why);
      expect(() => parseLibrary(file(name))).toThrow(LibError);
    });
  }
  it("refuses a file over 256 kB, a description over 120 characters and more than 200 definitions", () => {
    expect(() => parseLibrary(new Uint8Array(256 * 1024 + 1))).toThrow(/256 kB/);
    expect(() => parseLibrary(`// pascaline library 1\n// ${"x".repeat(121)}\nf(x):=x\n`)).toThrow(/over 120/);
    const many = Array.from({ length: 201 }, (_, i) => `// d\nf${i}(x):=x+${i}\n`).join("\n");
    expect(() => parseLibrary(`// pascaline library 1\n${many}`)).toThrow(/more than 200/);
  });
  it("refuses a test line that changes state, assigns or has a second statement (derived)", () => {
    const lib = (t: string): string => `// pascaline library 1\n// d\nf(x):=x\n// test: ${t}\n`;
    expect(() => parseLibrary(lib("Digits:=5 ; 1"))).toThrow(/line 4: the test changes the engine's state \(Digits\)/);
    expect(() => parseLibrary(lib("purge(f)==0"))).toThrow(/line 4: the test changes the engine's state \(purge\)/);
    expect(() => parseLibrary(lib("a:=3"))).toThrow(/line 4: a test must not assign/);
    expect(() => parseLibrary(lib("f(1)==1 ; f(2)==2"))).toThrow(/line 4: one expression per test/);
    expect(parseLibrary(lib("f(1)==1")).defs[0]!.tests).toHaveLength(1);
  });
  it("refuses every form of storing into a global in a body, for fn and arrow definitions (derived)", () => {
    const forms = ["a++", "a--", "++a", "--a", "a+=1", "a-=1", "a*=2", "a/=2", "a=<5", "a[1]:=x", "a:=1"];
    for (const f of forms) {
      for (const d of [`f(x):={ ${f}; return x; }`, `f:=x->{ ${f}; return x; }`, `f:=(x,y)->{ ${f}; return x; }`]) {
        expect(() => parseLibrary(`// pascaline library 1\n// d\n${d}\n`), d).toThrow(/the body assigns a, which is not local/);
      }
    }
    expect(() => parseLibrary("// pascaline library 1\n// d\ng(x):={ b[1]:=x; return x; }\n")).toThrow(/assigns b,/);
    expect(parseLibrary("// pascaline library 1\n// d\nf(x):={ local a,k; a++; a+=1; for (k:=1;k<3;k++) { a[1]:=k; } return x; }\n").defs).toHaveLength(1);
    expect(parseLibrary("// pascaline library 1\n// d\nf(x):={ x++; return \"a++\"; }\n").defs).toHaveLength(1);
  });
  it("refuses a test line that assigns anywhere, by := ++ -- op= or =< (derived)", () => {
    const lib = (t: string): string => `// pascaline library 1\n// d\nf(x):=x\n// test: ${t}\n`;
    for (const t of ["(a:=5)==5", "f(a++)==1", "f(--a)==1", "f(a+=1)==1", "f(a-=1)==1", "f(a*=2)==1", "f(a/=2)==1", "f(a=<5)==1", "f(a[1]:=2)==1"])
      expect(() => parseLibrary(lib(t)), t).toThrow(/line 4: a test must not assign/);
    expect(parseLibrary(lib('f(1)==1 && "a:=5"=="a:=5"')).defs[0]!.tests).toHaveLength(1);
    expect(parseLibrary(lib("f(1)<=1 and f(2)>=1")).defs[0]!.tests).toHaveLength(1);
  });
  it("takes CRLF and a BOM", () => {
    expect(parseLibrary("﻿// pascaline library 1\r\n// d\r\nf(x):=x\r\n").defs[0]!.name).toBe("f");
  });
});

describe.skipIf(!giacAvailable())("importLibrary (real Giac)", () => {
  let host: EngineHost;
  const fresh = async (): Promise<EngineHost> => new EngineHost((await loadNodeGiac()).giac);
  beforeAll(async () => {
    host = await fresh();
  });
  const ok = (r: ImportResult): Extract<ImportResult, { ok: true }> => {
    if (!r.ok) throw new Error(r.error);
    return r;
  };

  it("imports beams.txt with its descriptions and passes its tests (derived)", async () => {
    const h = await fresh();
    const r = ok(importLibrary(h, parseLibrary(file("beams.txt")), []));
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
    const a = importLibrary(await fresh(), parseLibrary(file("bad-builtin.txt")), []);
    expect(a).toMatchObject({ ok: false, line: 5, dirty: false });
    expect(!a.ok && a.error).toMatch(/Beta is a built-in/);
    const b = importLibrary(await fresh(), parseLibrary(file("bad-test.txt")), []);
    expect(b).toMatchObject({ ok: false, dirty: true, failures: [{ line: 6, expr: "sqq(3) == 10", got: "false" }] });
    expect(!b.ok && b.error).toBe("line 6: test failed: sqq(3) == 10 gave false");
  });

  it("reports every failing test, not only the first", async () => {
    const r = importLibrary(await fresh(), parseLibrary("// pascaline library 1\n// d\nf(x):=x\n// test: f(1) == 2\n// test: f(2) == 2\n// test: f(3) == 4\n"), []);
    expect(!r.ok && r.failures?.map((f) => f.line)).toEqual([4, 6]);
  });

  it("lists a clash with an own name and defines nothing; replaces on request (derived)", async () => {
    const h = await fresh();
    const mine = applyDefChanges([], h.cas("beam_M(q,L):=q*L", defaultCasSettings).defs);
    const lib = parseLibrary(file("beams.txt"));
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
    const lib = parseLibrary(file("beams.txt"));
    const first = ok(importLibrary(h, lib, []));
    const again = ok(importLibrary(h, lib, first.log));
    expect(again.plan).toEqual({ added: [], same: ["beam_M", "beam_w", "sumpow", "g0"], replaced: [] });
    expect(again.changes).toEqual([]);
  });

  it("refuses an import that would pass 500 definitions, with the numbers", async () => {
    const h = await fresh();
    const full: DefEntry[] = Array.from({ length: 500 }, (_, i) => ({ name: `v${i}`, kind: "var", cmds: [`v${i}:=(1)`], preview: "1", view: "home", time: 0 }));
    const r = importLibrary(h, parseLibrary("// pascaline library 1\n// d\nzz(x):=x\n"), full);
    expect(!r.ok && r.error).toMatch(/now 500, new 1/);
  });

  it("an export re-imports to the same log (derived)", async () => {
    const h = await fresh();
    const first = ok(importLibrary(h, parseLibrary(file("beams.txt")), []));
    const { text, skipped } = exportLibrary(first.log);
    expect(skipped).toEqual([]);
    const back = ok(importLibrary(await fresh(), parseLibrary(text), []));
    const core = (l: readonly DefEntry[]) => l.map((e) => ({ name: e.name, kind: e.kind, cmds: e.cmds, desc: e.desc }));
    expect(core(back.log)).toEqual(core(first.log));
    expect(exportLibrary(back.log).text).toBe(text);
  });

  it("export: typed definitions get a description, floats and assumptions are left out (derived)", async () => {
    const h = await fresh();
    let log: DefEntry[] = [];
    for (const s of ["beam(q,L):=q*L^2/8", "A:=5", "B:=A*2", "assume(x>0)"]) log = applyDefChanges(log, h.cas(s, defaultCasSettings).defs);
    const withFloat: DefEntry = { name: "C", kind: "var", cmds: ["C:=(1.5)"], preview: "1.5", view: "cas", time: 0, facts: { reliableDigits: 5 } };
    const { text, skipped } = exportLibrary([...log, withFloat]);
    expect(skipped.map((s) => s.name)).toEqual(["x", "C"]);
    expect(text).toContain("// beam(q,L)\nbeam(q,L):=q*L^2/8");
    expect(text).toContain("B:=(10)");
    const back = ok(importLibrary(await fresh(), parseLibrary(text), []));
    expect(back.log.map((e) => e.name)).toEqual(["beam", "A", "B"]);
  });

  it("200 library programs replay: prints the desktop median and the device estimate (a measurement, no assert)", { timeout: 60000 }, async () => {
    const h = await fresh();
    let text = "// pascaline library 1\n";
    for (let i = 1; i <= 200; i++) text += `\n// program ${i}\nlib${i}(a,b):={\n  local s,k;\n  s:=0;\n  for (k:=1;k<=b;k++) { s:=s+a^k/k; }\n  return s+${i};\n}\n`;
    const r = ok(importLibrary(h, parseLibrary(text), []));
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
