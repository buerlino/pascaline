// SPDX-License-Identifier: GPL-3.0-or-later
// R99f1: Enter on an empty Num entry line is not a value: no notice, start and step stay (as Solve's Num, R76f1).
// A line with text that is not a number keeps its notice, and a step of 0 its own.
import { describe, expect, it, vi } from "vitest";
import type { AppHost } from "../types.ts";
// the app imports the page brightness, which reads the document
vi.mock("../../theme.svelte.ts", () => ({ brightness: () => "dark" }));
import { FunctionApp } from "./app.svelte.ts";

const make = (): { app: FunctionApp; notices: string[] } => {
  const notices: string[] = [];
  const h = {
    settings: { digits: 12, angle: "rad", format: "std" },
    calc: { ready: async () => undefined },
    kv: { get: async () => undefined, set: async () => undefined },
    userNames: [],
    setEntry: () => undefined,
    copy: () => undefined,
    notice: (s: string) => void notices.push(s),
  };
  return { app: new FunctionApp(h as unknown as AppHost), notices };
};

describe("R99f1: Function's Num entry", () => {
  it("an empty line calls no notice and changes neither start nor step", () => {
    const { app, notices } = make();
    app.num.start = "2";
    app.num.step = "0.5";
    for (const edit of ["start", "step"] as const) {
      app.num.edit = edit;
      app.enter("num", "");
      expect(app.num.edit).toBe(edit);
    }
    expect(notices).toEqual([]);
    expect([app.num.start, app.num.step]).toEqual(["2", "0.5"]);
  });
  it("text that is not a number keeps the notice; a step of 0 its own", () => {
    const { app, notices } = make();
    app.num.edit = "start";
    app.enter("num", "x");
    expect(notices).toHaveLength(1);
    app.num.edit = "step";
    app.enter("num", "0");
    expect(notices).toHaveLength(2);
    expect(notices[1]).not.toBe(notices[0]);
  });
});
