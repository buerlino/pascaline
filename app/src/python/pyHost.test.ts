// SPDX-License-Identifier: GPL-3.0-or-later
import { beforeAll, describe, expect, it } from "vitest";
import { loadNodePyHost, micropythonAvailable } from "./nodePython.ts";
import { parsePyException, type PyHost } from "./pyHost.ts";
import type { PyOutput } from "./types.ts";

describe("parsePyException", () => {
  it("keeps the user's frames and finds the innermost user line", () => {
    const raw =
      'NameError\x04Traceback (most recent call last):\n  File "<stdin>", line 1, in <module>\n  File "/lib/_pl.py", line 14, in run\n' +
      '  File "<script>", line 4, in <module>\n  File "<script>", line 2, in f\nNameError: name \'q\' isn\'t defined\n';
    const e = parsePyException(raw, "<script>");
    expect(e).toMatchObject({ type: "NameError", message: "name 'q' isn't defined", line: 2, file: "<script>" });
    expect(e.traceback).not.toContain("_pl.py");
    expect(e.traceback).not.toContain("<stdin>");
  });
});

describe.skipIf(!micropythonAvailable())("PyHost (real MicroPython)", () => {
  let py: PyHost;
  const out: PyOutput[] = [];
  const calls: [string, unknown[]][] = [];
  const text = (s: "stdout" | "stderr") => out.filter((o) => o.stream === s).map((o) => o.text).join("");

  beforeAll(async () => {
    py = await loadNodePyHost({
      output: (o) => out.push(o),
      hostCall: async (fn, args) => {
        calls.push([fn, args]);
        if (fn === "cas" && args[0] === "bad(") throw new Error("syntax error");
        return `cas:${String(args[0])}`;
      },
    });
  });

  const fresh = () => {
    out.length = 0;
    calls.length = 0;
  };

  it("print(1+1) gives 2", async () => {
    fresh();
    expect((await py.run("print(1+1)")).ok).toBe(true);
    expect(text("stdout")).toBe("2\n");
  });

  it("an error carries its type, message and the user's line number", async () => {
    fresh();
    const r = await py.run("a = 1\n\ndef f():\n    return a / 0\nf()\n", "main.py");
    expect(r.ok).toBe(false);
    expect(r.error).toMatchObject({ type: "ZeroDivisionError", message: "divide by zero", line: 4, file: "main.py" });
    expect(text("stderr")).toContain('File "main.py", line 4');
    expect(text("stderr")).not.toContain("_pl.py");
  });

  it("a syntax error has its line", async () => {
    fresh();
    const r = await py.run("x = 1\ny = (\n");
    expect(r.error?.type).toBe("SyntaxError");
    expect(r.error?.line).toBeGreaterThanOrEqual(2);
  });

  it("run starts with fresh globals; the shell then sees the script's names", async () => {
    fresh();
    await py.shell("leftover = 5");
    await py.run("k = 7");
    const r = await py.shell("leftover");
    expect(r.error?.type).toBe("NameError");
    fresh();
    await py.shell("k * 6");
    expect(text("stdout")).toBe("42\n");
  });

  it("the shell echoes expressions, not statements, and takes whole blocks", async () => {
    fresh();
    await py.shell("z = 3");
    await py.shell("def sq(v):\n    return v * v\n");
    await py.shell("sq(z)");
    await py.shell("None");
    expect(text("stdout")).toBe("9\n");
  });

  it("calc.cas is a plain synchronous call, also inside functions", async () => {
    fresh();
    const r = await py.run('import calc\ndef g(e):\n    return calc.cas(e)\nprint(g("factor(x^2-1)"), [calc.cas(i) for i in range(2)])\n');
    expect(r.ok).toBe(true);
    expect(text("stdout")).toBe("cas:factor(x^2-1) ['cas:0', 'cas:1']\n");
    expect(calls.map((c) => c[0])).toEqual(["cas", "cas", "cas"]);
  });

  it("a failing host call raises in Python at the user's line", async () => {
    fresh();
    const r = await py.run('import calc\n\ncalc.cas("bad(")\n');
    expect(r.error).toMatchObject({ type: "ValueError", message: "syntax error", line: 3 });
  });

  it("allocation-heavy loops survive garbage collection", async () => {
    fresh();
    const r = await py.run("l = []\nfor i in range(30000):\n    l.append(str(i) * 3)\ns = 0.0\nfor i in range(100000):\n    s += i * 0.5\nprint(len(l), s)\n");
    expect(r.ok).toBe(true);
    expect(text("stdout")).toBe("30000 2499975000.0\n");
  });

  it("host calls and GC deep in recursion work", async () => {
    fresh();
    const ok = await py.run('import calc\ndef r(n):\n    if n == 0:\n        x = [str(i) for i in range(20000)]\n        return calc.cas("deep")\n    return r(n - 1)\nprint(r(30))\n');
    expect(ok.ok).toBe(true);
    expect(text("stdout")).toBe("cas:deep\n");
  });

  it("runaway recursion is an error and marks the runtime for replacement", async () => {
    const py2 = await loadNodePyHost({ output: () => {}, hostCall: async () => 0 });
    const bad = await py2.run("def r(n):\n    return r(n + 1)\nr(0)\n");
    expect(bad.ok).toBe(false);
    expect(["RecursionError", "RuntimeError"]).toContain(bad.error?.type);
  });

  it("output printed before a host call arrives before it", async () => {
    fresh();
    let seen = "";
    const order: string[] = [];
    const py2 = await loadNodePyHost({
      output: (o) => (seen += o.text),
      hostCall: async () => {
        order.push(seen);
        return 0;
      },
    });
    await py2.run('import calc\nprint("before")\ncalc.cas("1")\n');
    expect(order).toEqual(["before\n"]);
  });

  it("sys.exit() is not an error", async () => {
    fresh();
    expect((await py.run("import sys\nprint(1)\nsys.exit()\nprint(2)\n")).ok).toBe(true);
    expect(text("stdout")).toBe("1\n");
  });
});
