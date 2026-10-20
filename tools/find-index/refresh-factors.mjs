#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Developer tool, never run by a build (A21): recomputes the numbers of find/factors.yaml from the libqalculate build
// run in Node and prints the difference to the file. Empty on libqalculate 5.13.1. Read-only: it never writes the file.
//
//   node tools/find-index/refresh-factors.mjs        # QALC_OUT = the qalc build (default engine/qalc/_out/dev;
//                                                    #   engine/qalc/build-wasm.sh dev), PASCALINE_QALC_DL_DIR the tarball cache
//
// A change to a row needs a case in find/units.yaml (a checks entry: the exact definition or CODATA) or the owner's OK,
// and is made by hand in find/factors.yaml with its source and note. A row with a `qalc` field is one where our value
// replaces a known qalc value (libqalculate#1043-1045): the field holds what qalc gives, and a diff there means qalc
// changed (fixed upstream, perhaps: then drop `qalc` and take the new value as the row).
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { REPO, fail, problems, qalcXml } from "./state.mjs";
import { loadQalc, unitItems } from "./units-items.mjs";

const YAML = createRequire(join(REPO, "app/package.json"))("yaml");
const loadYaml = (rel) => YAML.parse(readFileSync(join(REPO, rel), "utf8")) ?? {};
const qalcDir = resolve(process.env.QALC_OUT ?? join(REPO, "engine/qalc/_out/dev"));
if (!existsSync(join(qalcDir, "qalc.mjs"))) throw new Error(`no qalc build in ${qalcDir} (engine/qalc/build-wasm.sh dev, or set QALC_OUT)`);

const file = loadYaml("find/factors.yaml");
const { rows } = await unitItems({ q: await loadQalc(qalcDir), xml: qalcXml(), ours: loadYaml("find/units.yaml"), aliases: loadYaml("find/aliases.yaml") });
if (problems.length) { console.error(`refresh-factors: ${problems.length} problem(s):\n  ${problems.join("\n  ")}`); process.exit(1); }

const diff = [];
const FIELDS = { prefixes: ["si"], units: ["si", "dim", "sym"], constants: ["value", "unc", "dim"] };
for (const [section, computed] of [["prefixes", rows.prefixes], ["units", rows.units], ["constants", rows.consts]]) {
  const have = file[section] ?? {};
  for (const id of Object.keys(computed)) if (!have[id]) diff.push(`+ ${section}.${id}: ${JSON.stringify(computed[id])}`);
  for (const id of Object.keys(have)) {
    if (!computed[id]) { diff.push(`- ${section}.${id}: qalc no longer gives it`); continue; }
    for (const k of FIELDS[section]) {
      // a row that replaces qalc's value keeps what qalc gives in `qalc` (si, value) and `qalcUnc`
      const h = have[id];
      const kept = k === "si" || k === "value" ? (h.qalc ?? h[k]) : k === "unc" ? (h.qalcUnc ?? h.unc) : h[k];
      const want = kept === undefined ? undefined : String(kept);
      const got = computed[id][k] === undefined ? undefined : String(computed[id][k]);
      if (want !== got) diff.push(`~ ${section}.${id}.${k}: file ${want}, qalc ${got}`);
    }
  }
}
console.log(diff.length ? diff.join("\n") : "refresh-factors: no difference (libqalculate 5.13.1)");
process.exit(diff.length ? 1 : 0);
