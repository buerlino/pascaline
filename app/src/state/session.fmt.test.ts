// SPDX-License-Identifier: GPL-3.0-or-later
// The Format key on a Session: it changes the last result only, persists, and uses the real engine for polar.
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../calc/fake.ts";
import type { Calc, CasOutcome, HomeOutcome } from "../calc/port.ts";
import { EngineHost } from "../engine/host.ts";
import { defaultHomeSettings, safePrecision } from "../engine/homeEval.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { Kv } from "./storage.ts";
import { Session } from "./session.svelte.ts";

function memoryKv(): Kv {
  const data = new Map<string, unknown>();
  return {
    get: <T>(k: string) => Promise.resolve(data.get(k) as T | undefined),
    set: (k, v) => (data.set(k, structuredClone(v)), Promise.resolve()),
  };
}

/** A Calc on the real Giac in this process: Home through EngineHost, CAS echoes its input. */
async function engineCalc(): Promise<Calc> {
  const host = new EngineHost((await loadNodeGiac()).giac);
  return Object.assign(new FakeCalc(), {
    ready: () => Promise.resolve(),
    cancel: () => Promise.resolve(),
    home: (giac: string, s: { digits: number; angle: "rad" | "deg" }): Promise<HomeOutcome> => {
      const r = host.home(giac, { ...defaultHomeSettings, digits: s.digits, angle: s.angle }).result;
      return Promise.resolve({
        ok: r.ok,
        display: r.display,
        approximate: r.approximate,
        ...safePrecision(r.display),
        ...(r.value ? { value: r.value } : {}),
        ...(r.exact ? { exact: r.exact } : {}),
      });
    },
    cas: (giac: string): Promise<CasOutcome> => Promise.resolve({ ok: true, text: giac, latex: giac }),
  });
}

const text = (s: Session, i = -1): string => s.display(s.home.at(i)!).text;

