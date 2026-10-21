// SPDX-License-Identifier: GPL-3.0-or-later
// G61: the sweep's host in a worker thread, as the app keeps one engine worker. It answers {id, giac, angle, digits} with the Home
// result's shown facts. The main thread kills it when a deadline passes (a hang is a finding) and starts a new one.
import { parentPort } from "node:worker_threads";
import { EngineHost } from "../../../app/src/engine/host.ts";
import { loadNodeGiac } from "../../../app/src/engine/nodeGiac.ts";
import { defaultHomeSettings, pasdegCommand } from "../../../app/src/engine/homeEval.ts";
import { markOf } from "../../../app/src/engine/format.ts";
import type { Shown } from "./judge.ts";

export interface Job {
  id: number;
  giac: string;
  angle: "rad" | "deg";
  digits: number;
}

const { giac } = await loadNodeGiac();
giac.eval(pasdegCommand("rad"));
const host = new EngineHost(giac);
parentPort!.postMessage({ ready: true });
parentPort!.on("message", (job: Job) => {
  const settings = { ...defaultHomeSettings, angle: job.angle, digits: job.digits, workDigits: Math.max(30, job.digits + 10) };
  const r = host.home(job.giac, settings).result;
  const m = r.ok && r.value ? markOf(r, { format: "STD", digits: job.digits }) : null;
  const shown: Shown = { ok: r.ok, display: r.display, ...(r.error ? { error: r.error } : {}), ...(r.value && !r.items ? { value: r.value } : {}), ...(m ? { mark: m.mark, ...(m.n !== undefined ? { n: m.n } : {}) } : {}) };
  parentPort!.postMessage({ id: job.id, shown });
});
