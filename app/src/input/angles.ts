// SPDX-License-Identifier: GPL-3.0-or-later
// R64 (route R, decisions "S14"): the angle mode lives in the text our parser emits. Every command the user types that
// takes an angle gets its angle times `pasdeg`, and every one that returns an angle gets its result over `pasdeg`;
// the engine host sets `pasdeg` (Giac always runs in radians, G46: π/180 in DEG, 1 in RAD). The emitter (emit.ts) and
// the rewrite of Giac text below (the library import, G46's migration) share these tables.
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
  polar_point: [1, 0], // polar_point(r, θ) (R64f2)
  similarity: [2, 0], // similarity(center, ratio, angle, object)
  rectangular_coordinates: [1, 2], // rectangular_coordinates(r, θ); the one-list form: RECT, below (R64f1)
};

/** Commands whose result is an angle (or a list of angles); instfreq is an angle per sample or per unit of time. */
export const ANGLE_OUT: ReadonlySet<string> = new Set([
  "asin", "acos", "atan", "asec", "acsc", "acot", "arg", "atan2", "angle", "instphase", "instfreq",
]);

/** A typed degree (° and DMS, R10): u° is u*DEGREE, u in the mode's unit (30 in DEG, π/6 in RAD; Giac in radians). */
export const DEGREE = `pi/180/${PASDEG}`;

/**
 * R64f1: polar_coordinates answers [r, θ] for one point and a list of those for a list of points, θ in radians.
 * `POLAR_OUT(polar_coordinates(…))` gives every θ over pasdeg; the shape is read when it is evaluated, since the
 * argument's text (a complex number, a name) does not show it.
 */
export const POLAR = "polar_coordinates";
export const POLAR_OUT = `((p_)->when(type(p_[0])==vector,map(p_,q_->[q_[0],q_[1]/${PASDEG}]),[p_[0],p_[1]/${PASDEG}]))`;

/**
 * R64f1: rectangular_coordinates of one list, [r, θ] or a list of those: every θ times pasdeg. A literal point
 * `[r,t]` of two numeric literals (`numericLiteral`) takes the factor in its text (`rectArg`); any other argument goes through `RECT_IN(…)`, which reads its
 * shape when evaluated and passes a non-list (a point object) unchanged.
 */
export const RECT = "rectangular_coordinates";
export const RECT_IN =
  `((p_)->when(type(p_)!=vector,p_,when(type(p_[0])==vector,map(p_,q_->[q_[0],${PASDEG}*q_[1]]),[p_[0],${PASDEG}*p_[1]])))`;

/**
 * Giac text that is a number by itself: number literals and pi with + - * / ^ and brackets. Only then can the text
 * say an element of [r,t] is a scalar; a name or a call may hold a point (A:=[2,30]), so it goes through RECT_IN.
 */
export function numericLiteral(text: string): boolean {
  const rest = text.replace(/(?<![A-Za-z0-9_.])(\d+\.?\d*|\.\d+)(e[+-]?\d+)?(?![A-Za-z0-9_.])|(?<![A-Za-z0-9_])pi(?![A-Za-z0-9_])/gi, "0");
  return /\d/.test(rest) && /^[0\s+\-*/^()]*$/.test(rest);
}

/** The one-list rectangular_coordinates argument with the factor; `point` holds the two elements of a literal [r,t]. */
export function rectArg(arg: string, point?: readonly [r: string, t: string]): string {
  return point ? `[${point[0]},${point[1]}]` : `${RECT_IN}(${arg})`;
}

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
/** The ° factor as R10 wrote it (R64 put `/pasdeg` after it); Giac now always runs in radians, so it is pi/180. */
const OLD_DEGREES = "(pi/180)^angle_radian()";

/** A literal point `[r,t]` (two elements, each a numeric literal): its elements, else undefined. */
function literalPoint(arg: string): [string, string] | undefined {
  if (!arg.startsWith("[") || closing(arg, 0) !== arg.length - 1) return undefined;
  const parts = splitArgs(arg.slice(1, -1));
  if (parts.length !== 2 || !parts.every(numericLiteral)) return undefined;
  return [parts[0]!, parts[1]!];
}

/** R64's form `(pi/180)^angle_radian()/pasdeg` as `pi/180/pasdeg` after a `*`, else `(pi/180)/pasdeg`. */
function newDegrees(text: string): string {
  const old = `${OLD_DEGREES}/${PASDEG}`;
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === '"') {
      const q = text.indexOf('"', i + 1);
      const j = q < 0 ? text.length : q + 1;
      out += text.slice(i, j);
      i = j;
    } else if (text.startsWith(old, i) && !/[A-Za-z0-9_]/.test(text[i + old.length] ?? "")) {
      out += out.endsWith("*") ? DEGREE : `(pi/180)/${PASDEG}`;
      i += old.length;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * The emitter's angle rule on Giac text that was written without it (a library file, a stored input from before R64):
 * every command in ANGLE_IN gets its angle times pasdeg, every one in ANGLE_OUT returns `(<call>/pasdeg)`,
 * polar_coordinates and the one-list rectangular_coordinates get POLAR_OUT and RECT_IN, and R10's ° factor
 * `(pi/180)^angle_radian()` becomes DEGREE (bracketed unless it follows a `*`). Text that already holds `pasdeg` gets
 * only R64's ° form brought to DEGREE, so the rewrite never applies twice. Strings are left alone.
 */
export function rewriteAngles(text: string): string {
  if (new RegExp(`(?<![A-Za-z0-9_])${PASDEG}(?![A-Za-z0-9_])`).test(text)) return newDegrees(text);
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
      i += OLD_DEGREES.length;
      out += out.endsWith("*") && text[i] !== "^" ? DEGREE : `(${DEGREE})`;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      CALL.lastIndex = i;
      const m = CALL.exec(text);
      const name = m?.[1];
      const open = m ? i + m[0].length - 1 : -1;
      const close = m ? closing(text, open) : -1;
      const inSpec = name !== undefined ? ANGLE_IN[name] : undefined;
      if (name !== undefined && close > 0 && (inSpec || ANGLE_OUT.has(name) || name === POLAR)) {
        const args = splitArgs(text.slice(open + 1, close)).map(rewrite);
        if (inSpec && args.length > inSpec[0] && (inSpec[1] === 0 || args.length === inSpec[1])) {
          args[inSpec[0]] = withFactor(args[inSpec[0]]!.trim(), false);
        } else if (name === RECT && args.length === 1) {
          const a = args[0]!.trim();
          const p = literalPoint(a);
          args[0] = rectArg(a, p && [p[0], withFactor(p[1].trim(), false)]);
        }
        const call = `${text.slice(i, open + 1)}${args.join(",")})`;
        out += ANGLE_OUT.has(name) ? `(${call}/${PASDEG})` : name === POLAR ? `${POLAR_OUT}(${call})` : call;
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
 * `sin(pasdeg*x)`, `sin(x+1)` for `sin(pasdeg*(x+1))`, `asin(x)` for `asin(x)/pasdeg`, `polar_coordinates(z)` for
 * `POLAR_OUT(polar_coordinates(z))`, `L` for `RECT_IN(L)`. Only for display: a chip, Ans
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
    const wrapper = text.startsWith(`${POLAR_OUT}(`, i) ? POLAR_OUT : text.startsWith(`${RECT_IN}(`, i) ? RECT_IN : "";
    const end = wrapper ? closing(text, i + wrapper.length) : -1;
    if (end > 0) {
      out += dropAngleFactor(text.slice(i + wrapper.length + 1, end));
      i = end + 1;
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
