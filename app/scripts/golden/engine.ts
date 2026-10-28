// SPDX-License-Identifier: GPL-3.0-or-later
// stages interrupt, steps, flags and regress
import { spawnSync } from "node:child_process";
import { SPEED_KNOWN, speedFindings } from "../golden-speed.ts";
import { describe as describeFinding } from "../golden-compare.ts";
import { root, mjs, cases, report } from "./lib.ts";

export function stageInterrupt(): void {
  const r = spawnSync(process.execPath, [`${root}tests/engine/interrupt-test.mjs`], {
    env: { ...process.env, GIAC_MJS: mjs },
    encoding: "utf8",
    timeout: 300_000,
  });
  const out = `${r.stdout}${r.stderr}`.trim();
  report("interrupt", r.status === 0, out.split("\n").slice(-3).join(" | "));
}

export async function stageSteps(): Promise<void> {
  const r = spawnSync(process.execPath, [`${root}tests/engine/step-budget-test.mjs`], { env: { ...process.env, GIAC_MJS: mjs }, encoding: "utf8", timeout: 300_000 });
  const canary = `${r.stdout}${r.stderr}`.trim().split("\n").slice(-3).join(" | ");
  const { findings, known, records } = await speedFindings(8, mjs);
  for (const f of known) console.log(`  steps known (${SPEED_KNOWN[`${f.stage}/${f.id}`]}): ${describeFinding(f)}`);
  for (const f of findings) console.log(`  steps ${describeFinding(f)}`);
  report("steps", r.status === 0 && findings.length === 0, `${canary} | ${records} cases, clock ×1 and ×8: ${findings.length} new findings, ${known.length} known`);
}

export function stageFlags(): void {
  // G102: ctx-canary.ts sets each of bridge-1's fields and reads it back with Giac's own getter (needs the engine);
  // G92: assume-canary.ts, raw Giac still leaves the assumptions assumed.ts puts back (needs the engine);
  // G75: tanh-test.ts (needs the engine) and patch-canary.ts (the tarball) for patch 0003; G60: mpfr-pi-test.ts, 0005;
  // G96: reim-test.ts, 0006; G111: support-test.ts, 0007 and 0008;
  // A19: memcap-test.mjs (the 1 GB cap of build-wasm.sh; a hog job ends and a fresh instance works);
  // G77: canaries.mjs (S17's workaround rows on the engine) and fetch-test.mjs (the pin's .dsc check, no network)
  const runs = ["flags-canary.ts", "ctx-canary.ts", "assume-canary.ts", "tanh-test.ts", "mpfr-pi-test.ts", "reim-test.ts", "support-test.ts", "patch-canary.ts", "canaries.mjs", "fetch-test.mjs", "memcap-test.mjs"].map((f) =>
    spawnSync(process.execPath, [`${root}tests/engine/${f}`], { env: { ...process.env, GIAC_MJS: mjs }, encoding: "utf8", timeout: 120_000 }),
  );
  const out = runs.map((r) => `${r.stdout}${r.stderr}`.trim().split("\n").slice(-3).join(" | ")).join(" | ");
  report("flags", runs.every((r) => r.status === 0), out);
  stageRegress();
  stageGiacCheck();
}

/** A19: Giac's own check/ suite (tools/probes/giac-check.mjs) on this build, against tests/golden/giaccheck-known.yaml.
 *  The release build runs the same stage: GIAC_OUT=engine/giac/_out/release npm run golden. */
export function stageGiacCheck(): void {
  const t0 = performance.now();
  const r = spawnSync(process.execPath, [`${root}tools/probes/giac-check.mjs`], { env: { ...process.env, GIAC_MJS: mjs }, encoding: "utf8", timeout: 600_000 });
  const lines = `${r.stdout}${r.stderr}`.trim().split("\n");
  for (const l of lines.filter((x) => /^\s+(NEW|GONE) /.test(x))) console.log(`  giaccheck ${l.trim()}`);
  report("giaccheck", r.status === 0, `${(lines.pop() ?? "").replace(/^GIACCHECK (PASSED|FAILED): /, "")} (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
}

/** G108: the Giac regression files (tools/giac-regress) are what export.mjs builds now, and on our build every check line
 *  passes, every known line fails, every patched line passes (patches 0003, 0005, 0006, 0007, 0009, 0010, 0011, 0012, 0013, 0014). */
export function stageRegress(): void {
  const fresh = spawnSync(process.execPath, [`${root}tests/engine/regress-fresh.mjs`], { encoding: "utf8", timeout: 120_000 });
  const t0 = performance.now();
  const r = spawnSync(process.execPath, [`${root}tools/giac-regress/run.mjs`], { env: { ...process.env, GIAC_MJS: mjs }, encoding: "utf8", timeout: 600_000 });
  const secs = ((performance.now() - t0) / 1000).toFixed(0);
  const lines = `${r.stdout}${r.stderr}`.trim().split("\n");
  const counts = lines.filter((l) => /^pascaline-(check|known|patched)\.cas: \d+ passed/.test(l)).map((l) => l.replace(/^pascaline-/, "").replace(/\.cas: /, " ").replace(/, [\d.]+ s.*/, ""));
  const bad = lines.filter((l) => /^\s+(FAILS|PASSES) |DIFFERS/.test(l));
  for (const l of bad) console.log(`  regress ${l.trim()}`);
  report(
    "regress",
    r.status === 0 && fresh.status === 0,
    `Giac regression files (patches 0003, 0005, 0006, 0007, 0009, 0010, 0011, 0012, 0013, 0014): ${counts.join("; ")}, ${secs} s${fresh.status === 0 ? "" : `; ${`${fresh.stdout}${fresh.stderr}`.trim().split("\n").pop()}`}`,
  );
}
