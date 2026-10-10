// SPDX-License-Identifier: GPL-3.0-or-later
// Pyodide ("Python+" pack) start-time and size check in Node, all from local files (no CDN).
// usage: node pyodide-node-bench.mjs [runs]    needs _build/pyodide/ (see NOTES.md)
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, "_build", "pyodide");
const runs = Number(process.argv[2] ?? 5);
const { loadPyodide } = await import(pathToFileURL(path.join(dir, "pyodide.mjs")).href);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

const rows = [];
let loaded = [];
for (let i = 0; i < runs + 1; i++) {
  const t0 = performance.now();
  const py = await loadPyodide({ indexURL: dir + "/", stdout: () => {}, stderr: () => {}, checkAPIVersion: false });
  const t1 = performance.now();
  py.runPython("1+1");
  const t2 = performance.now();
  const pk = await py.loadPackage((process.env.PKGS ?? "numpy,sympy").split(",").filter(Boolean), { messageCallback: (m) => { if (i === 1) loaded.push(m); } });
  const t3 = performance.now();
  await py.runPythonAsync(process.env.CODE ?? "import numpy as np, sympy as sp\nx=sp.Symbol('x')\nr=sp.factor(x**2-1)\nn=float(np.linalg.det(np.array([[1.,2],[3,4]])))");
  const t4 = performance.now();
  if (i > 0) rows.push({ core: t1 - t0, firstPy: t2 - t1, packages: t3 - t2, importAndUse: t4 - t3, total: t4 - t0 });
  if (i === 1) console.log("packages loaded:", pk.map((p) => p.name).join(", "));
}
for (const k of Object.keys(rows[0])) console.log(k.padEnd(12), `median ${median(rows.map((r) => r[k])).toFixed(0)} ms`);
console.log("runs:", runs);
