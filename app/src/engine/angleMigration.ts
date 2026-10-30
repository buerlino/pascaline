// SPDX-License-Identifier: GPL-3.0-or-later
// G46: the stored definitions log brought to route R (Giac always in radians, the degree mode in the text as `pasdeg`;
// S14's R14 section 7). Two halves:
// - `migrateAngleDefs`, a pure DATA_VERSION step (state/storage.ts, 2 → 3): `pasexp(` becomes `exp(` everywhere;
//   functions and inputs kept as typed get the factor (they followed the mode at call time and still do); a variable
//   whose stored mode is known (G34) is read in it; an older variable whose text holds an angle function is flagged.
// - `resolveAngle`, engine-side (EngineHost.restore): a flagged variable is read both ways (as radians, and as
//   degrees) and keeps the reading whose value matches its preview, the value it showed when it was stored. One that
//   matches neither (or both) keeps its text.
// Only erasable TypeScript syntax; no engine import, so the UI side (storage.ts) may use the pure half.
import { dropAngleFactor, hasAngleFactor, PASDEG, POLAR_OUT, RECT_IN, rewriteAngles } from "../input/angles.ts";
import { leadingName, mapNames, opening, type Quoting, renameCalls, withoutStrings } from "./giacPrint.ts";

/** A Giac evaluator (EngineHost's GiacApi has this shape). */
interface Evaluator {
  eval(input: string): string;
}

/** G21's helper is gone: its calls are Giac's exp, which reads radians (F29). `q` is the text's quoting: a version-2
 *  variable's command is Giac's print (its snapshot); a function's, an input's, an assumption's and a library text are
 *  typed (G105f2). */
export function withoutPasexp(text: string, q: Quoting): string {
  return renameCalls(text, { pasexp: "exp" }, q);
}

/** `name:=(rhs)`, the form the log stores a value in (EngineHost.snapshot). */
function valueCmd(cmd: string): { name: string; rhs: string } | null {
  const name = leadingName(cmd);
  const rest = name !== null && cmd.startsWith(name) ? cmd.slice(name.length) : "";
  return name !== null && rest.startsWith(":=(") && rest.endsWith(")") && rest.length >= 4 ? { name, rhs: rest.slice(3, -1) } : null;
}

/** The degree factor as a degree reading freezes it. */
const FROZEN = "(pi/180)";

/** The value text read as degrees, with the factor frozen (the mode it was typed in no longer matters). */
export function degreeReading(rhs: string): string {
  return mapNames(rewriteAngles(rhs, "printed"), (n) => (n.name === PASDEG ? FROZEN : null), "printed");
}

/** POLAR_OUT and RECT_IN as a degree reading writes them, and as they were. */
const WRAPPERS: readonly (readonly [frozen: string, text: string])[] = [POLAR_OUT, RECT_IN].map((w) => [w.split(PASDEG).join(FROZEN), w]);

/**
 * A50: the value text is a degree reading already (this step's own output, or resolveAngle's), so reading it as
 * degrees again would apply the factor twice. It is one when, with the factors a reading writes taken back out, it
 * reads to itself. Those are `(pi/180)*(` opening an argument, which Giac's print never has (it writes `pi/180*(x)`),
 * `/(pi/180))` closing a bracketed call (`(atan(x)/(pi/180))`), and the polar wrappers. A value Giac printed with
 * `(pi/180)` elsewhere keeps it; one whose print is itself a reading (`2^(atan(x)/(pi/180))`) cannot be told apart.
 */
