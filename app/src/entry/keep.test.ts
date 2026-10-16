// SPDX-License-Identifier: GPL-3.0-or-later
// R34 (F30): the entry line kept across a kill. What is stored on hide, what comes back at start, and the keeper
// that writes it (only when something changed) and clears it.
import { describe, expect, it } from "vitest";
import { latexToGiac } from "../input/latex-to-giac.ts";
import type { Kv } from "../state/storage.ts";
import { LINE_KEY, lineKeeper, lineRecord } from "./keep.ts";
import { keptLine } from "./kept.ts";

const half = { value: "1/2", exact: true };

describe("lineRecord", () => {
  it("keeps the view, the LaTeX and the chips", () => {
    expect(lineRecord("cas", "\\res{2}{0.5}+1", { "res:2": half })).toEqual({ view: "cas", latex: "\\res{2}{0.5}+1", chips: { "res:2": half } });
  });
  it("is null for an empty line", () => {
    expect(lineRecord("home", "", { "res:1": half })).toBeNull();
  });
});

describe("keptLine", () => {
  it("reads back what lineRecord stored", () => {
    const rec = lineRecord("home", "\\frac{1}{3}\\times\\res{4}{0.5}\\ans", { "res:4": half });
    expect(keptLine(rec, "home")).toEqual(rec);
    expect(keptLine(rec, "cas")).toBeUndefined();
  });
  it("drops anything that is not a line", () => {
    for (const x of [undefined, null, 3, "1+2", {}, { view: "plot", latex: "1", chips: {} }, { view: "home", latex: "" }, { view: "home", latex: 7 }])
      expect(keptLine(x, "home")).toBeUndefined();
  });
  it("turns a result chip without a value into the digits it showed, and drops a constant chip without one", () => {
    const l = keptLine({ view: "home", latex: "\\res{7}{\\frac{1}{3}}+2\\const{c}{c}+\\res{8}{2}", chips: { "res:8": half } }, "home");
    expect(l).toEqual({ view: "home", latex: "\\frac{1}{3}+2+\\res{8}{2}", chips: { "res:8": half } });
    // still parseable: the line goes to Giac with the chip that kept its value
    expect(latexToGiac(l?.latex ?? "", { chips: l?.chips ?? {} })).toBe("1/3+2+(1/2)");
  });
  it("brackets a shown sum that loses its chip, so it stays one term", () => {
    expect(keptLine({ view: "cas", latex: "2\\res{1}{x+1}", chips: {} }, "cas")?.latex).toBe("2\\left(x+1\\right)");
  });
  it("keeps malformed chip entries out of the table", () => {
    expect(keptLine({ view: "home", latex: "\\res{1}{3}", chips: { "res:1": { value: 3 } } }, "home")?.latex).toBe("3");
  });
});

/** An in-memory store that counts its writes. */
function memKv(): Kv & { data: Map<string, unknown>; writes: number } {
  const data = new Map<string, unknown>();
  return {
    data,
    writes: 0,
    get: <T>(k: string) => Promise.resolve(data.get(k) as T | undefined),
    set(k: string, v: unknown) {
      this.writes++;
      data.set(k, v);
      return Promise.resolve();
    },
  };
}

describe("lineKeeper", () => {
  it("stores a line, clears it, and writes nothing when there is nothing to clear", async () => {
    const kv = memKv();
    const keeper = lineKeeper(kv);
    expect(await keeper.read("home")).toBeUndefined();
    keeper.save(null); // an empty line at the first hide: no write
    keeper.save(null);
    expect(kv.writes).toBe(0);
    keeper.save(lineRecord("home", "1+", {}));
    expect(await lineKeeper(kv).read("home")).toEqual({ view: "home", latex: "1+", chips: {} });
    keeper.save(null); // Enter
    expect(kv.data.get(LINE_KEY)).toBeNull();
    keeper.save(null);
    expect(kv.writes).toBe(2);
  });
  it("clears a line read at start once the line is empty", async () => {
    const kv = memKv();
    kv.data.set(LINE_KEY, lineRecord("cas", "x", {}));
    const keeper = lineKeeper(kv);
    expect(await keeper.read("home")).toBeUndefined(); // a CAS line, not for Home
    expect((await keeper.read("cas"))?.latex).toBe("x");
    keeper.save(null);
    expect(kv.data.get(LINE_KEY)).toBeNull();
  });
});
