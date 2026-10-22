// SPDX-License-Identifier: GPL-3.0-or-later
// G43: the pure half of the golden gate's `invariants` stage (scripts/golden.ts). Kept apart so a test can feed it a
// wrong DEG answer. No expected values: each check compares one answer with another from a different setting.
import type { CopySource } from "../src/clipboard/text.ts";
import { formatComplex, markOf, type MarkInfo } from "../src/engine/format.ts";
import type { EngineHost } from "../src/engine/host.ts";
import { defaultHomeSettings, precisionFacts, type HomeResult } from "../src/engine/homeEval.ts";
import { hasAngleFactor } from "../src/input/angles.ts";
import type { Rational } from "../src/state/displayMode.ts";

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

const markText = (m: MarkInfo | null): string | undefined => (m ? `${m.mark}${m.n ?? ""}` : undefined);
const markAt = (r: HomeResult, digits: number): string | undefined => markText(markOf(precisionFacts(r), { format: "STD", digits }));

/** (a) An angle-free input shows the same text and mark in RAD and DEG. */
export function checkAngle(id: string, rad: HomeResult, deg: HomeResult): InvariantFailure | null {
  const mr = markAt(rad, 12);
  const md = markAt(deg, 12);
  return rad.display !== deg.display || mr !== md ? { id, check: "a", detail: `RAD ${mr ?? "-"} ${rad.display}, DEG ${md ?? "-"} ${deg.display}` } : null;
}

/** (b) A result confirmed at 12 and at 30 digits rounds to the same 12-digit text. Null when either is not confirmed to 12 digits (not comparable). */
export function checkDigits(id: string, r12: HomeResult, r30: HomeResult): { checked: boolean; failure: InvariantFailure | null } {
  if (!r12.ok || !r12.value || !r30.ok || !r30.value) return { checked: false, failure: null };
  const m12 = markOf(precisionFacts(r12), { format: "STD", digits: 12 });
  const m30 = markOf(precisionFacts(r30), { format: "STD", digits: 30 });
  const n12 = m12?.mark === "⚠" ? (m12.n ?? 12) : 12;
  const n30 = m30?.mark === "⚠" ? (m30.n ?? 30) : 30;
  if (n12 < 12 || n30 < 12) return { checked: false, failure: null };
  const text = formatComplex(r30.value, { format: "STD", digits: 12 }).text;
  return { checked: true, failure: text !== r12.display ? { id, check: "b", detail: `12 digits ${r12.display}, 30 digits rounded to 12: ${text}` } : null };
}

const RATIONAL = /^(-?\d+)(?:\/(\d+))?$/;
function rationalOf(text: string | undefined): Rational | undefined {
  const m = text === undefined ? null : RATIONAL.exec(text.trim());
  if (!m || m[1] === undefined || (m[2] !== undefined && BigInt(m[2]) === 0n)) return undefined;
  return { n: m[1], d: m[2] ?? "1" };
}
const isDigitsText = (t: string): boolean => /\.|\d[eE][+-]?\d/.test(t);
const FULL_LIMIT = 2048;

/**
 * The CopySource the app copies from for a Home result (session.svelte.ts `finish`, home branch): `full` from the exact
 * text first, `fullExact` by the session's rule, `rational` from the exact text, and the facts spread in as the history
 * item carries them. session.copysource.test.ts pins it against a real Session item.
 */
export function copySourceOf(r: HomeResult, inexactInput = false): CopySource {
  const src: CopySource = { latex: "", status: r.ok ? "done" : "error", text: r.display };
  if (r.value) src.value = r.value;
  const q = r.value ? rationalOf(r.exact) : undefined;
  if (q) src.rational = q;
  if (r.ok) {
    Object.assign(src, r.facts);
    const inexact = r.approximate || inexactInput;
    const exactText = !inexact && r.exact !== undefined && r.exact.length <= FULL_LIMIT ? r.exact : undefined;
    const full = exactText ?? (r.full || (inexact ? undefined : r.exact));
    if (full && full.length <= FULL_LIMIT) {
      src.full = full;
      const cut = r.exact !== undefined || r.value?.re.sticky === true || r.value?.im.sticky === true;
      src.fullExact = !inexact && (full === exactText || (!cut && (r.facts.exact || !isDigitsText(full))));
    }
  }
  return src;
}

/** (c) A number's copy text read back by the paste reader gives the same text; the mark may get stronger (a typed number is exact), never weaker. */
export function checkCopy(id: string, shown: HomeResult, copy: string, back: HomeResult): InvariantFailure | null {
  const m0 = markAt(shown, 12);
  const m1 = markAt(back, 12);
  const weaker = (m0?.startsWith("=") && !m1?.startsWith("=")) || (m0?.startsWith("≈") && m1?.startsWith("⚠"));
  return back.display !== shown.display || weaker ? { id, check: "c", detail: `shown ${m0 ?? "-"} ${shown.display}, copy ${copy} read back ${m1 ?? "-"} ${back.display}` } : null;
}

/** (d) `X:=input` in one mode, then `X` in the other, shows what the store line showed. */
export function checkStore(id: string, from: "rad" | "deg", to: "rad" | "deg", stored: HomeResult, read: HomeResult): InvariantFailure | null {
  const ms = markAt(stored, 12);
  const mr = markAt(read, 12);
  return read.display !== stored.display || ms !== mr
    ? { id, check: "d", detail: `stored in ${from.toUpperCase()} showed ${ms ?? "-"} ${stored.display}, read in ${to.toUpperCase()} ${mr ?? "-"} ${read.display}` }
    : null;
}

/** True when an input stores a name itself (`:=`, `=>`, `sto(`): it must not run on the stage's shared engine. */
export const storesNames = (giac: string): boolean => /:=|=>|\bsto\(/.test(giac);

/** The name check (d) stores under. */
export const INV_NAME = "pasinv";

/**
 * (d) in both directions on the engine `hostFor` gives (one engine for both, unless it hands out a new one each time): `X:=input` in one mode, `X` in the other. The name is purged after each
 * direction, so it reaches neither the other direction nor the next input on a shared engine. Returns the failures
 * and the number of directions checked (a store that gave no value is skipped).
 */
export async function checkStoreBoth(hostFor: () => Promise<EngineHost>, id: string, giac: string): Promise<{ checked: number; failures: InvariantFailure[] }> {
  const failures: InvariantFailure[] = [];
  let checked = 0;
  for (const [from, to] of [["rad", "deg"], ["deg", "rad"]] as const) {
    const host = await hostFor();
    host.home(`purge(${INV_NAME})`, defaultHomeSettings);
    const st = host.home(`${INV_NAME}:=(${giac})`, { ...defaultHomeSettings, angle: from }).result;
    if (!st.ok || !st.value) continue;
    const rd = host.home(INV_NAME, { ...defaultHomeSettings, angle: to }).result;
    checked++;
    const f = checkStore(id, from, to, st, rd);
    if (f) failures.push(f);
    host.home(`purge(${INV_NAME})`, defaultHomeSettings);
  }
  return { checked, failures };
}
