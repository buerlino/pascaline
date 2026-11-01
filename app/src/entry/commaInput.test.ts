// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { latexToGiac } from "../input/latex-to-giac.ts";
import { commaInput, shownInput } from "./commaInput.ts";

describe("R100: a stored input in comma mode", () => {
  it("draws its bare argument commas as ;", () => {
    expect(commaInput("\\operatorname{max}\\left(1,5\\right)")).toBe("\\operatorname{max}\\left(1;5\\right)");
    expect(commaInput("\\left\\{1,2,3\\right\\}")).toBe("\\left\\{1;2;3\\right\\}");
  });
  it("keeps MathLive's decimal comma, the thin space and a string", () => {
    expect(commaInput("\\operatorname{max}\\left(1{,}5,2\\right)")).toBe("\\operatorname{max}\\left(1{,}5;2\\right)");
    expect(commaInput("1\\,2")).toBe("1\\,2");
    expect(commaInput('\\operatorname{f}\\left("a,b",1\\right)')).toBe('\\operatorname{f}\\left("a,b",1\\right)');
  });
  it("gives the same Giac text (display only, L6)", () => {
    for (const l of ["\\operatorname{max}\\left(1,5\\right)", "\\operatorname{max}\\left(1{,}5,2\\right)", "\\left\\{1,2\\right\\}"])
      expect(latexToGiac(commaInput(l))).toBe(latexToGiac(l));
  });
  it("point mode: as stored", () => {
    expect(shownInput("\\operatorname{max}\\left(1,5\\right)", false)).toBe("\\operatorname{max}\\left(1,5\\right)");
    expect(shownInput("\\operatorname{max}\\left(1,5\\right)", true)).toBe("\\operatorname{max}\\left(1;5\\right)");
  });
});
