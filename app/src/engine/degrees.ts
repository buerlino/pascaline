// SPDX-License-Identifier: GPL-3.0-or-later
// G46 (route R, S14 option 2): Giac runs in radians in every mode, so a symbolic result is radian text, right in every
// mode but read in degrees by a user in DEG (`atan(x)` for the antiderivative of 1/(1+x²) would be off by 180/π). In
// DEG the text drawn is the one a correct DEG engine would print: every trig function takes its argument back in
// degrees (`sin(pi/180*x)` → `sin(x)`) and every inverse returns degrees (`atan(x)` → `pi/180*atan(x)`). Only what is
// drawn and copied changes; Ans, chips and the stored value keep the radian text, which means the same in every mode.
// Synchronous, UI-free. Only erasable TypeScript syntax.
import { hasAngleFactor } from "../input/angles.ts";
import type { Giac } from "./numeric.ts";

const TRIG = ["sin", "cos", "tan", "sec", "csc", "cot"];
const INVERSE = ["asin", "acos", "atan", "asec", "acsc", "acot"];
/** Inert names Giac keeps as they are while it simplifies the arguments. */
const INERT = "pasdg_";
const CALL = new RegExp(`(?<![A-Za-z0-9_])(${[...INVERSE, ...TRIG].join("|")})\\s*\\(`, "y");
const ANY = new RegExp(`(?<![A-Za-z0-9_])(${[...INVERSE, ...TRIG].join("|")})\\s*\\(`);

function isError(out: string): boolean {
  return out.startsWith("GIAC_ERROR");
}

/** Index of the ) that closes the ( at `open`, outside strings; -1 when there is none. */
function closing(s: string, open: number): number {
  let d = 0;
  for (let k = open; k < s.length; k++) {
    const c = s[k]!;
    if (c === '"') {
      const q = s.indexOf('"', k + 1);
      if (q < 0) return -1;
      k = q;
    } else if (c === "(" || c === "[" || c === "{") d++;
    else if ((c === ")" || c === "]" || c === "}") && --d === 0) return k;
  }
  return -1;
}

/** The text needs the DEG display rule: it calls a trig function or an inverse, and holds no degree factor (a function
 *  body keeps `pasdeg`, so it follows the mode at call time and is drawn without it, R64). */
export function needsDegrees(text: string): boolean {
  return ANY.test(text) && !hasAngleFactor(text) && !text.includes('"');
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
    while (i < t.length) {
      CALL.lastIndex = i;
      const m = CALL.exec(t);
      if (m) {
        const open = i + m[0].length - 1;
        const close = closing(t, open);
        if (close > 0) {
          const name = m[1]!;
          const arg = walk(t.slice(open + 1, close));
          if (TRIG.includes(name)) out += `${INERT}${name}(normal(180/pi*(${arg})))`;
          else {
            inverse = true;
            out += `(pi/180*${INERT}${name}(${arg}))`;
          }
          i = close + 1;
          continue;
        }
      }
      out += t[i];
      i++;
    }
    return out;
  };
  const w = walk(text);
  const out = giac.eval(inverse ? `normal(${w})` : w);
  if (isError(out) || out === "undef") return null;
  const back = out.replace(new RegExp(`${INERT}([a-z]+)\\(`, "g"), "$1(");
  return back.includes(INERT) ? null : back;
}