describe.skipIf(!giacAvailable())("Format key (real Giac)", () => {
  it("1/3 goes Standard, Scientific, Engineering and back; earlier results stay as they were", async () => {
    const s = new Session(await engineCalc(), memoryKv());
    await s.submit("\\frac12");
    await s.submit("\\frac13");
    expect(text(s)).toBe("0.333333333333");
    expect(await s.cycleFormat()).toBe(true);
    expect(text(s)).toBe("3.33333333333E-1");
    await s.cycleFormat();
    expect(text(s)).toBe("333.333333333E-3");
    await s.cycleFormat();
    expect(text(s)).toBe("0.333333333333");
    expect(text(s, 0)).toBe("0.5"); // only the last result moved
    expect(s.settings.format).toBe("std"); // and not the global setting
  });

  it("Fixed is a notation of the Format key; the fraction is a b/c's form (R10)", async () => {
    const s = new Session(await engineCalc(), memoryKv());
    s.setFmtMode("fix", true);
    await s.submit("\\frac73");
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      await s.cycleFormat();
      seen.push(text(s));
    }
    // from Standard: sci, eng, fix, std (derived: 7/3 = 2.3333…, exponent 0)
    expect(seen).toEqual(["2.33333333333E0", "2.33333333333E0", "2.3333", "2.33333333333"]);
    const forms: string[] = [];
    for (let i = 0; i < 2; i++) {
      await s.cycleForm();
      forms.push(text(s));
    }
    expect(forms).toEqual(["7/3", "2.33333333333"]);
    // the Format key leaves a form: back to the number in its notation
    await s.cycleForm();
    await s.cycleFormat();
    expect(text(s)).toBe("2.33333333333");
  });

  it("a b/c: 2.5 ↔ 5/2 (G2 item 29, device); a whole number has no other form", async () => {
    const s = new Session(await engineCalc(), memoryKv());
    await s.submit("\\frac52");
    expect(text(s)).toBe("2.5");
    expect(await s.cycleForm()).toBe(true);
    expect(text(s)).toBe("5/2");
    expect(await s.cycleForm()).toBe(true);
    expect(text(s)).toBe("2.5");
    await s.submit("2+3");
    expect(await s.cycleForm()).toBe(false);
    expect(text(s)).toBe("5");
  });

  it("a b/c in CAS: exact 5/2 → 2.5 → 5/2", async () => {
    const s = new Session(await engineCalc(), memoryKv());
    s.setView("cas");
    const cas = (x: Session): string => x.display(x.cas.at(-1)!).text;
    await s.submit("\\frac52");
    expect(cas(s)).toBe("5/2");
    await s.cycleForm();
    expect(cas(s)).toBe("2.5");
    await s.cycleForm();
    expect(cas(s)).toBe("5/2");
  });

  it("a b/c: polar for a complex result (engine abs and arg), and back to a+b*i", async () => {
    const s = new Session(await engineCalc(), memoryKv());
    await s.submit("3+4\\mathrm{i}", "3+4*i");
    expect(text(s)).toBe("3+4*i");
    await s.cycleForm(); // -> polar
    expect(text(s)).toBe("5∡0.927295218002"); // oracle: atan(4/3)
    await s.cycleForm(); // -> a+b*i
    expect(text(s)).toBe("3+4*i");
    s.setAngle("deg");
    await s.cycleForm(); // -> polar, now in degrees
    expect(text(s)).toBe("5∡53.1301023542"); // oracle: atan(4/3) in degrees
  });

  it("a unit imaginary part shows as i (regression: 1.73205080757+1*i)", async () => {
    const s = new Session(await engineCalc(), memoryKv());
    await s.submit("sqrt(3)+i", "sqrt(3)+i");
    expect(text(s)).toBe("1.73205080757+i");
  });

  it("the choice survives a reload with the history, and the ticked modes are stored", async () => {
    const kv = memoryKv();
    const a = new Session(await engineCalc(), kv);
    a.setFmtMode("eng", false);
    await a.submit("\\frac13");
    await a.cycleFormat();
    expect(text(a)).toBe("3.33333333333E-1");
    a.flushHistory();
    const b = new Session(await engineCalc(), kv);
    await b.restore();
    expect(b.settings.fmtCycle).toEqual(["std", "sci"]);
    expect(text(b)).toBe("3.33333333333E-1");
  });
});

describe("Format key (stub engine)", () => {
  it("does nothing when the last result is not a number, and in a CAS result that is symbolic", async () => {
    const s = new Session(new FakeCalc(), memoryKv());
    await s.submit("x");
    expect(await s.cycleFormat()).toBe(false);
    s.setView("cas");
    await s.submit("x");
    expect(await s.cycleFormat()).toBe(false);
  });

  it("a CAS number cycles from its exact form through the modes and returns to it", async () => {
    const s = new Session(new FakeCalc(), memoryKv());
    s.setView("cas");
    await s.submit("\\frac14", "1/4");
    const item = s.cas[0]!;
    const shown = (): string => s.display(item).text;
    expect(shown()).toBe("1/4");
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      await s.cycleFormat();
      seen.push(shown());
    }
    expect(seen).toEqual(["0.25", "2.50000000000E-1", "250.000000000E-3", "1/4"]);
  });

  it("settings: unticking everything keeps the default cycle; vibration settings are clamped and stored", async () => {
    const kv = memoryKv();
    const s = new Session(new FakeCalc(), kv);
    for (const m of ["std", "sci", "eng"] as const) s.setFmtMode(m, false);
    expect(s.settings.fmtCycle).toEqual(["std", "sci", "eng"]);
    expect(s.settings.haptics).toEqual({ on: false, strength: 50, ms: 15 });
    s.setHaptics({ on: true, strength: 500, ms: 1 });
    expect(s.settings.haptics).toEqual({ on: true, strength: 100, ms: 5 });
    s.setHaptics({ strength: 30, ms: 20 });
    const t = new Session(new FakeCalc(), kv);
    await t.restoreSettings();
    expect(t.settings.haptics).toEqual({ on: true, strength: 30, ms: 20 });
  });
});
