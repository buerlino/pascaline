// SPDX-License-Identifier: GPL-3.0-or-later
// R17: what a selected `1+2` becomes under x², xʸ and x⁻¹ is a different NUMBER from what it was (the bug gave
// `1+2^2` = 5), so the value is checked, not only the string. Expected values are derived: (1+2)^2 = 9, (1+2)^-1 = 1/3.
// The strings are what test/selection.spec.ts reads from the entry line after the key; the values need an engine
// build (GIAC_OUT, as in roundtrip.test.ts).
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { latexToGiac } from "./latex-to-giac.ts";

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  process.env["GIAC_OUT"],
  process.env["MAIN"] ? join(process.env["MAIN"], "engine/giac/_out/gsl") : undefined,
  resolve(here, "../../../engine/giac/_out/gsl"),
].filter((p): p is string => p !== undefined);
const giacOut = candidates.find((p) => existsSync(join(p, "giac.mjs")));

// [the entry line after the key with `1+2` selected, the Giac text, its value]
const CASES: [string, string, string, string][] = [
  ["x²", "\\left(1+2\\right)^2", "(1+2)^2", "9"],
  ["xʸ, then 2 in the exponent", "\\left(1+2\\right)^{2}", "(1+2)^2", "9"],
  ["x⁻¹", "\\left(1+2\\right)^{-1}", "(1+2)^(-1)", "1/3"],
  ["x² in one-line entry", '\\left(1+2\\right)\\char"5E 2', "(1+2)^2", "9"],
  ["sin", "\\sin\\left(1+2\\right)", "sin(pasdeg*(1+2))", "sin(3)"],
  ["abs", "\\left|1+2\\right|", "abs(1+2)", "3"],
];

describe("a selection as the argument of a key (R17)", () => {
  it.each(CASES)("%s: %s reads as %s", (_, latex, giacText) => {
    expect(latexToGiac(latex)).toBe(giacText);
  });

  describe.skipIf(!giacOut)("on the engine", () => {
    let giac: (s: string) => string;
    beforeAll(async () => {
      const mod = (await import(/* @vite-ignore */ pathToFileURL(join(giacOut as string, "giac.mjs")).href)) as {
        default: (o: object) => Promise<{ cwrap: (n: string, r: string, a: string[]) => (...x: unknown[]) => unknown }>;
      };
      (globalThis as Record<string, unknown>)["UI"] = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
      const M = await mod.default({ print: () => {}, printErr: () => {} });
      (M.cwrap("giac_init", "number", []) as () => number)();
      giac = M.cwrap("giac_eval", "string", ["string"]) as (s: string) => string;
      giac("pasdeg:=1"); // R64: our parser's text reads pasdeg, as the engine host sets it (homeEval.ts pasdegCommand)
    }, 60_000);

    it.each(CASES)("%s: %s has the value %s", (_, latex, __, value) => {
      expect(giac(latexToGiac(latex))).toBe(giac(value));
    });

    it("the old reading is a different number: 1+2^2 is 5, not 9", () => {
      expect(giac(latexToGiac("1+2^2"))).toBe("5");
    });
  });
});
