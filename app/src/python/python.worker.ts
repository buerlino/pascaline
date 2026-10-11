// SPDX-License-Identifier: GPL-3.0-or-later
// Web Worker hosting one MicroPython instance (D6). Cancel = the main thread terminates us.
import type { PyRequest, PyResponse } from "./protocol.ts";
import { PyHost, type LoadMicroPython } from "./pyHost.ts";

const post = (m: PyResponse) => (self as unknown as Worker).postMessage(m);

let host: Promise<PyHost> | undefined;
let nextRid = 1;
const hostPending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function hostCall(fn: string, args: unknown[]): Promise<unknown> {
  const rid = nextRid++;
  return new Promise((resolve, reject) => {
    hostPending.set(rid, { resolve, reject });
    post({ type: "host", rid, fn, args });
  });
}

async function load(baseUrl: string): Promise<PyHost> {
  // Absolute URL: Vite's dev server rewrites root-relative dynamic imports (adds ?import), which breaks public/ files.
  const url = new URL(`${baseUrl}python/micropython.mjs`, self.location.href).href;
  const { loadMicroPython } = (await import(/* @vite-ignore */ url)) as { loadMicroPython: LoadMicroPython };
  return PyHost.load(loadMicroPython, { output: (o) => post({ type: "out", ...o }), hostCall, graphics: (batch) => post({ type: "gfx", batch }) }, new URL("micropython.wasm", url).href);
}

self.onmessage = async (ev: MessageEvent<PyRequest>) => {
  const m = ev.data;
  if (m.type === "hostReply") {
    const p = hostPending.get(m.rid);
    hostPending.delete(m.rid);
    if (m.ok) p?.resolve(m.value);
    else p?.reject(new Error(m.error ?? "error"));
    return;
  }
  try {
    if (m.type === "init") {
      const t0 = performance.now();
      host = load(m.baseUrl);
      await host;
      post({ type: "ready", id: m.id, loadMs: performance.now() - t0 });
      return;
    }
    if (!host) throw new Error("python worker: not initialised");
    const h = await host;
    const result = m.type === "run" ? await h.run(m.code, m.file) : await h.shell(m.line);
    post({ type: "done", id: m.id, result });
    // The main thread replaces a broken runtime (see PyHost.broken).
    if (h.broken) post({ type: "fatal", id: 0, message: "python runtime failed" });
  } catch (e) {
    post({ type: "fatal", id: m.id, message: e instanceof Error ? e.message : String(e) });
  }
};
