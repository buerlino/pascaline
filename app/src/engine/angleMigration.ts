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
import { PASDEG, rewriteAngles } from "../input/angles.ts";
import { leadingName, mapNames, renameCalls } from "./giacPrint.ts";

/** A Giac evaluator (EngineHost's GiacApi has this shape). */
interface Evaluator {
  eval(input: string): string;
}

/** G21's helper is gone: its calls are Giac's exp, which reads radians (F29). The log holds Giac's print ("printed"
 *  strings, as EngineHost.restore reads them). */
export function withoutPasexp(text: string): string {
  return renameCalls(text, { pasexp: "exp" }, "printed");
}

/** `name:=(rhs)`, the form the log stores a value in (EngineHost.snapshot). */
function valueCmd(cmd: string): { name: string; rhs: string } | null {
  const name = leadingName(cmd);
  const rest = name !== null && cmd.startsWith(name) ? cmd.slice(name.length) : "";
  return name !== null && rest.startsWith(":=(") && rest.endsWith(")") && rest.length >= 4 ? { name, rhs: rest.slice(3, -1) } : null;
}

/** The value text read as degrees, with the factor frozen (the mode it was typed in no longer matters). */
export function degreeReading(rhs: string): string {
  return mapNames(rewriteAngles(rhs), (n) => (n.name === PASDEG ? "(pi/180)" : null));
}

/** The text holds an angle function the factor rewrite would change. */
function readsAngles(text: string): boolean {
  return rewriteAngles(text) !== text;
}

/** One stored entry (unknown shape: validDefs checks it later) brought to route R. */
function migrateEntry(x: unknown): unknown {
  if (!x || typeof x !== "object") return x;
  const e = x as Record<string, unknown>;
  const cmds = e["cmds"];
  if (!Array.isArray(cmds) || !cmds.every((c) => typeof c === "string")) return x;
  let next = (cmds as string[]).map(withoutPasexp);
  const kind = e["kind"];
  const out: Record<string, unknown> = { ...e };
  if (kind === "fn" || kind === "other") next = next.map(rewriteAngles);
  else if (kind === "var" && next.length === 1) {
    const m = valueCmd(next[0]!);
    const rhs = m?.rhs;
    if (m && rhs !== undefined && readsAngles(rhs)) {
      // A symbolic value (free names) followed the mode at use time, and still does with pasdeg.
      if (e["early"] === true) next = [rewriteAngles(next[0]!)];
      else if (e["angle"] === "deg") next = [`${m.name}:=(${degreeReading(rhs)})`];
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
  return typeof value === "string" ? withoutPasexp(value) : value;
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
