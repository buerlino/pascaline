// SPDX-License-Identifier: GPL-3.0-or-later
// G43: the pure half of the golden gate's `invariants` stage (scripts/golden.ts). Kept apart so a test can feed it a
// wrong DEG answer. No expected values: each check compares one answer with another from a different setting.
import { hasAngleFactor } from "../src/input/angles.ts";

/** One failed invariant: the case, the check ("a" RAD/DEG, "b" 12/30 digits, "c" copy and paste, "d" store), what differed. */
export interface InvariantFailure {
  id: string;
  check: string;
  detail: string;
}

export interface KnownFailure {
  id: string;
  check: string;
  /** The package whose fix removes the entry. */
  package: string;
  note?: string;
}

/** A function or entry that reads the angle mode (trig and inverse, arg, atan2, polar entry and output, degree sign). */
const ANGLE_WORDS = /(?<![A-Za-z0-9_])(a?(sin|cos|tan|sec|csc|cot)|arg|atan2|angle|polar_coordinates|polar|rect|pasua|pasdeg)\b|[°∡]/;

/** What the input is, for the checks: `angleFree` when no angle function is in it (the typed text with the parser's degree factor). */
export function invariantsOf(giac: string, before: readonly string[] = []): { angleFree: boolean } {
  const text = [...before, giac].join(";");
  return { angleFree: !hasAngleFactor(text) && !ANGLE_WORDS.test(text) };
}

const keyOf = (f: { id: string; check: string }): string => `${f.id} ${f.check}`;

/**
 * The stage's verdict: it passes when the failures are exactly the known ones. A new failure fails it, and so does a
 * known one that now passes (the list is pruned when a fix lands).
 */
export function invariantsStage(failures: readonly InvariantFailure[], known: readonly KnownFailure[]): { ok: boolean; lines: string[]; summary: string } {
  const knownKeys = new Map(known.map((k) => [keyOf(k), k]));
  const got = new Set(failures.map(keyOf));
  const lines: string[] = [];
  let fresh = 0;
  let still = 0;
  for (const f of failures) {
    const k = knownKeys.get(keyOf(f));
    if (k) {
      still++;
      lines.push(`known (${k.package}) ${f.id} [${f.check}]: ${f.detail}`);
    } else {
      fresh++;
      lines.push(`NEW ${f.id} [${f.check}]: ${f.detail}`);
    }
  }
  let fixed = 0;
  for (const k of known)
    if (!got.has(keyOf(k))) {
      fixed++;
      lines.push(`NOW PASSING ${k.id} [${k.check}]: remove it from tests/golden/invariants-known.yaml (${k.package})`);
    }
  return { ok: fresh === 0 && fixed === 0, lines, summary: `${still} known failures, ${fresh} new, ${fixed} now passing` };
}
