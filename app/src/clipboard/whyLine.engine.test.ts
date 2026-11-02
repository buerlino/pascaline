// SPDX-License-Identifier: GPL-3.0-or-later
// R36f1: the picked row's line from the engine's own facts. Home keeps an exact value exact (docs/04 6.2, 2.8), so B
// stored from 1/3 lends no facts and B+1 is 4/3 shown rounded (source: derived, 1/3 + 1 = 4/3); B stored from a float
// (evalf(√2)) lends its facts, so B+1 uses B, itself rounded. √2·1.0 is exact in Home (1.0 is an exact decimal; the log
// holds B:=(sqrt(2))), so its B+1 does not name B. The texts are the package's.
import { beforeEach, describe, expect, it } from "vitest";
import type { EngineHost } from "../engine/host.ts";
import { defaultHomeSettings, precisionFacts, type HomeResult } from "../engine/homeEval.ts";
import { markOf } from "../engine/format.ts";
import { giacAvailable, nodeHost } from "../engine/nodeGiac.ts";
import { homeItem } from "../state/results.ts";
import type { HistoryItem } from "../state/session.svelte.ts";
import { whyLine } from "./whyLine.ts";

describe.skipIf(!giacAvailable())("R36f1: the stored names behind ≈ come from the engine", () => {
  let host: EngineHost;
  let id = 0;
  /** Run `input` on Home and give the line its picked row would show. */
  const row = (input: string): string | null => {
    const r: HomeResult = host.home(input, defaultHomeSettings).result;
    const item = { id: ++id, latex: input, status: "done", resultLatex: "", text: r.display, startedAt: 0, ...homeItem(r, false) } as HistoryItem;
    return whyLine(item, markOf(precisionFacts(r), { format: "STD", digits: 12 }), 12);
  };
  beforeEach(async () => {
    host = await nodeHost();
  });

  it("Home 1/3 stored to B, then B+1: rounded, the exact value is 4/3", () => {
    row("B:=1/3");
    expect(row("B+1")).toBe("≈ rounded: the exact value is 4/3");
  });

  it("a float stored to B (evalf(√2)), then B+1: uses B, itself rounded", () => {
    row("B:=evalf(sqrt(2))");
    expect(row("B+1")).toBe("≈ uses B, itself rounded");
  });

  it("√2·1.0 stored to B is exact in Home: B+1 does not say B is rounded", () => {
    row("B:=sqrt(2)*1.0");
    const line = row("B+1");
    expect(line).toMatch(/^≈ rounded/);
    expect(line).not.toContain("uses B");
  });

  it("the row that stores B does not name B, nor does an earlier row after B is overwritten", () => {
    row("B:=1/3");
    const before = row("B+1");
    expect(row("B:=evalf(sqrt(2))")).not.toContain("uses B");
    expect(before).toBe("≈ rounded: the exact value is 4/3");
  });
});
