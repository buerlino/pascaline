// SPDX-License-Identifier: GPL-3.0-or-later
// Copy the Giac engine build into app/public/engine/ (gitignored), where giac.worker.ts loads it.
// Source: $GIAC_OUT (e.g. the main checkout's build when working in a git worktree), else
// engine/giac/_out/$GIAC_VARIANT (default gsl) in this checkout. Build it with engine/giac/build-wasm.sh.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(app, "..");
const src = process.env.GIAC_OUT ?? join(root, "engine/giac/_out", process.env.GIAC_VARIANT ?? "gsl");
const dest = join(app, "public/engine");
const files = ["giac.mjs", "giac.wasm"];
for (const f of files) {
  if (!existsSync(join(src, f))) {
    console.error(`engine:copy: missing ${join(src, f)}; run engine/giac/build-wasm.sh or set GIAC_OUT`);
    process.exit(1);
  }
}
mkdirSync(dest, { recursive: true });
for (const f of files) {
  const from = join(src, f);
  const to = join(dest, f);
  // Skip unchanged files so `npm run dev` stays instant.
  if (existsSync(to) && statSync(to).size === statSync(from).size && statSync(to).mtimeMs >= statSync(from).mtimeMs) continue;
  copyFileSync(from, to);
}
console.log(`engine:copy: ${src} -> public/engine/`);

// MicroPython for the Python app (loaded lazily by src/python/python.worker.ts) -> public/python/.
// Source: $PYTHON_OUT, else python/_out/dev in this checkout. Optional: the app starts without it.
// Copied only when missing or older than the source, so the build that build.sh puts there (a fresh `cp`) stays.
const pySrc = process.env.PYTHON_OUT ?? join(root, "python/_out/dev");
const pyDest = join(app, "public/python");
const pyFiles = ["micropython.mjs", "micropython.wasm"];
const stale = (f) => !existsSync(join(pyDest, f)) || statSync(join(pySrc, f)).mtimeMs > statSync(join(pyDest, f)).mtimeMs;
if (pyFiles.every((f) => existsSync(join(pySrc, f)))) {
  if (pyFiles.some(stale)) {
    mkdirSync(pyDest, { recursive: true });
    for (const f of pyFiles) copyFileSync(join(pySrc, f), join(pyDest, f));
    console.log(`engine:copy: ${pySrc} -> public/python/`);
  }
} else if (!existsSync(join(pyDest, "micropython.mjs"))) {
  console.warn(`engine:copy: no MicroPython in ${pySrc} (python/build-micropython.sh dev, or set PYTHON_OUT); the Python app won't load`);
}
