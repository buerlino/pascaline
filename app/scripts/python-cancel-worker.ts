// SPDX-License-Identifier: GPL-3.0-or-later
// Golden stage python, kind cancel: runs `code` in MicroPython inside a worker thread so the runner can
// terminate it, as the app's Cancel terminates the Python Web Worker. Each worker thread is its own JS
// realm, which MicroPython needs: upstream's JS proxies use one global Module per realm.
// Messages: "ready", "out:<stdout text>", "finished ok" | "finished <Type>: <message>".
import { parentPort, workerData } from "node:worker_threads";
import { loadNodePyHost } from "../src/python/nodePython.ts";

const { code, mjs } = workerData as { code: string; mjs: string };
const py = await loadNodePyHost({ output: (o) => o.stream === "stdout" && parentPort?.postMessage(`out:${o.text}`), hostCall: async () => null }, mjs);
parentPort?.postMessage("ready");
const r = await py.run(code);
parentPort?.postMessage(r.ok ? "finished ok" : `finished ${r.error?.type}: ${r.error?.message}`);