function isDegreeReading(rhs: string): boolean {
  const text = WRAPPERS.reduce((s, [frozen, w]) => s.split(frozen).join(w), rhs);
  const t = withoutStrings(text, (x) => " ".repeat(x.length), "printed");
  let back = "";
  let i = 0;
  for (let k = t.indexOf(FROZEN); k >= 0; k = t.indexOf(FROZEN, k + 1)) {
    const end = k + FROZEN.length;
    const argument = /[(,]/.test(t.charAt(k - 1)) && t.startsWith("*(", end);
    const open = t.charAt(k - 1) === "/" && t.charAt(end) === ")" ? opening(t, end) : -1;
    const name = open >= 0 ? leadingName(t.slice(open + 1)) : null;
    const call = name !== null && t.charAt(open + 1 + name.length) === "(";
    if (k < i || !(argument || call)) continue;
    back += text.slice(i, k) + PASDEG;
    i = end;
  }
  back += text.slice(i);
  if (back === rhs) return false;
  const typed = dropAngleFactor(back, "printed");
  return !hasAngleFactor(typed, "printed") && degreeReading(typed) === rhs;
}

/** The text holds an angle function the factor rewrite would change. */
function readsAngles(text: string): boolean {
  return rewriteAngles(text, "printed") !== text;
}

/** One stored entry (unknown shape: validDefs checks it later) brought to route R. */
function migrateEntry(x: unknown): unknown {
  if (!x || typeof x !== "object") return x;
  const e = x as Record<string, unknown>;
  const cmds = e["cmds"];
  if (!Array.isArray(cmds) || !cmds.every((c) => typeof c === "string")) return x;
  const kind = e["kind"];
  // Only a variable's command was Giac's print in version 2; every other kind was stored as typed.
  const q: Quoting = kind === "var" ? "printed" : "typed";
  let next = (cmds as string[]).map((c) => withoutPasexp(c, q));
  const out: Record<string, unknown> = { ...e };
  if (kind === "fn" || kind === "other") next = next.map((c) => rewriteAngles(c, "typed"));
  else if (kind === "var" && next.length === 1) {
    const m = valueCmd(next[0]!);
    const rhs = m?.rhs;
    if (m && rhs !== undefined && readsAngles(rhs)) {
      // A symbolic value (free names) followed the mode at use time, and still does with pasdeg.
      if (e["early"] === true) next = [rewriteAngles(next[0]!, "printed")];
      // A degree reading already (A50: the step ran on its own output) is left as it is.
      else if (e["angle"] === "deg") next = isDegreeReading(rhs) ? next : [`${m.name}:=(${degreeReading(rhs)})`];
      else if (e["angle"] !== "rad") out["migrate"] = "angle";
    }
  }
  out["cmds"] = next;
  return out;
}

/** The DATA_VERSION step for the stored `defs` (an array of entries). */
export function migrateAngleDefs(value: unknown): unknown {
  return Array.isArray(value) ? value.map(migrateEntry) : value;
}

/** The DATA_VERSION step for a library file's text: its bodies are written without the factor (the import puts it in),
 *  so only `pasexp` goes. */
export function migrateAngleText(value: unknown): unknown {
  return typeof value === "string" ? withoutPasexp(value, "typed") : value;
}

/** `text` evaluates within a relative 1e-10 of the preview `shown` (12 significant digits, Giac syntax). */
function matches(giac: Evaluator, text: string, shown: string): boolean {
  const p = shown.replace(/(\d)E([+-]?\d)/g, "$1e$2");
  const d = giac.eval(`evalf(abs((${text})-(${p}))-abs(${p})*1e-10,20)`).trim();
  return /^-/.test(d) || d === "0" || d === "0.0";
}

/**
 * A flagged variable (`migrate: "angle"`) read both ways against its preview: the command to keep and the mode it was
 * read in (none when both readings give the preview: either is right), or null when neither matches: the entry keeps
 * its text and is listed (R14 section 7: not guessed).
 */
export function resolveAngle(giac: Evaluator, cmd: string, preview: string): { cmd: string; angle?: "rad" | "deg" } | null {
  const m = valueCmd(cmd);
  if (!m || !preview) return null;
  const rhs = m.rhs;
  const deg = degreeReading(rhs);
  const asRad = matches(giac, rhs, preview);
  const asDeg = matches(giac, deg, preview);
  if (asRad && asDeg) return { cmd };
  if (asDeg) return { cmd: `${m.name}:=(${deg})`, angle: "deg" };
  return asRad ? { cmd, angle: "rad" } : null;
}
