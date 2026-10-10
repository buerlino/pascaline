// SPDX-License-Identifier: GPL-3.0-or-later
// Smoke test: load Parisse's prebuilt giacwasm.js (spike/prebuilt/, gitignored) in Node.
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "../prebuilt/giacwasm.js");
const t0 = performance.now();
const src = fs.readFileSync(file, "utf8");
const Module = { print: () => {}, printErr: () => {} };
Module.onRuntimeInitialized = () => {
  const tReady = performance.now();
  const caseval = Module.cwrap("caseval", "string", ["string"]);
  console.log("ready ms", (tReady - t0).toFixed(0));
  for (const s of process.argv.slice(2)) {
    const a = performance.now();
    const r = caseval(s);
    console.log(JSON.stringify(s), "=>", r, `(${(performance.now() - a).toFixed(1)} ms)`);
  }
};
new Function("Module", "require", "__dirname", "__filename", src)(Module, require, path.dirname(file), file);
