// SPDX-License-Identifier: GPL-3.0-or-later
// R34 (F30): the entry line kept across a kill. What is stored on hide, what comes back at start, and the keeper
// that writes it (only when something changed) and clears it.
import { describe, expect, it } from "vitest";
import { latexToGiac } from "../input/latex-to-giac.ts";
import type { Kv } from "../state/storage.ts";
import { LINE_KEY, LineKeeper, keptLine, lineRecord } from "./keep.ts";

const half = { value: "1/2", exact: true };

describe("lineRecord", () => {
  it("keeps the view, the LaTeX and only the chips on the line", () => {
    expect(lineRecord("cas", "\\res{2}{0.5}+1", { "res:1": half, "res:2": half, ans: half })).toEqual({
      view: "cas",
      latex: "\\res{2}{0.5}+1",
      chips: { "res:2": half },
    });
  });
  it("is null for an empty line", () => {
    expect(lineRecord("home", "", { "res:1": half })).toBeNull();
  });
});

describe("keptLine", () => {
  it("reads back what lineRecord stored", () => {
    const rec = lineRecord("home", "\\frac{1}{3}\\times\\res{4}{0.5}\\ans", { "res:4": half });
    expect(keptLine(rec)).toEqual(rec);
  });
  it("drops anything that is not a line", () => {
    for (const x of [undefined, null, 3, "1+2", {}, { view: "plot", latex: "1", chips: {} }, { view: "home", latex: "" }, { view: "home", latex: 7 }])
      expect(keptLine(x)).toBeUndefined();
  });
  it("turns a result chip without a value into the digits it showed, and drops a constant chip without one", () => {
    const l = keptLine({ view: "home", latex: "\\res{7}{\\frac{1}{3}}+2\\const{c}{c}+\\res{8}{2}", chips: { "res:8": half } });
    expect(l).toEqual({ view: "home", latex: "\\frac{1}{3}+2+\\res{8}{2}", chips: { "res:8": half } });
    // still parseable: the line goes to Giac with the chip that kept its value
    expect(latexToGiac(l?.latex ?? "", { chips: l?.chips ?? {} })).toBe("1/3+2+(1/2)");
  });
  it("brackets a shown sum that loses its chip, so it stays one term", () => {
    expect(keptLine({ view: "cas", latex: "2\\res{1}{x+1}", chips: {} })?.latex).toBe("2\\left(x+1\\right)");
  });
  it("keeps malformed chip entries out of the table", () => {
    expect(keptLine({ view: "home", latex: "\\res{1}{3}", chips: { "res:1": { value: 3 } } })?.latex).toBe("3");
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

describe("LineKeeper", () => {
  it("stores a line, clears it, and writes nothing when there is nothing to clear", async () => {
    const kv = memKv();
    const keeper = new LineKeeper(kv);
    expect(await keeper.read()).toBeUndefined();
    keeper.save(null); // an empty line at the first hide: no write
    keeper.drop();
    expect(kv.writes).toBe(0);
    keeper.save(lineRecord("home", "1+", {}));
    expect(await new LineKeeper(kv).read()).toEqual({ view: "home", latex: "1+", chips: {} });
    keeper.drop(); // Enter
    expect(kv.data.get(LINE_KEY)).toBeNull();
    keeper.drop();
    expect(kv.writes).toBe(2);
  });
  it("clears a line read at start once the line is empty", async () => {
    const kv = memKv();
    kv.data.set(LINE_KEY, lineRecord("cas", "x", {}));
    const keeper = new LineKeeper(kv);
    expect((await keeper.read())?.latex).toBe("x");
    keeper.drop();
    expect(kv.data.get(LINE_KEY)).toBeNull();
  });
});
