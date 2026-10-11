// SPDX-License-Identifier: GPL-3.0-or-later
// CAS products of letters: x*x must not be drawn as the name "xx" (found on the Tab One, CAS x × x).
// Expected values are `derived` (x*x = x^2 by algebra; the drawn form keeps the factors apart).
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultCasSettings } from "./types.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { latexToGiac } from "../input/latex-to-giac.ts";
import { tidyGiacLatex } from "../render/tidy.ts";

describe.skipIf(!giacAvailable())("CAS products of letters (real Giac)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    host = new EngineHost((await loadNodeGiac()).giac);
  });
  const show = (latex: string): { giac: string; text: string; tex: string } => {
    const giac = latexToGiac(latex);
    const r = host.cas(giac, defaultCasSettings).result;
    return { giac, text: r.text, tex: tidyGiacLatex(r.latex) };
  };

  it.each([
    ["x\\times x", "x^2", "x^{2}"],
    ["x\\cdot x", "x^2", "x^{2}"],
    ["a\\times b", "a*b", "ab"],
    ["2\\times x\\times y", "2*x*y", "2xy"],
    ["x\\times y^{2}", "x*y^2", "xy^{2}"],
    ["x\\times y^{2}\\times x", "x^2*y^2", "x^{2}y^{2}"],
  ])("%s", (latex, text, tex) => {
    const r = show(latex);
    expect(r.text).toBe(text);
    expect(r.tex).toBe(tex);
  });

  it("CAS keeps factor() order (regroup alone would reorder it)", () => {
    expect(host.cas("factor(x^2-1)", defaultCasSettings).result.text).toBe("(x-1)*(x+1)");
  });

  it.each([["x*x", "x^2"], ["a*b*a", "a^2*b"], ["2*x*y", "2*x*y"], ["x*y^2*x", "x^2*y^2"]])("Home %s", (input, want) => {
    expect(host.home(input, defaultHomeSettings).result.display).toBe(want);
  });
});
