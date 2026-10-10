// SPDX-License-Identifier: GPL-3.0-or-later
// Copy engine builds into public/engine/ (gitignored). Source build is required; prebuilt is optional.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const dest = join(root, "spike/app/public/engine");
const variant = process.env.GIAC_VARIANT ?? "base-solvers";
const src = join(root, "engine/giac/_out", variant);
if (!existsSync(join(src, "giac.wasm"))) {
  console.error(`missing ${src}/giac.wasm, run: WITH_SOLVERS=1 engine/giac/build-wasm.sh`);
  process.exit(1);
}
mkdirSync(join(dest, "source"), { recursive: true });
for (const f of ["giac.mjs", "giac.wasm"]) cpSync(join(src, f), join(dest, "source", f));
const prebuilt = join(root, "spike/prebuilt/giacwasm.js");
if (existsSync(prebuilt)) {
  mkdirSync(join(dest, "prebuilt"), { recursive: true });
  cpSync(prebuilt, join(dest, "prebuilt/giacwasm.js"));
}
console.log(`engine: source=${variant}${existsSync(prebuilt) ? " prebuilt=yes" : ""}`);
