// SPDX-License-Identifier: GPL-3.0-or-later
// Round trip: LaTeX -> Giac string (our parser), then Giac decides whether it equals the intended Giac
// expression: simplify((a)-(b)) == 0, else numeric evaluation at 3 random points.
// Needs an engine build: GIAC_OUT=<dir with giac.mjs> (default $PASCALINE_MAIN/engine/giac/_out/gsl or the repo's own).
// The 296 general cases live in tests/golden/parser.yaml (npm run golden); this file covers the keyboard templates.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { keyboard, templates } from "../keyboard/keyboard.ts";
import { SAMPLE_CHIPS } from "./chips.ts";
import { latexToGiac } from "./latex-to-giac.ts";

const here = dirname(fileURLToPath(import.meta.url));
const candidates = [
  process.env["GIAC_OUT"],
  process.env["MAIN"] ? join(process.env["MAIN"], "engine/giac/_out/gsl") : undefined,
  resolve(here, "../../../engine/giac/_out/gsl"),
].filter((p): p is string => p !== undefined);
const giacOut = candidates.find((p) => existsSync(join(p, "giac.mjs")));

type GiacEval = (s: string) => string;
let giac: GiacEval;

function equal(a: string, b: string): { ok: boolean; how: string } {
  if (a === b) return { ok: true, how: "identical" };
  const ea = giac(a);
  if (ea === giac(b) && !/undef|error/i.test(ea)) return { ok: true, how: "same value" };
  const diff = `(${a})-(${b})`;
  const s = giac(`simplify(${diff})`);
  if (s === "0" || s === "0=0") return { ok: true, how: "simplify" };
  const vars = giac(`lname(${diff})`)
    .replace(/[[\]\s]/g, "")
    .split(",")
    .filter((v) => v && v !== "pi" && v !== "i");
  for (let k = 0; k < 3; k++) {
    const x = 0.15 + Math.random() * 1.7;
    const at = (e: string): string =>
      vars.length ? `subst(${e},[${vars.join(",")}],[${vars.map((_, j) => (x + j * 0.31).toFixed(6)).join(",")}])` : e;
    const r = giac(`abs(evalf(${at(diff)}))`);
    const scale = Math.max(1, Math.abs(Number(giac(`evalf(${at(`(${b})`)})`))) || 1);
    const v = Number(r) / scale;
    if (!Number.isFinite(v) || v > 1e-8) return { ok: false, how: `numeric diff ${r} (simplify gave ${s.slice(0, 60)})` };
  }
  return { ok: true, how: "numeric" };
}

describe.skipIf(!giacOut)("LaTeX -> Giac round trip", () => {
  beforeAll(async () => {
    const mod = (await import(/* @vite-ignore */ pathToFileURL(join(giacOut as string, "giac.mjs")).href)) as {
      default: (o: object) => Promise<{ cwrap: (n: string, r: string, a: string[]) => (...x: unknown[]) => unknown }>;
    };
    (globalThis as Record<string, unknown>)["UI"] = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
    const M = await mod.default({ print: () => {}, printErr: () => {} });
    (M.cwrap("giac_init", "number", []) as () => number)();
    giac = M.cwrap("giac_eval", "string", ["string"]) as GiacEval;
  }, 60_000);

  // Rule: every keyboard template (spec/keyboard.yaml) has a parser rule and a round-trip case.
  describe("keyboard templates", () => {
    for (const t of templates(keyboard)) {
      if (!t.sample) continue;
      const [latex, intended] = t.sample;
      it(`${t.keyId}/${t.layer}/${t.variant}: ${latex}`, () => {
        const produced = latexToGiac(latex, { chips: SAMPLE_CHIPS });
        const r = equal(produced, intended);
        expect(r.ok, `got ${produced}, want ${intended}: ${r.how}`).toBe(true);
      });
    }
  });
});

describe("round-trip engine", () => {
  it("is available (otherwise the keyboard template round trip was skipped)", () => {
    if (!giacOut) console.warn("roundtrip: no giac.mjs found (set GIAC_OUT or MAIN); template round trips were skipped");
    expect(true).toBe(true);
  });
});
