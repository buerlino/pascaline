// SPDX-License-Identifier: GPL-3.0-or-later
// G87 (structure audit 2.3): one parse tree goes to Giac text (input/emit.ts) and to the drawing (input/emit-js.ts).
// Every tests/golden/parser.yaml LaTeX both accept is run through both at fixed x in RAD and DEG; the drawing must give
// the engine's number (relative 1e-9) unless the case is in KNOWN. Giac side: Home on subst(<giac>,x=<v>), skipped without GIAC_OUT.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { defaultHomeSettings } from "../../engine/homeEval.ts";
import { giacAvailable, nodeHost } from "../../engine/nodeGiac.ts";
import { compileDefinition } from "./compile.ts";

/** Cases where the drawing and the engine differ on purpose or for an open reason: id -> reason or backlog id. Filled from the first run. */
const KNOWN: Record<string, string> = {
  "roots-11": "Giac simplifies sqrt(x)*sqrt(x) to x, so it answers for x<0 where the drawing has a gap (no backlog id; the drawing is the honest one)",
};

const XS = [-2.7, -1, -0.5, 0.3, 1, 2, 4.5];
const file = fileURLToPath(new URL("../../../../tests/golden/parser.yaml", import.meta.url));
const cases = (parse(readFileSync(file, "utf8")) as { cases: { id: string; latex: string }[] }).cases;

describe.skipIf(!giacAvailable())("the drawing and the engine agree (G87)", () => {
  it("every shared parser.yaml case, RAD and DEG", async () => {
    const host = await nodeHost();
    const diffs: string[] = [];
    for (const c of cases) {
      for (const angle of ["rad", "deg"] as const) {
        const k = compileDefinition(c.latex, angle);
        if (!k.giac || !k.fn) continue;
        const bad: string[] = [];
        for (const x of XS) {
          const js = k.fn(x);
          const r = host.home(`subst(${k.giac},x=${x})`, { ...defaultHomeSettings, angle }).result;
          const real = r.ok && r.value && r.value.im.digits === "" ? Number(r.display.replace("E", "e")) : undefined;
          const jsOk = Number.isFinite(js);
          if (real !== undefined && jsOk) {
            if (Math.abs(real - js) > 1e-9 * Math.max(1, Math.abs(real))) bad.push(`x=${x}: engine ${real}, drawn ${js}`);
          } else if (real !== undefined || jsOk) bad.push(`x=${x}: engine ${r.ok ? r.display : "refused"}, drawn ${js}`);
        }
        if (bad.length && !(c.id in KNOWN)) diffs.push(`${c.id} ${angle} ${JSON.stringify(c.latex)}: ${bad[0]}`);
      }
    }
    expect(diffs).toEqual([]);
  }, 600_000);
});
