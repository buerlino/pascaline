// SPDX-License-Identifier: GPL-3.0-or-later
// A60: the F-Droid recipe's own build proves find/factors.yaml (decisions.md P22).
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** The `prebuild` lines of the recipe's first build, comments and indentation stripped. */
function prebuild(): string[] {
  const lines = readFileSync(join(repo, "fdroid/io.github.buerlino.pascaline.yml"), "utf8").split("\n");
  const start = lines.findIndex((l) => /^\s+prebuild:\s*$/.test(l));
  expect(start).toBeGreaterThan(-1);
  const out: string[] = [];
  for (const l of lines.slice(start + 1)) {
    const m = /^\s+-\s+(.*\S)\s*$/.exec(l);
    if (m) out.push(m[1] as string);
    else if (!/^\s*#/.test(l)) break;
  }
  return out;
}

describe("F-Droid recipe checks find/factors.yaml (A60)", () => {
  const steps = prebuild();
  const at = (re: RegExp): number => steps.findIndex((s) => re.test(s));

  it("runs refresh-factors.mjs after the qalc build and npm ci, before npm run index", () => {
    const qalc = at(/^engine\/qalc\/build-wasm\.sh dev$/);
    const ci = at(/^npm ci$/);
    const refresh = at(/refresh-factors\.mjs/);
    const index = at(/^npm run index$/);
    expect(qalc).toBeGreaterThan(-1);
    expect(ci).toBeGreaterThan(-1);
    expect(index).toBeGreaterThan(-1);
    expect(refresh, "no refresh-factors.mjs step in prebuild").toBeGreaterThan(-1);
    expect(refresh).toBeGreaterThan(qalc);
    expect(refresh).toBeGreaterThan(ci);
    expect(refresh).toBeLessThan(index);
  });

  it("the step is a plain `node` call of the script (a difference exits 1 and fails the build)", () => {
    expect(steps[at(/refresh-factors\.mjs/)]).toMatch(/^node \.\.\/tools\/find-index\/refresh-factors\.mjs$/);
  });
});
