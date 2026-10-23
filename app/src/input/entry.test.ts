// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { giacOfEntry } from "./entry.ts";
import { homeLatexStep } from "../goldenRun.ts";
import type { ChipTable } from "./chips.ts";

describe("G98: the golden runner sends a Home latex entry as the session does", () => {
  const chips: ChipTable = { "res:1": { value: "0.333333333333", exact: false } };
  const latex = "\\res{1}{0.333333333333}+1";
  it("an inexact chip goes in by name (pasr_<k>), in the runner and the session alike", () => {
    const run = homeLatexStep(latex, chips);
    const session = giacOfEntry(latex, "home", { chips });
    expect(run.giac).toBe(session.giac);
    expect(run.giac).toMatch(/pasr_/);
    expect(run.inexact).toBe(true);
  });
  it("CAS keeps the chip as text", () => {
    expect(giacOfEntry(latex, "cas", { chips }).giac).not.toMatch(/pasr_/);
  });
});
