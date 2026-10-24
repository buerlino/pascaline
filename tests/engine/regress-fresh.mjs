// SPDX-License-Identifier: GPL-3.0-or-later
// G108: the committed tools/giac-regress/*.cas equal what export.mjs builds from the golden cases now, so a new golden case cannot drift.
import { readFileSync } from "node:fs";
import { build, loadCases } from "../../tools/giac-regress/export.mjs";

const r = build(loadCases());
const bad = [];
for (const [name, text] of [["check", r.check], ["known", r.known], ["patched", r.patched]]) {
  if (readFileSync(new URL(`../../tools/giac-regress/pascaline-${name}.cas`, import.meta.url), "utf8") !== text) bad.push(`pascaline-${name}.cas`);
}
if (bad.length) {
  console.log(`STALE ${bad.join(", ")}: run node tools/giac-regress/export.mjs and commit`);
  process.exit(1);
}
console.log(`fresh: check ${r.nCheck}, known ${r.nKnown}, patched ${r.nPatched}`);
