// SPDX-License-Identifier: GPL-3.0-or-later
// G167: the nightly sweep in parts. The pure pieces (slices, file sets), then a real small run (needs GIAC_OUT and the oracle venv as sweep.test.ts):
// two parts together give the one-piece run's failures, and the shrink reading the saved parts gives the one-piece findings.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { childrenOf } from "../../tools/probes/sweep/edges.ts";
import { shrink, type Finding } from "../../tools/probes/sweep/nightly.ts";
import { pythonFor, Runner, runsOf } from "../../tools/probes/sweep/run.ts";
import { failedOf, mergeParts, parsePart, readSet, sliceOf, sweepRuns, writeSaved, type PartFile, type ShrinkFile } from "./sweep-parts.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const mainCheckout = resolve(spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim() || resolve(repo, ".git"), "..");
const python = pythonFor(repo, mainCheckout);
const oraclePy = resolve(repo, "tools/probes/sweep/oracle.py");
const tmp = mkdtempSync(join(tmpdir(), "sweep-parts-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe("sweep parts: slices and files", () => {
  it("reads i/n", () => {
    expect(parsePart("2/4")).toEqual({ i: 2, n: 4 });
    for (const bad of ["0/4", "5/4", "2", "a/b", "2/", undefined]) expect(parsePart(bad)).toBeNull();
  });
  it("cuts a list into contiguous slices that are the list again, whatever n is", () => {
    const list = Array.from({ length: 433 }, (_, i) => i);
    for (const n of [1, 2, 3, 4, 7, 433, 500]) {
      const parts = Array.from({ length: n }, (_, k) => sliceOf(list, { i: k + 1, n }));
      expect(parts.flat()).toEqual(list);
    }
  });
  const file = (part: number, of: number): PartFile => ({ seed: 7, count: 100, edges: false, part, of, total: 4, from: 0, to: 0, ran: [`r${part}`], failed: [], stats: { runs: 1, kinds: { ok: 1 }, bareWarn: 0, parserRefused: 0, restarts: 0, oracleSecs: 0, secs: 0 } });
  it("names the missing parts and refuses an incomplete set", () => {
    writeSaved(tmp, "part", file(1, 4));
    writeSaved(tmp, "part", file(3, 4));
    const r = readSet<PartFile>(tmp, "part", 7);
    expect(r).toMatchObject({ ok: false });
    expect(r.ok ? "" : r.message).toContain("2/4, 4/4");
    expect(readSet<PartFile>(tmp, "part", 8)).toMatchObject({ ok: false });
  });
  it("reads a complete set in part order", () => {
    writeSaved(tmp, "part", file(4, 4));
    writeSaved(tmp, "part", file(2, 4));
    const r = readSet<PartFile>(tmp, "part", 7);
    expect(r.ok && r.files.map((f) => f.part)).toEqual([1, 2, 3, 4]);
    expect(r.ok && [...mergeParts(r.files).ran]).toEqual(["r1", "r2", "r3", "r4"]);
  });
  it("a file that says another run than its name is refused", () => {
    writeFileSync(join(tmp, "sweep-part-9-100-1of1.json"), JSON.stringify(file(1, 1)));
    const r = readSet<PartFile>(tmp, "part", 9);
    expect(r.ok ? "" : r.message).toContain("another run");
  });
});

describe("sweep parts: a real small run", () => {
  // seed 1793847163 is the weekly night of G138; 300 edge trees (433 runs, about 13 s) hold two failures (a ≈ and a ⚠n)
  const seed = 1793847163;
  const count = 300;
  const runs = runsOf(seed, count, true);
  const key = (f: { id: string; check: string }): string => `${f.id} [${f.check}]`;

  it("two parts and one piece fail the same runs with the same verdicts", { timeout: 240_000 }, async () => {
    const whole = await sweepRuns(runs, python, oraclePy, 6000);
    const wholeFailed = failedOf(whole.judged, whole.oracles);
    expect(wholeFailed.length).toBeGreaterThan(0); // the check below is empty otherwise
    const dir = join(tmp, "two");
    const judgedKinds: string[] = [];
    for (const i of [1, 2]) {
      const slice = sliceOf(runs, { i, n: 2 });
      const r = await sweepRuns(slice, python, oraclePy, 6000);
      judgedKinds.push(...r.judged.map((j) => `${j.angle} ${j.digits} ${j.latex} ${j.verdict.kind} ${j.verdict.check ?? ""}`));
      writeSaved(dir, "part", { seed, count, edges: true, part: i, of: 2, total: runs.length, from: 0, to: slice.length, ran: r.judged.map((j) => `${j.angle} ${j.digits} ${j.latex}`), failed: failedOf(r.judged, r.oracles), stats: r.stats });
    }
    expect(judgedKinds).toEqual(whole.judged.map((j) => `${j.angle} ${j.digits} ${j.latex} ${j.verdict.kind} ${j.verdict.check ?? ""}`));
    const loaded = readSet<PartFile>(dir, "part", seed);
    if (!loaded.ok) throw new Error(loaded.message);
    const merged = mergeParts(loaded.files);
    expect(merged.failed.map(key)).toEqual(wholeFailed.map(key));
    expect(merged.ran.size).toBe(whole.judged.length);
    expect(merged.stats.runs).toBe(whole.stats.runs);

    // the shrink of the saved failures, whole and as two shrink parts, gives the one-piece findings
    const shape = (f: Finding): string => `${f.run.angle} ${f.run.digits} ${f.run.latex} => ${f.smallest.latex} [${f.smallest.verdict.check ?? f.smallest.verdict.kind}]`;
    const findingsOf = async (failed: typeof wholeFailed): Promise<Finding[]> => {
      const runner = new Runner(6000);
      return shrink(failed, childrenOf, runner, python, oraclePy).finally(() => runner.close());
    };
    const oneShot = (await findingsOf(wholeFailed)).map(shape);
    const fromParts = (await findingsOf(merged.failed)).map(shape);
    expect(fromParts).toEqual(oneShot);
    expect(oneShot.length).toBe(wholeFailed.length);
    for (const i of [1, 2]) {
      const part = sliceOf(merged.failed, { i, n: 2 });
      const runner = new Runner(6000);
      const findings = await shrink(part, childrenOf, runner, python, oraclePy).finally(() => runner.close());
      writeSaved(dir, "shrink", { seed, count, edges: true, part: i, of: 2, failedCount: merged.failed.length, findings } satisfies ShrinkFile);
    }
    const joined = readSet<ShrinkFile>(dir, "shrink", seed);
    if (!joined.ok) throw new Error(joined.message);
    expect(joined.files.flatMap((f) => f.findings).map(shape)).toEqual(oneShot);
  });
});
