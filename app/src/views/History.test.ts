// SPDX-License-Identifier: GPL-3.0-or-later
// R133 (F172): while the engine starts, History draws only the newest 5 rows (the start pays for the rows drawn).
// Server-rendered, so the first paint of each engine state is seen without a DOM; the move from 5 to 20 a frame after
// ready (an effect), the scroll and the selection are in test/history-first.spec.ts.
import { describe, expect, it } from "vitest";
import { render } from "svelte/server";
import History from "./History.svelte";
import type { HistoryItem } from "../state/session.svelte.ts";

const items = (n: number): HistoryItem[] =>
  Array.from({ length: n }, (_, k) => ({
    id: k + 1,
    view: "home",
    latex: `${k}+1`,
    status: "done",
    resultLatex: String(k + 1),
    text: String(k + 1),
    approximate: false,
    startedAt: 0,
  }));

const draw = (n: number, engineState: "starting" | "ready" | "failed"): string[] => {
  const { body } = render(History, {
    props: {
      items: items(n),
      engineState,
      display: (i: HistoryItem) => ({ text: i.text, latex: i.resultLatex }),
      mark: () => null,
      onrecall: () => {},
      oninsert: () => {},
      onpick: () => {},
      oncancel: () => {},
    },
  });
  return [...body.matchAll(/<article[\s\S]*?<\/article>/g)].map((m) => m[0]);
};

describe("History rows drawn", () => {
  it("starting: the newest five, the newest last", () => {
    const rows = draw(200, "starting");
    expect(rows).toHaveLength(5);
    expect(rows[0]).toContain('data-latex="195+1"');
    expect(rows[4]).toContain('data-latex="199+1"');
  });
  it("ready or failed: the page of 20", () => {
    expect(draw(200, "ready")).toHaveLength(20);
    expect(draw(200, "failed")).toHaveLength(20);
  });
  it("fewer rows than five are all drawn", () => {
    expect(draw(3, "starting")).toHaveLength(3);
  });
});
