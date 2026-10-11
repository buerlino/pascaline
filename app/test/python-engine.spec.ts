// SPDX-License-Identifier: GPL-3.0-or-later
// The Python worker in a real browser (no UI): load, output, errors, calc through the host, Cancel.
import { expect, test } from "@playwright/test";

test("python engine: run, error line, calc, cancel an endless loop, graphics", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const url = "/src/python/pythonEngine.ts";
    const mod = (await import(/* @vite-ignore */ url)) as typeof import("../src/python/pythonEngine.ts");
    const out: string[] = [];
    const math = {} as Parameters<typeof mod.loadPythonEngine>[0];
    const py = mod.loadPythonEngine(math, { host: async (fn, args) => `${fn}:${String(args[0])}` });
    py.onOutput((o) => out.push(`${o.stream}:${o.text}`));
    const gfx: unknown[][] = [];
    py.onGraphics((b) => gfx.push(...b));
    const t = await py.ready();
    const ok = await py.run("print(1+1)");
    const err = await py.run("x = 1\nprint(x / 0)\n", { file: "main.py" });
    await py.shell("import calc");
    const calc = await py.shell('calc.cas("factor(x^2-1)")');
    const t0 = performance.now();
    await py.run("n = 0\nfor i in range(1000000):\n    n = (n + i) & 1023\n");
    const loopMs = performance.now() - t0;
    const endless = py.run("while True: pass").then(
      () => "finished",
      (e: Error) => e.name,
    );
    await new Promise((res) => setTimeout(res, 300));
    const c0 = performance.now();
    const ct = await py.cancel();
    const cancelMs = performance.now() - c0;
    const after = await py.run("print(1)");
    await py.run("import draw\ndraw.line(0, 0, 319, 239, 0xFF0000)\ndraw.circle(160, 120, 50, 0x0000FF)\n");
    const drawn = gfx.slice();
    const g0 = performance.now();
    await py.run("import draw\nfor i in range(10000):\n    draw.pixel(i % 320, i // 320)\n");
    const pixelsMs = performance.now() - g0;
    py.dispose();
    return { t, ok: ok.ok, err: err.error, calc: calc.ok, out, endless: await endless, after: after.ok, cancelMs, ct, loopMs, drawn, pixels: gfx.length - drawn.length, pixelsMs };
  });
  console.log(`python: ready ${r.t.readyMs.toFixed(0)} ms (load ${r.t.loadMs.toFixed(0)}), cancel->ready ${r.cancelMs.toFixed(0)} ms, 1e6-iteration loop ${r.loopMs.toFixed(0)} ms, 1e4 pixels ${r.pixelsMs.toFixed(0)} ms`);
  expect(r.ok).toBe(true);
  expect(r.err).toMatchObject({ type: "ZeroDivisionError", line: 2, file: "main.py" });
  expect(r.calc).toBe(true);
  expect(r.out).toContain("stdout:2\n");
  expect(r.out.join("")).toContain("stdout:'cas:factor(x^2-1)'\n");
  expect(r.endless).toBe("PythonCancelled");
  expect(r.after).toBe(true);
  expect(r.drawn).toEqual([
    ["line", 0, 0, 319, 239, 0xff0000],
    ["circle", 160, 120, 50, 0x0000ff],
  ]);
  expect(r.pixels).toBe(10000);
  expect(r.out.at(-1)).toBe("stdout:1\n");
});
