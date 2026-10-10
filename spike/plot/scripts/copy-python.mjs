// SPDX-License-Identifier: GPL-3.0-or-later
// Copies the (gitignored) MicroPython build and Pyodide pack files into public/ so the Capacitor APK carries them.
// Run before `vite build`. Missing sources are skipped with a message.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const plot = path.join(here, "..");
// a worktree has its own spike/python; fall back to the main checkout's copy
const mainRoot = path.resolve(plot, "../..").split(`${path.sep}.claude${path.sep}worktrees${path.sep}`)[0];
const find = (rel) => [path.join(plot, "../python", rel), path.join(mainRoot, "spike/python", rel)].find((p) => fs.existsSync(p));

const mpSrc = find("_out/standard");
if (mpSrc) {
  fs.mkdirSync(path.join(plot, "public/mpy"), { recursive: true });
  for (const f of ["micropython.mjs", "micropython.wasm"]) fs.copyFileSync(path.join(mpSrc, f), path.join(plot, "public/mpy", f));
  console.log("copied MicroPython from", mpSrc);
} else console.log("no MicroPython build found (spike/python/build-micropython.sh)");

const pySrc = find("_build/pyodide");
if (pySrc) {
  const lock = JSON.parse(fs.readFileSync(path.join(pySrc, "pyodide-lock.json"), "utf8")).packages;
  const closure = (n, s = new Set()) => { if (!s.has(n)) { s.add(n); lock[n].depends.forEach((d) => closure(d, s)); } return s; };
  const wanted = (process.env.PYODIDE_PKGS ?? "numpy,sympy").split(",");
  const files = ["pyodide.asm.wasm", "pyodide.asm.mjs", "pyodide.mjs", "python_stdlib.zip", "pyodide-lock.json"];
  for (const w of wanted) for (const n of closure(w)) files.push(lock[n].file_name);
  fs.mkdirSync(path.join(plot, "public/pyodide"), { recursive: true });
  for (const f of new Set(files)) fs.copyFileSync(path.join(pySrc, f), path.join(plot, "public/pyodide", f));
  console.log("copied Pyodide core +", wanted.join(","));
} else console.log("no Pyodide pack found (see spike/python/NOTES.md)");
