// SPDX-License-Identifier: GPL-3.0-or-later
// The Format key and the a b/c key on the last result (R10, Session.cycleFormat and cycleForm). Out of the start
// chunk (R135: its room was spent): main.ts fetches it when idle, the first press waits for it otherwise. The choice of
// the next mode and form (nextMode, nextForm, isApplicable) is here too.
import type { Calc, CalcSettings } from "../calc/port.ts";
import { PASDEG } from "../engine/pasdeg.ts";
import { decimalToString, type ComplexValue } from "../engine/format.ts";
import { type Facts, factsOf, FMT_MODES, type FmtMode, type FormStep } from "./displayMode.ts";
import type { HistoryItem, Session } from "./session.svelte.ts";

/** Fraction modes need an exact rational; polar needs a complex result (and the engine). */
export function isApplicable(mode: FmtMode, f: Facts): boolean {
  if (!f.numeric) return false;
  if (mode === "frac" || mode === "mixed") return f.rational;
  if (mode === "polar") return f.complex;
  return true;
}

/**
 * The a b/c key: the form after `current` (undefined = the base form). Each result type has one toggle: a fraction
 * that is not whole goes decimal ↔ fraction, a complex number a+bi ↔ polar. Home (`exactBase` false): the base is the
 * decimal (in the result's notation). CAS (`exactBase` true): the base is the exact result, which already is the
 * fraction, so a fraction toggles with its decimal ("dec"). null: nothing to switch (a whole number, a symbolic result).
 */
export function nextForm(current: FormStep | undefined, f: Facts, exactBase: boolean): { form: FormStep | undefined } | null {
  if (!f.numeric) return null;
  const other: FormStep | null = f.complex ? "polar" : f.properFraction ? (exactBase ? "dec" : "frac") : null;
  if (other === null) return null;
  return { form: current === other ? undefined : other };
}

/**
 * The mode after `current`. Home (`exactBase` false): the global mode counts as the current one and the cycle wraps.
 * CAS (`exactBase` true): the exact result is the first step and the cycle returns to it. null: nothing to cycle
 * (no ticked mode applies to this result).
 */
export function nextMode(
  current: FmtMode | undefined,
  ticked: readonly FmtMode[],
  facts: Facts,
  exactBase: boolean,
): { mode: FmtMode | undefined } | null {
  const list = FMT_MODES.filter((m) => ticked.includes(m) && isApplicable(m, facts));
  if (list.length === 0) return null;
  const seq: (FmtMode | undefined)[] = exactBase ? [undefined, ...list] : list;
  const i = seq.indexOf(current);
  return { mode: seq[(i + 1) % seq.length] };
}

/** abs and arg of the value, from the engine (arg follows the angle unit setting). */
async function computePolar(s: Session, calc: Calc, item: HistoryItem, v: ComplexValue): Promise<boolean> {
  const z = `((${decimalToString(v.re)})+(${decimalToString(v.im)})*i)`;
  const set: CalcSettings = { digits: s.settings.digits, angle: s.settings.angle, format: s.settings.format };
  try {
    const [r, th] = [await calc.home(`abs(${z})`, set), await calc.home(`(arg(${z})/${PASDEG})`, set)]; // G46: Giac answers in radians; the factor gives the mode's unit
    if (!r.ok || !th.ok || !r.value || !th.value) return false;
    item.polar = { r: r.value.re, theta: th.value.re, angle: s.settings.angle };
    return true;
  } catch {
    return false;
  }
}

/** The Format key: `item` (the last result of the open view at the press, Session.lastForKey) in the next ticked mode
 *  (Settings), that result only. True when the display changed. */
export async function cycleFormat(s: Session, calc: Calc, item: HistoryItem): Promise<boolean> {
  if (item.form !== undefined) {
    // a form chosen with a b/c: the Format key goes back to the number in its notation
    delete item.form;
    s.saveHistory();
    return true;
  }
  const exactBase = item.view === "cas";
  const next = nextMode(item.fmt ?? (exactBase ? undefined : s.settings.format), s.settings.fmtCycle, factsOf(item), exactBase);
  if (!next) return false;
  if (next.mode === "polar" && item.value && item.polar?.angle !== s.settings.angle && !(await computePolar(s, calc, item, item.value)))
    return false;
  item.fmt = next.mode;
  s.saveHistory();
  return true;
}

/** The a b/c key on an empty line (R10): `item` (the last result at the press) in its other form (decimal ↔ fraction, a+bi ↔ polar), that result
 *  only. True when the display changed; false when no other form applies (a whole number, a symbolic result). */
export async function cycleForm(s: Session, calc: Calc, item: HistoryItem): Promise<boolean> {
  const next = nextForm(item.form, factsOf(item), item.view === "cas");
  if (!next) return false;
  if (next.form === "polar" && item.value && item.polar?.angle !== s.settings.angle && !(await computePolar(s, calc, item, item.value)))
    return false;
  if (next.form === undefined) delete item.form;
  else item.form = next.form;
  s.saveHistory();
  return true;
}
