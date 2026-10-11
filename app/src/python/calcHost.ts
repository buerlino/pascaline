// SPDX-License-Identifier: GPL-3.0-or-later
// Main-thread side of the `calc` module: answers Python's host calls through the MathEngine.
// Values cross as tagged JSON (PyValue) so Python gets int / float / complex / list / str exactly.
import { defaultCasSettings, type MathEngine } from "../engine/types.ts";
import { HostError } from "./pyHost.ts";

/** Resolves with a JSON-serialisable value; a rejection becomes an exception in Python
 *  (HostError.pyType, else ValueError). */
export type HostHandler = (fn: string, args: unknown[]) => Promise<unknown>;

/** A value for Python: {i: "123"} int, {f: "0.5"} float, {c: [re, im]} complex, a list, or a plain string. */
export type PyValue = { i: string } | { f: string } | { c: [string, string] } | PyValue[] | string;

/** Names `calc.get`/`calc.set` accept: a Giac identifier as our keyboard can type it (letters, digits, `_`). */
const NAME = /^[A-Za-z][A-Za-z0-9_]*$/;
const REAL = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/;
const INT = /^-?\d+$/;

function real(s: string): string | undefined {
  if (REAL.test(s)) return s;
  if (s === "infinity" || s === "+infinity") return "inf";
  if (s === "-infinity") return "-inf";
  return undefined;
}

/** Giac's printed `evalf(...)` result as a PyValue, or undefined when it isn't numeric (symbolic, undef, ...). */
export function parseGiacNumeric(text: string): PyValue | undefined {
  const t = text.trim();
  if (t.startsWith("[")) {
    // Split the top level of a (nested) list.
    if (!t.endsWith("]")) return undefined;
    const inner = t.slice(1, -1);
    if (inner.trim() === "") return [];
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let k = 0; k < inner.length; k++) {
      const ch = inner[k];
      if (ch === "[") depth++;
      else if (ch === "]") depth--;
      else if (ch === "," && depth === 0) {
        parts.push(inner.slice(start, k));
        start = k + 1;
      }
    }
    parts.push(inner.slice(start));
    const items = parts.map(parseGiacNumeric);
    return items.every((v) => v !== undefined) ? (items as PyValue[]) : undefined;
  }
  const r = real(t);
  if (r !== undefined) return { f: r };
  // Complex: "a+b*i", "a-b*i", "b*i", "-b*i", "i", "-i".
  let body: string;
  if (t.endsWith("*i")) body = t.slice(0, -2);
  else if (t === "i" || t.endsWith("+i") || t.endsWith("-i")) body = t.slice(0, -1) + "1";
  else return undefined;
  // The sign that starts the imaginary part: the last + or - that isn't leading or an exponent's.
  let k = body.length - 1;
  while (k > 0 && !((body[k] === "+" || body[k] === "-") && body[k - 1] !== "e")) k--;
  const re = k > 0 ? real(body.slice(0, k)) : "0";
  const im = real(k > 0 ? body.slice(k) : body);
  return re !== undefined && im !== undefined ? { c: [re, im] } : undefined;
}

export function createCalcHost(math: MathEngine): HostHandler {
  const giac = async (input: string): Promise<string> => {
    const r = await math.eval(input);
    if (!r.ok) throw new HostError("ValueError", r.output);
    return r.output;
  };

  /** Evaluate and convert: exact integers stay int; everything numeric goes through evalf at 17 digits
   *  (exact values are exact to 17 digits; Giac floats carry what they print at the current Digits). */
  const value = async (expr: string): Promise<PyValue> => {
    const exact = await giac(expr);
    if (INT.test(exact)) return { i: exact };
    const num = parseGiacNumeric(await giac(`evalf(${exact},17)`));
    return num ?? exact;
  };

  const checkName = (v: unknown): string => {
    const name = String(v);
    if (!NAME.test(name)) throw new HostError("ValueError", `not a variable name: ${name}`);
    return name;
  };

  return async (fn, args) => {
    switch (fn) {
      case "cas": {
        const r = await math.cas(String(args[0]), defaultCasSettings);
        if (!r.ok) throw new HostError("ValueError", r.text);
        return r.text;
      }
      case "eval":
        return value(String(args[0]));
      case "get": {
        const name = checkName(args[0]);
        const v = await value(name);
        // An unassigned name evaluates to itself.
        if (v === name) throw new HostError("NameError", `calculator variable '${name}' isn't defined`);
        return v;
      }
      case "set": {
        const name = checkName(args[0]);
        const text = args[1] === null ? null : String(args[1]);
        await giac(text === null ? `purge(${name})` : `${name}:=${text}`);
        return null;
      }
      default:
        throw new HostError("ValueError", `calc: unknown function ${fn}`);
    }
  };
}
