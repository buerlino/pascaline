// SPDX-License-Identifier: GPL-3.0-or-later
// A32: which cases of the core list the device run replays. Pure, so a vitest checks it without a device.
import type { CoreCase } from "../test/core-lib.ts";

export interface CorePlan {
  /** Cases that must pass (no `known:`, no `needs:`). */
  active: CoreCase[];
  /** Cases expected to fail (`known:`): the run fails when one passes (the ratchet of core.spec.ts). */
  known: CoreCase[];
  /** Cases skipped with their reason (`needs:`). */
  needs: CoreCase[];
}

/** Cases the device cannot run, with the reason (counted under needs). */
export const DESKTOP_ONLY: Readonly<Record<string, string>> = { c53: "desktop-only: the native share sheet" };

export function planDevice(input: readonly CoreCase[]): CorePlan {
  const cases = input.map((c) => (DESKTOP_ONLY[c.id] !== undefined && c.needs === undefined ? { ...c, needs: DESKTOP_ONLY[c.id] } : c));
  const needs = cases.filter((c) => c.needs !== undefined);
  const rest = cases.filter((c) => c.needs === undefined);
  return { active: rest.filter((c) => c.known === undefined), known: rest.filter((c) => c.known !== undefined), needs };
}

/** The line the run prints at the end, the shape of the desktop reporter's. */
export const deviceLine = (passed: number, p: CorePlan): string =>
  `CORE DEVICE ${passed}/${p.active.length} (known ${p.known.length}, needs ${p.needs.length})`;

export interface CaseOutcome { title: string; expectedStatus: string; status: string; duration: number; error?: string | undefined }
export interface CaseRecord { counts: "needs" | "known" | "active"; passed: boolean; rec: Record<string, unknown> }

/** One case's log row and its place in the closing counts. A known case's `ok` is "it failed as expected" (A40): one that passes is `ok: false`. */
export function caseRecord(o: CaseOutcome, t: string, serial: string): CaseRecord | null {
  const m = /^(c\d\d) /.exec(o.title);
  if (!m) return null;
  const skipped = o.status === "skipped";
  const known = o.expectedStatus === "failed";
  const ok = skipped ? null : known ? o.status !== "passed" : o.status === "passed";
  const error = known && ok === false ? "known case passes" : (o.error ?? "").split("\n")[0]?.slice(0, 200);
  const rec = { t, kind: "core", case: m[1], ok, ms: Math.round(o.duration), serial, ...(skipped ? { skipped: true } : {}), ...(known ? { known: true } : {}), ...(ok === false ? { error } : {}) };
  return { counts: skipped ? "needs" : known ? "known" : "active", passed: !skipped && !known && o.status === "passed", rec };
}
