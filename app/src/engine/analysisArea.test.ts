// SPDX-License-Identifier: GPL-3.0-or-later
// G70 (backlog F56, hunt N6): the Function app's Area refuses only where Home refuses. Romberg's undef (a sample where
// the integrand is undefined) says nothing about convergence.
import { beforeAll, describe, expect, it } from "vitest";
import { EngineHost } from "./host.ts";
import { defaultHomeSettings } from "./homeEval.ts";
import { giacAvailable, loadNodeGiac, nodeHost } from "./nodeGiac.ts";
import { enEngine } from "../i18n/enEngine.ts";

describe.skipIf(!giacAvailable())("Area refuses only where Home refuses (G70)", () => {
  let host: EngineHost;
  beforeAll(async () => {
    host = (await nodeHost());
  });
  const area = (f: string, a: string, b: string) => host.analyze({ kind: "area", f, a, b }, defaultHomeSettings);

  it.each([
    ["ln(x)", "0", "1", "-1"], // source: oracle (mpmath quad)
    ["x*ln(x)", "0", "2", "0.38629436112"], // source: derived (2 ln 2 − 1)
    ["(1-cos(x))/x^2", "-1", "1", "0.972770752471"], // source: oracle (mpmath quad)
  ])("∫ %s on [%s, %s] = %s", (f, a, b, want) => {
    const r = area(f, a, b);
    expect(r.ok, r.info).toBe(true);
    expect(r.value!.display).toBe(want);
  });

  it("1/x on [-1, 1] is still refused with Home's reason", () => {
    const r = area("1/x", "-1", "1");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("no-root");
    expect(r.info).toBe(enEngine["error.integralDiverges"]);
  });

  it("Giac's timeout in the divergence check keeps the value with a warning (G70f1)", async () => {
    const { giac: real, bridge } = await loadNodeGiac();
    let checking = false;
    const wrapped = {
      ...real,
      eval: (t: string) => {
        if (/\blimit\(/.test(t)) {
          checking = true;
          return "GIAC_ERROR: interrupted";
        }
        return real.eval(t);
      },
    } as typeof real;
    const h = new EngineHost(wrapped, bridge);
    const r = h.analyze({ kind: "area", f: "ln(x)", a: "0", b: "1" }, defaultHomeSettings);
    expect(checking).toBe(true);
    expect(r.ok, r.info).toBe(true);
    expect(r.warn).toBe(true);
    expect(r.value!.display).toBe("-1");
    expect(r.info).toContain("divergence check did not finish");
  });
});
