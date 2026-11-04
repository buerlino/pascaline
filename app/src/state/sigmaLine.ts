// SPDX-License-Identifier: GPL-3.0-or-later
// R40 (σ on tap, owner 2026-11-02): the muted line under a result whose digits a constant's σ limits: σ with 2
// significant digits in the row's notation, and the expanded uncertainty U = 2σ (k = 2). σ is G26's first-order σ
// the engine sends with `uncDigits` (ValueFacts.uncSigma).
import { decimalFromString, formatReal, toText, type FormatOptions } from "../engine/format.ts";
import type { ValueFacts } from "../engine/types.ts";
import { t } from "../i18n/index.ts";
import { commaResult, type FmtMode } from "./displayMode.ts";

/** The notation σ is shown in, from the row's: Standard and Fixed would drop σ's second digit or show it as zeros. */
const SIGMA_FORMAT: Readonly<Record<string, FormatOptions["format"]>> = { eng: "ENG", pfx: "PFX" };

/** σ with its two significant digits, `ᴇ` for the exponent as on the entry line. */
function shown(text: string, mode: FmtMode, comma: boolean): string | null {
  const v = decimalFromString(text);
  if (!v) return null;
  const s = toText(formatReal(v, { format: SIGMA_FORMAT[mode] ?? "SCI", digits: 2 })).replace("E", "ᴇ");
  return comma ? commaResult(s, false) : s;
}

/** 2σ as decimal text, exactly (σ's digits doubled). */
function doubled(sigma: string): string | null {
  const v = decimalFromString(sigma);
  return v ? `${v.neg ? "-" : ""}${2n * BigInt(v.digits)}e${v.exp - v.digits.length + 1}` : null;
}

/** The σ line of a result with these facts, drawn in `mode` (the row's notation); null when it has no σ. */
export function sigmaLine(facts: ValueFacts | undefined, mode: FmtMode, comma = false): string | null {
  const s = facts?.uncSigma;
  if (s === undefined || facts?.uncDigits === undefined) return null;
  const u = doubled(s);
  const a = shown(s, mode, comma);
  const b = u === null ? null : shown(u, mode, comma);
  return a === null || b === null ? null : t("history.sigma", { s: a, u: b });
}
