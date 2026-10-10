// SPDX-License-Identifier: GPL-3.0-or-later
// Pyodide ("Python+") start time on the device, from local files only (public/pyodide/, no CDN).
// ?pkgs=numpy,sympy (default numpy); ?pkgs= for the core only.
import { mark } from "./marks";

const out = document.getElementById("out") as HTMLElement;
const params = new URLSearchParams(location.search);
const pkgs = (params.get("pkgs") ?? "numpy").split(",").filter(Boolean);
mark("pyo-js-start", { pkgs: pkgs.join("+") || "core" });
interface Pyodide { loadPackage: (p: string[]) => Promise<unknown>; runPythonAsync: (c: string) => Promise<unknown> }
const t0 = performance.now();
const mod = (await import(/* @vite-ignore */ new URL("./pyodide/pyodide.mjs", location.href).href)) as {
  loadPyodide: (o: { indexURL: string; checkAPIVersion: boolean }) => Promise<Pyodide>;
};
const py = await mod.loadPyodide({ indexURL: new URL("./pyodide/", location.href).href, checkAPIVersion: false });
const t1 = performance.now();
if (pkgs.length) await py.loadPackage(pkgs);
const t2 = performance.now();
const code = pkgs.map((p) => `import ${p}`).join("\n") || "1+1";
await py.runPythonAsync(code);
const t3 = performance.now();
mark("pyo-ready", { coreMs: t1 - t0, packagesMs: t2 - t1, importMs: t3 - t2, totalMs: t3 - t0 });
out.textContent = `pyodide core ${(t1 - t0).toFixed(0)} ms, packages ${(t2 - t1).toFixed(0)} ms, import ${(t3 - t2).toFixed(0)} ms`;
