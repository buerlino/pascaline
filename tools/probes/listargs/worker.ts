// SPDX-License-Identifier: GPL-3.0-or-later
// G112: list-args.ts's engine in a worker thread, so a call that hangs or traps the wasm costs a restart, not the probe. A job is
// one name; the answer its verdict (sweep.ts), in the order the names come, on one engine (what one call leaves, the next sees).
import { parentPort } from "node:worker_threads";
import { loadNodeGiac } from "../../../app/src/engine/nodeGiac.ts";
import { verdict, type Verdict } from "./sweep.ts";

export interface Job {
  id: number;
  name: string;
  takesList: boolean;
}
export type Answer = { id: number; v: Verdict } | { id: number; crash: string };

const { giac } = await loadNodeGiac();
const port = parentPort!;
port.on("message", (j: Job) => {
  try {
    port.postMessage({ id: j.id, v: verdict((s) => giac.eval(s), j.name, j.takesList) } satisfies Answer);
  } catch (e) {
    port.postMessage({ id: j.id, crash: String(e).slice(0, 120) } satisfies Answer);
  }
});
port.postMessage("ready");
