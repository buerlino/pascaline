// SPDX-License-Identifier: GPL-3.0-or-later
// Node stand-in for the Giac Web Worker: answers {id, expr} with {id, result}.
import { parentPort, workerData } from "node:worker_threads";
const { default: createGiacModule } = await import(workerData.giacMjs);
globalThis.UI = { add_evalf: 0, js_bigint: 0, disable3d: -1, Datestart: Date.now() };
const M = await createGiacModule({ print: () => {}, printErr: () => {} });
M.cwrap("giac_init", "number", [])();
const evalS = M.cwrap("giac_eval", "string", ["string"]);
parentPort.postMessage({ ready: true });
parentPort.on("message", ({ id, expr }) => parentPort.postMessage({ id, result: evalS(expr) }));
