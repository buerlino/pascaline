// SPDX-License-Identifier: GPL-3.0-or-later
// G46 (route R, S14 option 2): Giac runs in radians in every mode, so a symbolic result is radian text, right in every
// mode but read in degrees by a user in DEG (`atan(x)` for the antiderivative of 1/(1+x²) would be off by 180/π). In
// DEG the text drawn is the one a correct DEG engine would print: every trig function takes its argument back in
// degrees (`sin(pi/180*x)` → `sin(x)`) and every inverse returns degrees (`atan(x)` → `pi/180*atan(x)`). Only what is
// drawn and copied changes; Ans, chips and the stored value keep the radian text, which means the same in every mode.
// Synchronous, UI-free. Only erasable TypeScript syntax.
import { hasAngleFactor } from "../input/angles.ts";
import type { Giac } from "./numeric.ts";
import { callsOf } from "./giacPrint.ts";

const TRIG = ["sin", "cos", "tan", "sec", "csc", "cot"];
const INVERSE = ["asin", "acos", "atan", "asec", "acsc", "acot"];
/** Inert names Giac keeps as they are while it simplifies the arguments. */
const INERT = "pasdg_";
const NAMES = [...INVERSE, ...TRIG];
const INERT_NAMES = NAMES.map((n) => INERT + n);

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

/** The text needs the DEG display rule: it calls a trig function or an inverse, and holds no degree factor (a function
 *  body keeps `pasdeg`, so it follows the mode at call time and is drawn without it, R64). */
export function needsDegrees(text: string): boolean {
  return callsOf(text, NAMES, "printed").length > 0 && !hasAngleFactor(text, "printed") && !text.includes('"');
}

/**
 * The radian result `text` as a DEG engine would print it, or null when Giac cannot rewrite it (the caller keeps the
 * radian text). `sin(u)` → `sin(normal(180/pi*u))`, `asin(u)` → `pi/180*asin(u)`, under inert names so that only the
 * arguments simplify; the whole text goes through `normal` only when an inverse occurred (S14: 0.1–0.6 ms).
 */
export function backInDegrees(giac: Giac, text: string): string | null {
  let inverse = false;
  const walk = (t: string): string => {
    let out = "";
    let i = 0;
    for (const c of callsOf(t, NAMES, "printed")) {
      if (c.at < i || c.close <= 0) continue;
      const arg = walk(t.slice(c.open + 1, c.close));
      out += t.slice(i, c.at);
      if (TRIG.includes(c.name)) out += `${INERT}${c.name}(normal(180/pi*(${arg})))`;
      else {
        inverse = true;
        out += `(pi/180*${INERT}${c.name}(${arg}))`;
      }
      i = c.close + 1;
    }
    return out + t.slice(i);
  };
  const w = walk(text);
  const out = giac.eval(inverse ? `normal(${w})` : w);
  if (isError(out) || out === "undef") return null;
  let back = "";
  let i = 0;
  for (const c of callsOf(out, INERT_NAMES, "printed")) {
    back += out.slice(i, c.at) + c.name.slice(INERT.length);
    i = c.at + c.name.length;
  }
  back += out.slice(i);
  return back.includes(INERT) ? null : back;
}
