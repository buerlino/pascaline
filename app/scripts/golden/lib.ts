// SPDX-License-Identifier: GPL-3.0-or-later
// shared helpers of the golden gate stages (scripts/golden.ts)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { EngineHost, type LoadedGiac } from "../../src/engine/host.ts";
import { typed, type Case, type Expect } from "../../src/goldenRun.ts";
import { defaultHomeSettings, pasdegCommand, type HomeSettings } from "../../src/engine/homeEval.ts";
import { decimalFromString, formatReal, toText } from "../../src/engine/format.ts";
import { giacMjsPath, loadNodeGiac } from "../../src/engine/nodeGiac.ts";
import { hasFloat } from "../../src/engine/numeric.ts";

export const root = fileURLToPath(new URL("../../../", import.meta.url));
export const mjs = giacMjsPath();
export const ROUNDS = Number(process.env.ROUNDS ?? 5);
export const HOME_LIMIT_MS = 500;
export const only = process.env.ONLY?.split(",").map((s) => s.trim());
export const want = (stage: string) => !only || only.includes(stage);

/** Files whose `input`-style fields are what the user types, in Giac's spelling (not the parser's LaTeX). */
export const TYPED_FILES = new Set(["home.yaml", "precision.yaml", "bench.yaml", "solve.yaml", "function.yaml", "units.yaml"]);


export function cases(file: string): Case[] {
  const doc = parse(readFileSync(`${root}tests/golden/${file}`, "utf8")) as { cases: Case[] };
  return TYPED_FILES.has(file) ? doc.cases.map(typed) : doc.cases;
}

export const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export async function freshEngine(): Promise<LoadedGiac> {
  const L = await loadNodeGiac(mjs);
  L.giac.eval(pasdegCommand("rad")); // R64: our parser's text reads pasdeg, as the engine host sets it
  return L;
}
export async function freshHost(): Promise<EngineHost> {
  const L = await freshEngine();
  return new EngineHost(L.giac, L.bridge);
}

export const summary: { stage: string; ok: boolean; line: string }[] = [];
export function report(stage: string, ok: boolean, line: string): void {
  summary.push({ stage, ok, line });
  console.log(`${ok ? "PASS" : "FAIL"} ${stage}: ${line}`);
}

/** `expect` (STD at the case's digits) rounded again to n digits, or null when that could round the wrong way
 *  (the dropped part is exactly 5: the case then needs a longer expect). */
export function expectAt(expect: string, n: number): string | null {
  const v = decimalFromString(expect.replace("E", "e"));
  if (!v) return null;
  if (v.digits.slice(n) === "5") return null;
  return toText(formatReal(v, { format: "STD", digits: n }));
}

export const LOOKS_NUMERIC = /^-?(\d+(\.\d+)?|\.\d+)(E[+-]?\d+)?([+-](\d+(\.\d+)?(E[+-]?\d+)?\*)?i)?$/;

/** A mark-only case still needs an answer: a number, or a non-number that holds a float (G27: its ⚠ is the mark the
 *  case checks), or a list of numbers. The input echoed back (BesselJ(1,2) at 30 digits) is a lost result. */
export function lostAnswer(shown: string, input: string): boolean {
  // G48: a list, matrix or sequence of numbers (`[899450126402,1]`, `899450126402,1`) is an answer too; G119: a sequence
  // shows as Giac's list type, in braces (`{899450126402,1}`).
  const numbers = shown.replace(/[[\]{}]/g, "").split(",");
  return !numbers.every((x) => LOOKS_NUMERIC.test(x)) && !(hasFloat(shown) && shown !== input);
}

export const same = (a: Expect, b: Expect | undefined): boolean => JSON.stringify(a) === JSON.stringify(b);
export const str = (x: string | string[] | undefined): string => (Array.isArray(x) ? x[0]! : x!);
export const list = (x: string | string[] | undefined): string[] => (Array.isArray(x) ? x : [x!]);

export const caseSettings = (c: Case): HomeSettings => ({ ...defaultHomeSettings, digits: c.settings?.digits ?? defaultHomeSettings.digits, angle: c.settings?.angle ?? "rad" });
