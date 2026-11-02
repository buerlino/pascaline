// SPDX-License-Identifier: GPL-3.0-or-later
// A44: the oracle sweep's known-rows files. tests/golden/sweep-known.yaml is the gate stage's exact list (seed 20261021): a row there that
// passes turns `npm run gate` red. tests/golden/sweep-nightly-known.yaml holds the open findings of the nightly runs (--nightly) only:
// the gate never reads it, so its rows are never NOW PASSING there.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import type { InvariantFailure, KnownFailure } from "./invariants.ts";
import type { Verdict } from "../../tools/probes/sweep/judge.ts";

export const GATE_FILE = "tests/golden/sweep-known.yaml";
export const NIGHTLY_FILE = "tests/golden/sweep-nightly-known.yaml";

const rowsOf = (path: string): KnownFailure[] => ((parse(readFileSync(path, "utf8")) as { known?: KnownFailure[] } | null)?.known ?? []);

/** The rows a run hides: the gate's list; with `nightly` also the nightly file. `dir` is the repo root. */
export function loadKnown(dir: string, nightly: boolean): { gate: KnownFailure[]; nightly: KnownFailure[] } {
  return { gate: rowsOf(resolve(dir, GATE_FILE)), nightly: nightly ? rowsOf(resolve(dir, NIGHTLY_FILE)) : [] };
}

export const knownKey = (k: { id: string; check: string }): string => `${k.id} ${k.check}`;

/** The nightly report's split: failures neither file knows (the findings) and nightly rows whose case passed ("now passing", report only). */
export function splitNightly<T extends { id: string; check: string }>(failures: readonly T[], known: { gate: readonly KnownFailure[]; nightly: readonly KnownFailure[] }, ran: ReadonlySet<string>): { fresh: T[]; nowPassing: KnownFailure[] } {
  const hidden = new Set([...known.gate, ...known.nightly].map(knownKey));
  const failed = new Set(failures.map(knownKey));
  return {
    fresh: failures.filter((f) => !hidden.has(knownKey(f))),
    nowPassing: known.nightly.filter((k) => ran.has(k.id) && !failed.has(knownKey(k))),
  };
}

/** Verdict kinds that fail a sweep run: the gate and the nightly report take the same four (G144: the gate left `crash` out, so an engine
 *  crash was counted in the stats line and never failed the stage). */
export const FAILING_KINDS: readonly string[] = ["wrong", "novalue", "hang", "crash"];

/** The gate's failures of a judged run: every failing verdict as a row id ("<angle> <digits> <latex>") with its check. */
export function sweepFailures(judged: readonly { angle: string; digits: number; latex: string; verdict: Verdict }[]): InvariantFailure[] {
  return judged
    .filter((j) => FAILING_KINDS.includes(j.verdict.kind))
    .map((j) => ({ id: `${j.angle} ${j.digits} ${j.latex}`, check: j.verdict.check ?? j.verdict.kind, detail: j.verdict.detail ?? "" }));
}
