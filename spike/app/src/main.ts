// SPDX-License-Identifier: GPL-3.0-or-later
// Spike page: a minimal REPL over MathEngine, plus window.spike for the Playwright benchmark.
import { WorkerEngine } from "./engine/workerEngine";
import { EngineCancelled, type EngineKind, type MathEngine } from "./engine/types";
import { mark } from "./marks";
import { runDeviceBench } from "./deviceBench";
import { runDeviceHome } from "./deviceHome";

mark("js-start", { timeOrigin: Math.round(performance.timeOrigin) });

const params = new URLSearchParams(location.search);
const kind: EngineKind = params.get("engine") === "prebuilt" ? "prebuilt" : "source";

const engine: MathEngine = new WorkerEngine(kind);
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const log = $("log");

function append(text: string, cls = ""): void {
  const line = document.createElement("div");
  line.textContent = text;
  if (cls) line.className = cls;
  log.append(line);
}

declare global {
  interface Window {
    spike: { engine: MathEngine; kind: EngineKind };
  }
}
window.spike = { engine, kind };

engine.ready().then(
  async (t) => {
    mark("engine-ready", { instantiateMs: t.instantiateMs, initMs: t.initMs, readyMs: t.readyMs });
    await engine.setSettings({ digits: 12, angle: "rad" });
    $("status").textContent = `${kind} engine ready in ${t.readyMs.toFixed(0)} ms (instantiate ${t.instantiateMs.toFixed(0)} ms)`;
    if (params.has("bench")) {
      await runDeviceBench(engine, (s) => ($("status").textContent += " | " + s));
    } else if (params.has("home")) {
      await runDeviceHome(engine, (s) => ($("status").textContent += " | " + s));
    } else {
      const r = await engine.eval("factor(x^4-1)");
      mark("first-result", { engineMs: r.engineMs, output: r.output });
    }
  },
  (e: unknown) => ($("status").textContent = `engine failed: ${String(e)}`),
);

$("form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const input = $<HTMLInputElement>("input").value;
  append(`> ${input}`);
  try {
    const r = await engine.eval(input);
    append(`${r.output}   (${r.engineMs.toFixed(1)} ms)`, r.ok ? "" : "err");
  } catch (e) {
    append(e instanceof EngineCancelled ? "cancelled" : String(e), "err");
  }
});

$("cancel").addEventListener("click", async () => {
  const t = await engine.cancel();
  append(`engine restarted in ${t.readyMs.toFixed(0)} ms (replay ${t.replayMs.toFixed(1)} ms)`);
});
