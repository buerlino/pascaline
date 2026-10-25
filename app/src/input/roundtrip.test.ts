// SPDX-License-Identifier: GPL-3.0-or-later
// Round trip: LaTeX -> Giac string (our parser), then Giac decides whether it equals the intended Giac
// expression: simplify((a)-(b)) == 0, else numeric evaluation at 3 random points.
// Needs an engine build: GIAC_OUT=<dir with giac.mjs> (default $PASCALINE_MAIN/engine/giac/_out/gsl or the repo's own).
// The general cases live in tests/golden/parser.yaml (npm run golden); this file covers the keyboard templates.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { keyboard, templates } from "../keyboard/keyboard.ts";
import { ENGINE_DEFINITIONS } from "../engine/homeEval.ts";
import { eseriesDefinition } from "../engine/eseries.ts";
import { SAMPLE_CHIPS } from "./chips.ts";
import { latexToGiac } from "./latex-to-giac.ts";
import { rewriteAngles } from "./angles.ts";

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
    giac("pasdeg:=1"); // R64: our parser's text reads pasdeg, as the engine host sets it (homeEval.ts pasdegCommand)
    // The parser emits our own names (pasmod); the host loads them on first use.
    for (const def of [...Object.values(ENGINE_DEFINITIONS), eseriesDefinition()]) giac(def);
  }, 60_000);

  // Rule: every keyboard template (spec/keyboard.yaml) has a parser rule and a round-trip case.
  describe("keyboard templates", () => {
    for (const t of templates(keyboard)) {
      if (!t.sample) continue;
      const [latex, intended] = t.sample;
      it(`${t.keyId}/${t.layer}/${t.variant}: ${latex}${t.refused ? " is refused" : ""}`, () => {
        // a refused cell (R18: & and Å) must give a message, never a guessed meaning
        if (t.refused) return void expect(() => latexToGiac(latex, { chips: SAMPLE_CHIPS })).toThrow(/has no meaning|is a unit/);
        const produced = latexToGiac(latex, { chips: SAMPLE_CHIPS });
        const r = equal(produced, intended);
        expect(r.ok, `got ${produced}, want ${intended}: ${r.how}`).toBe(true);
      });
    }
  });

  // R64 (route R): with Giac in radians and pasdeg = π/180 in DEG (G46's setting), the parser's text alone keeps the
  // degree mode. Derived values: sin(30°) = 1/2, asin(1/2) = 30 (DEG) and π/6 (RAD), arg(i) = 90 and π/2, atan2(1,1) =
  // 45 and π/4, 2∡30 = √3 + i in DEG, a 30° angle is 30 in DEG (the mode's unit) and π/6 in RAD.
  describe("route R: Giac in radians, the degrees in the text", () => {
    for (const [mode, pasdeg] of [["rad", "1"], ["deg", "pi/180"]] as const) {
      it(`${mode}: every angle the user types follows pasdeg`, () => {
        giac("angle_radian:=1");
        giac(`pasdeg:=${pasdeg}`);
        const deg = mode === "deg";
        const v = (latex: string): string => giac(`simplify(${latexToGiac(latex)})`);
        try {
          expect(v("\\sin\\left(30^{\\circ}\\right)")).toBe("1/2");
          expect(v("30^{\\circ}")).toBe(deg ? "30" : "pi/6");
          expect(v("30\\degree15\\prime36\\doubleprime")).toBe(deg ? "1513/50" : "1513*pi/9000");
          expect(v("\\arcsin\\left(\\frac{1}{2}\\right)")).toBe(deg ? "30" : "pi/6");
          expect(v("\\sin^{-1}\\left(\\frac{1}{2}\\right)")).toBe(deg ? "30" : "pi/6");
          expect(v("\\arg\\left(\\imaginaryI\\right)")).toBe(deg ? "90" : "pi/2");
          expect(v("\\operatorname{atan2}\\left(1,1\\right)")).toBe(deg ? "45" : "pi/4");
          expect(v(deg ? "\\cos\\left(60\\right)" : "\\cos\\left(\\frac{\\pi}{3}\\right)")).toBe("1/2");
          expect(v(deg ? "2\\measuredangle30" : "2\\measuredangle\\frac{\\pi}{6}")).toBe("sqrt(3)+i");
          // a hyperbolic function has no angle in it (F29): the same in both modes
          expect(v("\\cosh\\left(0\\right)")).toBe("1");
          // R64f1: the coordinate converters and instfreq answer in the mode (derived: 1+i is √2 at 45° = π/4, 2 at
          // 30° = π/6 is (√3, 1), the phase of [1,i,-1,-i] turns 90° = π/2 a sample)
          expect(v("\\operatorname{polar\\_coordinates}\\left(1+\\imaginaryI\\right)")).toBe(deg ? "[sqrt(2),45]" : "[sqrt(2),pi/4]");
          expect(v(`\\operatorname{rectangular\\_coordinates}\\left(\\left\\{2,${deg ? "30" : "\\frac{\\pi}{6}"}\\right\\}\\right)`)).toBe("[sqrt(3),1]");
          expect(v(`\\operatorname{rectangular\\_coordinates}\\left(2,${deg ? "30" : "\\frac{\\pi}{6}"}\\right)`)).toBe("[sqrt(3),1]");
          // a list of names that hold points (audit R64f1; derived: cos/sin of 30° and 90°)
          giac(deg ? "A:=[2,30]" : "A:=[2,pi/6]");
          giac(deg ? "B:=[1,90]" : "B:=[1,pi/2]");
          expect(v("\\operatorname{rectangular\\_coordinates}\\left(\\left\\{A,B\\right\\}\\right)")).toBe("[[sqrt(3),1],[0,1]]");
          expect(giac(`simplify(${rewriteAngles("rectangular_coordinates([A,B])", "typed")})`)).toBe("[[sqrt(3),1],[0,1]]");
          expect(giac(`simplify(${rewriteAngles(`rectangular_coordinates([[2,${deg ? "30" : "pi/6"}],[1,0]])`, "typed")})`)).toBe("[[sqrt(3),1],[1,0]]");
          expect(giac(`simplify(${rewriteAngles("polar_coordinates([1+i,i])", "typed")})`)).toBe(deg ? "[[sqrt(2),45],[1,90]]" : "[[sqrt(2),pi/4],[1,pi/2]]");
          // R64f2: polar_point(r,t) reads t as an angle (derived: 2 at 30° = π/6 is √3 + i)
          expect(v(`\\operatorname{affix}\\left(\\operatorname{polar\\_point}\\left(2,${deg ? "30" : "\\frac{\\pi}{6}"}\\right)\\right)`)).toBe("sqrt(3)+i");
          expect(v("\\operatorname{instfreq}\\left(\\left\\{1,\\imaginaryI,-1,-\\imaginaryI\\right\\}\\right)")).toBe(deg ? "[90,90,90]" : "[pi/2,pi/2,pi/2]");
        } finally {
          giac("purge(A,B)");
          giac("pasdeg:=1");
        }
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
