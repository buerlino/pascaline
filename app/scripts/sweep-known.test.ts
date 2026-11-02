// SPDX-License-Identifier: GPL-3.0-or-later
// A44: the nightly sweep's own known-rows file: hidden from the nightly report, never read by the gate run.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { invariantsStage } from "./invariants.ts";
import { loadKnown, splitNightly, sweepFailures } from "./sweep-known.ts";
import type { VerdictKind } from "../../tools/probes/sweep/judge.ts";

const dir = mkdtempSync(join(tmpdir(), "sweepknown-"));
mkdirSync(join(dir, "tests/golden"), { recursive: true });
writeFileSync(join(dir, "tests/golden/sweep-known.yaml"), "known:\n  - { id: 'rad 30 g', check: hang, package: F62 }\n");
writeFileSync(join(dir, "tests/golden/sweep-nightly-known.yaml"), "known:\n  - { id: 'rad 12 n', check: crash, package: F122 }\n");

describe("sweep known rows (A44)", () => {
  it("--nightly reads both files and hides a nightly row from the report", () => {
    const known = loadKnown(dir, true);
    expect(known.nightly).toHaveLength(1);
    const r = splitNightly([{ id: "rad 12 n", check: "crash" }, { id: "rad 12 new", check: "=" }], known, new Set(["rad 12 n"]));
    expect(r.fresh.map((f) => f.id)).toEqual(["rad 12 new"]);
    expect(r.nowPassing).toEqual([]);
  });
  it("lists a nightly row whose case passed as now passing", () => {
    const r = splitNightly([], loadKnown(dir, true), new Set(["rad 12 n"]));
    expect(r.nowPassing.map((k) => k.id)).toEqual(["rad 12 n"]);
    expect(splitNightly([], loadKnown(dir, true), new Set()).nowPassing).toEqual([]); // not run this time: not passing
  });
  it("the gate run ignores the nightly file and never reports its rows as NOW PASSING", () => {
    const known = loadKnown(dir, false);
    expect(known.nightly).toEqual([]);
    const stage = invariantsStage([{ id: "rad 30 g", check: "hang", detail: "" }], known.gate);
    expect(stage.ok).toBe(true);
    expect(stage.lines.join("\n")).not.toContain("NOW PASSING");
  });
  it("G144: the gate's failures take a crash as the nightly one does, and a crash row of the gate file hides it", () => {
    const j = (kind: VerdictKind, latex: string, check?: string) => ({ angle: "rad" as const, digits: 30, latex, verdict: { kind, ...(check ? { check } : {}), detail: "d" } });
    const judged = [j("ok", "a"), j("wrong", "b", "≈"), j("novalue", "c", "novalue"), j("hang", "d", "hang"), j("crash", "e", "crash"), j("refused", "f"), j("skip", "g"), j("nonnumber", "h")];
    const failures = sweepFailures(judged);
    expect(failures.map((f) => `${f.id} [${f.check}]`)).toEqual(["rad 30 b [≈]", "rad 30 c [novalue]", "rad 30 d [hang]", "rad 30 e [crash]"]);
    expect(invariantsStage(failures, [{ id: "rad 30 d", check: "hang", package: "F62" }]).ok).toBe(false); // crash e is new
    const stage = invariantsStage(sweepFailures([j("crash", "rad", "crash")]), [{ id: "rad 30 rad", check: "crash", package: "G94" }]);
    expect(stage.ok).toBe(true);
  });
});
