// SPDX-License-Identifier: GPL-3.0-or-later
// R64 (route R, decisions "S14"): the angle mode lives in the text our parser emits. Every command the user types that
// takes an angle gets its angle times `pasdeg`, and every one that returns an angle gets its result over `pasdeg`;
// the engine host sets `pasdeg` (1 in every mode until G46 runs Giac in radians, then π/180 in DEG). The emitter
// (emit.ts) and the rewrite of Giac text below (the library import, G46's migration) share these tables.
// No imports: the engine side may use this file too.

/** The engine name that holds the degree factor. Reserved: the parser and the library refuse it as a user name. */
export const PASDEG = "pasdeg";

/**
 * Commands that take an angle: the index of that argument, and the number of arguments the form must have (0: any).
 * Audit of the Find index (R64): docs in the R64 report; a command not here and not in ANGLE_OUT needs nothing or is
 * listed there with its reason.
 */
export const ANGLE_IN: Readonly<Record<string, readonly [index: number, arity: number]>> = {
  sin: [0, 1], cos: [0, 1], tan: [0, 1], sec: [0, 1], csc: [0, 1], cot: [0, 1],
  rotation: [1, 0], // rotation(center, angle, object)
  similarity: [2, 0], // similarity(center, ratio, angle, object)
  rectangular_coordinates: [1, 2], // rectangular_coordinates(r, θ); the one-list form is left alone (R64 report)
};

/** Commands whose result is an angle (or a list of angles). */
export const ANGLE_OUT: ReadonlySet<string> = new Set(["asin", "acos", "atan", "asec", "acsc", "acot", "arg", "atan2", "angle", "instphase"]);

/** The text of an angle argument with the factor: an atom as `pasdeg*x`, anything else in brackets. */
export function withFactor(arg: string, atom: boolean): string {
  return atom ? `${PASDEG}*${arg}` : `${PASDEG}*(${arg})`;
}

/** Index of the bracket that closes the one at `open`, outside strings; -1 when there is none. */
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

/** Index of the last ( in `s` that no later ) closes; -1 when there is none. Strings are not looked at. */
function unmatchedOpen(s: string): number {
  let d = 0;
  for (let k = s.length - 1; k >= 0; k--) {
    const c = s[k]!;
    if (c === ")" || c === "]" || c === "}") d++;
    else if (c === "(" || c === "[" || c === "{") {
      if (d === 0) return c === "(" ? k : -1;
      d--;
    }
  }
  return -1;
}

