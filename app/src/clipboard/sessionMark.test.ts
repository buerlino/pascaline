// SPDX-License-Identifier: GPL-3.0-or-later
// R69 (hunt N5): the session line carries the mark the screen shows. Engine-made √2, π, ln 2 keep P + 2 digits and are
// confirmed to 38 or 39; the old digit rule wrote `⚠ 39` beside the screen's `≈`. Cases of home.yaml (oracle values).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "../engine/host.ts";
import { defaultHomeSettings } from "../engine/homeEval.ts";
import { giacAvailable, nodeHost } from "../engine/nodeGiac.ts";
import { sessionText, type CopySource } from "./text.ts";
import type { DisplayContext } from "../state/displayMode.ts";

const CTX: DisplayContext = { format: "std", digits: 12, fixDecimals: 4, angle: "rad" };

describe.skipIf(!giacAvailable())("Copy session on the real engine (R69)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    host = (await nodeHost());
  });
  const item = (latex: string, input: string): CopySource => {
    const r = host.home(input, { ...defaultHomeSettings, budgetSteps: 20 * defaultHomeSettings.budgetSteps }).result;
    if (!r.ok) throw new Error(`${input}: ${r.error}`);
    return { latex, status: "done", text: r.display, value: r.value, facts: r.facts, full: r.full };
  };
  it.each([
    ["\\sqrt{2}", "sqrt(2)", "sqrt(2) ≈ 1.4142135623730950488"],
    ["\\pi", "pi", "π ≈ 3.14159265358979323846"],
    ["\\ln 2", "ln(2)", "\\ln 2 ≈ 0.693147180559945309417"],
  ])("%s is ≈, not ⚠ n", (latex, input, start) => {
    const line = sessionText([item(latex, input)], {}, CTX);
    expect(line.startsWith(start.split(" ≈ ")[0] + " ≈ ")).toBe(true);
    expect(line).not.toContain("⚠");
    expect(line.split(" ≈ ")[1]!.startsWith(start.split(" ≈ ")[1]!.slice(0, 15))).toBe(true);
  });
});
