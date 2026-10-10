// SPDX-License-Identifier: GPL-3.0-or-later
// Copy engine builds into public/engine/ (gitignored). Source build is required; prebuilt is optional.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const dest = join(root, "spike/app/public/engine");
const variant = process.env.GIAC_VARIANT ?? "gsl";
// GIAC_OUT points at another checkout's build output (e.g. from a git worktree).
const src = process.env.GIAC_OUT ?? join(root, "engine/giac/_out", variant);
if (!existsSync(join(src, "giac.wasm"))) {
  console.error(`missing ${src}/giac.wasm, run: engine/giac/build-wasm.sh`);
  process.exit(1);
}
mkdirSync(join(dest, "source"), { recursive: true });
for (const f of ["giac.mjs", "giac.wasm"]) cpSync(join(src, f), join(dest, "source", f));
const prebuilt = join(root, "spike/prebuilt/giacwasm.js");
if (existsSync(prebuilt)) {
  mkdirSync(join(dest, "prebuilt"), { recursive: true });
  cpSync(prebuilt, join(dest, "prebuilt/giacwasm.js"));
}
// Benchmark cases for the on-device runner (src/deviceBench.ts).
const cases = parse(readFileSync(join(root, "spike/bench/cases.yaml"), "utf8")).cases;
writeFileSync(join(dest, "../cases.json"), JSON.stringify(cases));
// Exact-first Home cases for src/deviceHome.ts.
const homeCases = parse(readFileSync(join(root, "spike/home/cases.yaml"), "utf8")).cases;
writeFileSync(join(dest, "../home-cases.json"), JSON.stringify(homeCases));
console.log(`engine: source=${variant}${existsSync(prebuilt) ? " prebuilt=yes" : ""}`);
