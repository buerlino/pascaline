// SPDX-License-Identifier: GPL-3.0-or-later
import { beforeAll, describe, expect, it } from "vitest";
import { giacAvailable } from "../engine/nodeGiac.ts";
import { defaultHomeSettings } from "../engine/homeEval.ts";
import type { EngineHost } from "../engine/host.ts";
import { createCalcHost, parseGiacNumeric } from "./calcHost.ts";
import { loadNodeMath } from "./nodeMath.ts";
import { loadNodePyHost, micropythonAvailable } from "./nodePython.ts";
import type { PyHost } from "./pyHost.ts";

describe("parseGiacNumeric (derived: Giac's printed forms)", () => {
  it.each([
    ["0.33333333333333333", { f: "0.33333333333333333" }],
    ["-0.12676506002282294e31", { f: "-0.12676506002282294e31" }],
    ["1e+20", { f: "1e+20" }],
    ["infinity", { f: "inf" }],
    ["-infinity", { f: "-inf" }],
    ["1.0000000000000000+2.0000000000000000*i", { c: ["1.0000000000000000", "+2.0000000000000000"] }],
    ["1.0-2.0*i", { c: ["1.0", "-2.0"] }],
    ["-2.0000000000000000*i", { c: ["0", "-2.0000000000000000"] }],
    ["0.99999999999999890e-7+0.10000000000000000e11*i", { c: ["0.99999999999999890e-7", "+0.10000000000000000e11"] }],
    ["i", { c: ["0", "1"] }],
    ["[[1.0,2.0],[3.0,1.5]]", [[{ f: "1.0" }, { f: "2.0" }], [{ f: "3.0" }, { f: "1.5" }]]],
    ["[]", []],
  ])("%s", (text, value) => {
    expect(parseGiacNumeric(text)).toEqual(value);
  });
  it.each(["undef", "1.0+x", "x", '"a"', "[1.0,x]", "sqrt(2)"])("%s is not numeric", (text) => {
    expect(parseGiacNumeric(text)).toBeUndefined();
  });
});

describe.skipIf(!giacAvailable() || !micropythonAvailable())("calc module (real Giac + MicroPython)", () => {
  let py: PyHost;
  let host: EngineHost;
  let out = "";
  const run = async (src: string) => {
    out = "";
    const r = await py.run(src);
    return { ...r, out };
  };

  beforeAll(async () => {
    const m = await loadNodeMath();
    host = m.host;
    const calc = createCalcHost(m.math);
    py = await loadNodePyHost({ output: (o) => (out += o.text), hostCall: calc });
  });

  it('calc.cas("factor(x^2-1)") -> (x-1)*(x+1) (oracle: x^2-1 = (x-1)(x+1))', async () => {
    const r = await run('import calc\nprint(calc.cas("factor(x^2-1)"))\n');
    expect(r.out).toBe("(x-1)*(x+1)\n");
  });

  it("calc.eval gives Python numbers (derived: docs/04 2.10, an exact integer stays int)", async () => {
    const r = await run('import calc\nprint(repr(calc.eval("2^70")), repr(calc.eval("7/2")), calc.eval("sqrt(-4)"), calc.eval("[1,1/2]"), calc.eval("x+1"))\n');
    expect(r.out).toBe("1180591620717411303424 3.5 2j [1, 0.5] x+1\n");
  });

  it("calc.eval is exact-first like Home: 1-0.9-0.1 is 0, and Home's Ans is untouched (derived, docs/04 2.3 #7)", async () => {
    host.home("41", defaultHomeSettings);
    const r = await run('import calc\nprint(repr(calc.eval("1-0.9-0.1")), repr(calc.eval("[[1,2],[3,4]]^-1")))\n');
    expect(r.out).toBe("0 [[-2, 1], [1.5, -0.5]]\n");
    expect(host.home("pasans+1", defaultHomeSettings).result.display).toBe("42");
  });

  it("a variable set in Home is read from Python (derived)", async () => {
    host.home("A:=1/4", defaultHomeSettings);
    const r = await run('import calc\nprint(calc.get("A"), calc.get("A") * 4)\n');
    expect(r.out).toBe("0.25 1.0\n");
  });

  it("a value written by Python is seen in Home (derived)", async () => {
    await run('import calc\ncalc.set("B", 2.5)\ncalc.set("C", 3)\ncalc.set("F", "x^2+1")\n');
    expect(host.home("B*C", defaultHomeSettings).result.display).toBe("7.5");
    expect(host.cas("F", { angle: "rad", digits: 12, hardTimeoutS: 600, powLimit: 1e8 }).result.text).toBe("x^2+1");
  });

  it("unset names, bad names and bad values raise the right exceptions", async () => {
    const r1 = await run('import calc\ncalc.set("Q", None)\ncalc.get("Q")\n');
    expect(r1.error).toMatchObject({ type: "NameError", line: 3 });
    const r2 = await run('import calc\ncalc.get("1x")\n');
    expect(r2.error?.type).toBe("ValueError");
    const r3 = await run('import calc\ncalc.set("Z", {})\n');
    expect(r3.error?.type).toBe("TypeError");
    const r4 = await run('import calc\ncalc.cas("factor(")\n');
    expect(r4.error?.type).toBe("ValueError");
  });
});
