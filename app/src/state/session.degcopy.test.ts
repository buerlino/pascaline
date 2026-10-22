// SPDX-License-Identifier: GPL-3.0-or-later
// G46f1 (real Giac): in DEG the CAS copy gives the text drawn; chips and Ans keep the radian text. RAD is unchanged.
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { Calc, CasOutcome, HomeOutcome } from "../calc/port.ts";
import { copyExact, copyFull } from "../clipboard/text.ts";
import { EngineHost } from "../engine/host.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import { defaultHomeSettings } from "../engine/homeEval.ts";
import { defaultCasSettings } from "../engine/types.ts";
import type { Kv } from "./storage.ts";
import { Session } from "./session.svelte.ts";

function memoryKv(): Kv {
  const data = new Map<string, unknown>();
  return {
    get: <T>(k: string) => Promise.resolve(data.get(k) as T | undefined),
    set: (k, v) => (data.set(k, structuredClone(v)), Promise.resolve()),
  };
}

async function engineCalc(): Promise<Calc> {
  const host = new EngineHost((await loadNodeGiac()).giac);
  return Object.assign(new FakeCalc(), {
    ready: () => Promise.resolve(),
    cancel: () => Promise.resolve(),
    home: (giac: string, s: { digits: number; angle: "rad" | "deg" }): Promise<HomeOutcome> => {
      const r = host.home(giac, { ...defaultHomeSettings, digits: s.digits, angle: s.angle }).result;
      return Promise.resolve({ ok: r.ok, display: r.display, approximate: r.approximate, facts: r.facts, full: r.full, ...(r.value ? { value: r.value } : {}) });
    },
    cas: (giac: string, s: { digits: number; angle: "rad" | "deg" }): Promise<CasOutcome> => {
      const r = host.cas(giac, { ...defaultCasSettings, digits: s.digits, angle: s.angle }).result;
      return Promise.resolve({ ok: r.ok, text: r.text, latex: r.latex, facts: r.facts, ...(r.full !== undefined ? { full: r.full } : {}) });
    },
  });
}

describe.skipIf(!giacAvailable())("DEG copy is the text drawn (real Giac)", () => {
  const run = async (angle: "rad" | "deg", input: string, view: "home" | "cas" = "cas") => {
    const s = new Session(await engineCalc(), memoryKv());
    s.setAngle(angle);
    s.setView(view);
    await s.submit(input, input);
    return { s, item: (view === "cas" ? s.cas : s.home).at(-1)! };
  };
  it("int(1/(1+x^2),x): drawn 1/180*pi*atan(x), chip atan(x)", async () => {
    const { s, item } = await run("deg", "int(1/(1+x^2),x)");
    expect(item.text).toBe("1/180*pi*atan(x)");
    expect(copyFull(item)).toBe("1/180*pi*atan(x)");
    expect(copyExact(item)).toBe("1/180*pi*atan(x)");
    expect(s.chipFor(item)?.value).toBe("atan(x)");
  });
  it("diff(sin(pasdeg*x),x): drawn pi/180*cos(x), chip keeps the radian text", async () => {
    const { s, item } = await run("deg", "diff(sin(pasdeg*x),x)");
    expect(item.text).toBe("pi/180*cos(x)");
    expect(copyFull(item)).toBe("pi/180*cos(x)");
    expect(copyExact(item)).toBe("pi/180*cos(x)");
    expect(s.chipFor(item)?.value).toBe("pi/180*cos(pi/180*x)");
  });
  it("RAD: the copy is the engine text", async () => {
    const { item } = await run("rad", "int(1/(1+x^2),x)");
    expect(item.drawn).toBeUndefined();
    expect(copyFull(item)).toBe("atan(x)");
  });
  it("Home in DEG: diff(sin(pasdeg*x),x) copies pi/180*cos(x), chip keeps the radian text", async () => {
    const { s, item } = await run("deg", "diff(sin(pasdeg*x),x)", "home");
    expect(item.text).toBe("pi/180*cos(x)");
    expect(copyFull(item)).toBe("pi/180*cos(x)");
    expect(copyExact(item)).toBe("pi/180*cos(x)");
    expect(s.chipFor(item)?.value).toBe("pi/180*cos(pi/180*x)");
  });
  it("Home in RAD: drawn stays undefined", async () => {
    const { item } = await run("rad", "diff(sin(x),x)", "home");
    expect(item.drawn).toBeUndefined();
  });
});
