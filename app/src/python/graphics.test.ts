// SPDX-License-Identifier: GPL-3.0-or-later
// Graphics command stream (derived: each call maps to one documented GfxCmd).
import { beforeAll, describe, expect, it } from "vitest";
import { loadNodePyHost, micropythonAvailable } from "./nodePython.ts";
import { GFX_BATCH, type PyHost } from "./pyHost.ts";
import type { GfxCmd } from "./types.ts";

describe.skipIf(!micropythonAvailable())("graphics modules (real MicroPython)", () => {
  let py: PyHost;
  const batches: GfxCmd[][] = [];
  const all = () => batches.flat();

  beforeAll(async () => {
    py = await loadNodePyHost({ output: () => {}, hostCall: async () => "ok", graphics: (b) => batches.push(b) });
  });

  it("draw: a line and a circle, plus every other command", async () => {
    batches.length = 0;
    const r = await py.run(
      "import draw\ndraw.clear()\ndraw.line(0, 0, 319, 239, draw.RED)\ndraw.circle(160, 120, 50.6, draw.rgb(0, 0, 255))\n" +
        'draw.pixel(1, 2)\ndraw.rect(10, 10, 20, 30, 0x123456)\ndraw.fill_rect(5, 5, 2, 2, -1)\ndraw.fill_circle(3, 4, 5)\ndraw.text(7, 8, 42, 0, "large")\ndraw.show()\n',
    );
    expect(r.ok).toBe(true);
    expect(all()).toEqual([
      ["clear", 0xffffff],
      ["line", 0, 0, 319, 239, 0xff0000],
      ["circle", 160, 120, 51, 0x0000ff],
      ["pixel", 1, 2, 0],
      ["rect", 10, 10, 20, 30, 0x123456],
      ["fillrect", 5, 5, 2, 2, 0xffffff],
      ["fillcircle", 3, 4, 5, 0],
      ["text", 7, 8, "42", 0, "large"],
      ["show"],
    ]);
  });

  it("commands go out in batches of at most GFX_BATCH, and all arrive by the end of the run", async () => {
    batches.length = 0;
    await py.run("import draw\nfor i in range(1000):\n    draw.pixel(i % 320, i // 320)\n");
    expect(all()).toHaveLength(1000);
    expect(Math.max(...batches.map((b) => b.length))).toBeLessThanOrEqual(GFX_BATCH);
  });

  it("bad arguments raise at the user's line", async () => {
    const r = await py.run('import draw\n\ndraw.text(0, 0, "a", 0, "huge")\n');
    expect(r.error).toMatchObject({ type: "ValueError", line: 3 });
    const r2 = await py.run('import draw\ndraw.line(0, 0, "a", 1)\n');
    expect(r2.error).toMatchObject({ line: 2 });
  });

  it("compatibility module (assumed API, G2 items 26-28) maps onto the same commands", async () => {
    batches.length = 0;
    const r = await py.run("import hpprime as h\nh.pixon(0, 1, 1, 255)\nh.line(0, 0, 0, 9, 9, 0)\nh.fillrect(0, 1, 2, 3, 4, 5, 6)\nh.circle(0, 5, 5, 2, 7)\nh.textout(0, 1, 1, 'hi', 8)\n");
    expect(r.ok).toBe(true);
    expect(all()).toEqual([
      ["pixel", 1, 1, 255],
      ["line", 0, 0, 9, 9, 0],
      ["fillrect", 1, 2, 3, 4, 6],
      ["rect", 1, 2, 3, 4, 5],
      ["circle", 5, 5, 2, 7],
      ["text", 1, 1, "hi", 8, "medium"],
    ]);
    const bad = await py.run("import hpprime\nhpprime.pixon(1, 0, 0)\n");
    expect(bad.error).toMatchObject({ type: "ValueError", line: 2 });
  });
});
