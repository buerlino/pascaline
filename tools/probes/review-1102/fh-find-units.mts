// SPDX-License-Identifier: GPL-3.0-or-later
// fh probe (night review 2026-11-02): engineer queries for units and constants (mechanical, electrical, thermal) against
// the generated Find index with the real ranking (rank.ts), as queries.test.ts runs it. Prints the top 3 per query.
//   env -C <worktree>/app npx tsx <this file> [query ...]
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
const W = new URL("../../..", import.meta.url).pathname.replace(/\/$/, ""); // the checkout this file is in
const { prepare, search } = await import(join(W, "app/src/find/rank.ts"));
const files = [process.env.FIND_INDEX_JSON ?? "", join(W, "app/src/find/_gen/find-index.json")];
const file = files.find((f) => existsSync(f));
if (!file) { console.error("no index"); process.exit(2); }
const items = JSON.parse(readFileSync(file, "utf8"));
const index = prepare(items);
const Q = process.argv.slice(2).length ? process.argv.slice(2) : [
  // electrical
  "VA", "kVA", "var", "kvar", "mAh", "dBV", "dBuV", "ohm m", "S/m", "Wb", "rms",
  // mechanical
  "Nmm", "N mm", "kNm", "lbf ft", "in lbf", "ft lbf", "N/mm", "kgf", "ksi", "MPa", "m3/h", "l/min", "Nm3", "rad/s",
  // thermal
  "W/(m K)", "W/m2K", "W/(m2 K)", "BTU/h", "kcal/h", "TR", "ton of refrigeration", "J/(kg K)", "degC", "K/W",
  // constants
  "g", "g0", "standard gravity", "R", "gas constant", "sigma", "Stefan", "k_B", "Boltzmann", "e0", "epsilon0", "mu0", "c", "h", "NA", "atm",
];
console.log(`index: ${file} (${items.length} items)`);
for (const q of Q) {
  const hits = search(index, q).slice(0, 3).map((h: { item: { id: string } }) => h.item.id);
  console.log(`${q.padEnd(22)} ${hits.join("  ") || "(none)"}`);
}