/** The top-level arguments of a call's inner text. */
function splitArgs(s: string): string[] {
  const parts: string[] = [];
  let d = 0;
  let start = 0;
  for (let k = 0; k < s.length; k++) {
    const c = s[k]!;
    if (c === '"') {
      const q = s.indexOf('"', k + 1);
      if (q < 0) break;
      k = q;
    } else if (c === "(" || c === "[" || c === "{") d++;
    else if (c === ")" || c === "]" || c === "}") d--;
    else if (c === "," && d === 0) {
      parts.push(s.slice(start, k));
      start = k + 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

const CALL = /([A-Za-z_][A-Za-z0-9_]*)\s*\(/y;
/** The ° template as R10 emitted it: in degrees in DEG once Giac runs in radians, it must be over pasdeg (emit.ts). */
const OLD_DEGREES = "(pi/180)^angle_radian()";

/**
 * The emitter's angle rule on Giac text that was written without it (a library file, a stored input from before R64):
 * every command in ANGLE_IN gets its angle times pasdeg, every one in ANGLE_OUT returns `(<call>/pasdeg)`, and R10's
 * ° factor `(pi/180)^angle_radian()` gets `/pasdeg` after it. Text that already holds `pasdeg` is returned unchanged,
 * so the rewrite never applies twice. Strings are left alone.
 */
export function rewriteAngles(text: string): string {
  if (new RegExp(`(?<![A-Za-z0-9_])${PASDEG}(?![A-Za-z0-9_])`).test(text)) return text;
  return rewrite(text);
}

function rewrite(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === '"') {
      const q = text.indexOf('"', i + 1);
      const j = q < 0 ? text.length : q + 1;
      out += text.slice(i, j);
      i = j;
      continue;
    }
    if (text.startsWith(OLD_DEGREES, i)) {
      out += `${OLD_DEGREES}/${PASDEG}`;
      i += OLD_DEGREES.length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      CALL.lastIndex = i;
      const m = CALL.exec(text);
      const name = m?.[1];
      const open = m ? i + m[0].length - 1 : -1;
      const close = m ? closing(text, open) : -1;
      const inSpec = name !== undefined ? ANGLE_IN[name] : undefined;
      if (name !== undefined && close > 0 && (inSpec || ANGLE_OUT.has(name))) {
        const args = splitArgs(text.slice(open + 1, close)).map(rewrite);
        if (inSpec && args.length > inSpec[0] && (inSpec[1] === 0 || args.length === inSpec[1])) {
          args[inSpec[0]] = withFactor(args[inSpec[0]]!.trim(), false);
        }
        const call = `${text.slice(i, open + 1)}${args.join(",")})`;
        out += ANGLE_OUT.has(name) ? `(${call}/${PASDEG})` : call;
        i = close + 1;
        continue;
      }
      const w = /[A-Za-z_0-9]+/y;
      w.lastIndex = i;
      const word = w.exec(text)![0];
      out += word;
      i += word.length;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const FACTOR = new RegExp(`(?<![A-Za-z0-9_])${PASDEG}(?![A-Za-z0-9_])`);

/** The text holds the degree factor. */
export function hasAngleFactor(text: string): boolean {
  return FACTOR.test(text);
}

/**
 * What is drawn never shows the factor (R64; S14 R14 §5): Giac text as the user typed it, `sin(x)` for
 * `sin(pasdeg*x)`, `sin(x+1)` for `sin(pasdeg*(x+1))`, `asin(x)` for `asin(x)/pasdeg`. Only for display: a chip, Ans
 * and a stored function keep the factor, so they follow the mode when used again.
 */
export function dropAngleFactor(text: string): string {
  if (!hasAngleFactor(text)) return text;
  let out = "";
  let i = 0;
  const mul = `${PASDEG}*`;
  const div = `/${PASDEG}`;
  const free = (k: number): boolean => k >= text.length || !/[A-Za-z0-9_]/.test(text[k]!);
  const bound = (k: number): boolean => k <= 0 || !/[A-Za-z0-9_]/.test(text[k - 1]!);
  while (i < text.length) {
    const c = text[i]!;
    if (c === '"') {
      const q = text.indexOf('"', i + 1);
      const j = q < 0 ? text.length : q + 1;
      out += text.slice(i, j);
      i = j;
      continue;
    }
    if (bound(i) && text.startsWith(mul, i)) {
      const at = i + mul.length;
      const close = text[at] === "(" ? closing(text, at) : -1;
      // the whole argument in brackets: the brackets go with the factor (sin(pasdeg*(x+1)) -> sin(x+1))
      if (close > 0 && /[(,]$/.test(out) && /^[),]/.test(text.slice(close + 1))) {
        out += dropAngleFactor(text.slice(at + 1, close));
        i = close + 1;
      } else i = at;
      continue;
    }
    if (text.startsWith(div, i) && free(i + div.length)) {
      i += div.length;
      // `(asin(x)/pasdeg)^2`: the grouping bracket was there for the factor only, so it goes too
      const open = text[i] === ")" ? unmatchedOpen(out) : -1;
      const inner = open >= 0 ? out.slice(open + 1) : "";
      const call = /^[A-Za-z_][A-Za-z0-9_]*\(/.exec(inner);
      if (call && !/[A-Za-z0-9_]/.test(out[open - 1] ?? "") && closing(inner, call[0].length - 1) === inner.length - 1) {
        out = out.slice(0, open) + inner;
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
