// SPDX-License-Identifier: GPL-3.0-or-later
// R59: the library import and export through the Calc port, on the real engine in this thread (the worker's request
// handler, as workerEngine.test.ts runs it): the format for your AI's own worked example imports and its tests pass, so
// the copied format never lies; an older file's stamp is brought up to date with its lines kept; a refusal after the
// engine was changed, or an import that throws partway, restarts it from the unchanged log; a clash defines nothing;
// the export imports again unchanged.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EngineCalc } from "../calc/engine.ts";
import type { LibraryJobs } from "../calc/port.ts";
import { jobs } from "../calc/library.ts";
import { createRequestHandler } from "../engine/host.ts";
import { giacAvailable, loadNodeGiac } from "../engine/nodeGiac.ts";
import type { Request, Response } from "../engine/protocol.ts";
import { WorkerEngine, type WorkerLike } from "../engine/workerEngine.ts";
import { LIB_MAX_BYTES, type ImportResult } from "../engine/library.ts";
import { defaultCasSettings } from "../engine/types.ts";
import { DATA_VERSION } from "../state/storage.ts";
import { aiFormat, formatExample, importFile, READ_CAP, type LibraryHost } from "./libraryJobs.ts";

class InProcessWorker implements WorkerLike {
  onmessage: ((ev: { data: Response }) => void) | null = null;
  onerror: ((ev: { message?: string }) => void) | null = null;
  terminated = false;
  /** Replies of requests the test sent itself, not the engine's caller. */
  protected hidden = new Set<number>();
  protected handle = createRequestHandler(
    () => loadNodeGiac(),
    (r) => setTimeout(() => !this.terminated && !this.hidden.has(r.id) && this.onmessage?.({ data: r }), 0),
  );
  postMessage(msg: Request): void {
    setTimeout(() => void this.handle(msg), 0);
  }
  terminate(): void {
    this.terminated = true;
  }
}

/** The first worker's first library import throws after one define: it defines beam_M as the import would, then
 *  answers `fatal` without `memory` (a JS throw in the handler), which WorkerEngine only rejects. */
class ThrowingImportWorker extends InProcessWorker {
  static armed = true;
  override postMessage(msg: Request): void {
    if (msg.type !== "library" || !ThrowingImportWorker.armed) return super.postMessage(msg);
    ThrowingImportWorker.armed = false;
    const inner = -1;
    this.hidden.add(inner);
    setTimeout(async () => {
      await this.handle({ id: inner, type: "cas", input: "beam_M(q,L):=q*L^2/8", settings: { ...defaultCasSettings } });
      if (!this.terminated) this.onmessage?.({ data: { id: msg.id, type: "fatal", message: "boom partway" } });
    }, 0);
  }
}

const settings = { digits: 12, angle: "rad", format: "std" } as const;
/** The port's calls (cas, names) and its library jobs, on one engine. */
const fresh = (make: () => InProcessWorker = () => new InProcessWorker()): { calc: EngineCalc & LibraryJobs; engine: WorkerEngine; workers: () => number } => {
  let n = 0;
  const engine = new WorkerEngine({ createWorker: () => (n++, make()) });
  const port = new EngineCalc(engine);
  const calc = Object.assign(port, jobs(port.engine));
  return { calc, engine, workers: () => n };
};
const ok = (r: ImportResult): Extract<ImportResult, { ok: true }> => {
  if (!r.ok) throw new Error(r.error);
  return r;
};
const beams = readFileSync(new URL("../../../tools/probes/library/beams.txt", import.meta.url));

describe.skipIf(!giacAvailable())("the library through the Calc port (real Giac)", () => {
  it("the format for your AI: its worked example imports, its five tests pass, and it names this version (derived)", { timeout: 30_000 }, async () => {
    const format = aiFormat();
    expect(format.split("\n")[0]).toBe(`# Pascaline file formats (text 1, for files of version ${DATA_VERSION})`);
    expect(format).not.toMatch(/SPDX|<!--|\{version\}/);
    const example = formatExample(format);
    expect(example.split("\n")[0]).toBe(`// pascaline library ${DATA_VERSION}`);
    const { calc } = fresh();
    const r = ok((await calc.importLibrary(example, false)).result);
    expect(r.plan.added).toEqual(["beam_M", "sumpow", "middle", "g0"]);
    expect(r.tests).toBe(5);
    expect((await calc.cas("middle([1,2,3,4])", settings)).text).toBe("5/2"); // G54: the median of 1,2,3,4 (derived)
    // the e2e's one-line library (library.spec.ts): med is no built-in
    ok((await calc.importLibrary("// pascaline library 4\n// The median of a list\nmed(l):=median(l)\n// test: med([1,2,3,4]) == 5/2\n", false)).result);
  });

  it("a version-1 file (beams.txt): the stamp is brought up to date, the lines stay the file's", { timeout: 30_000 }, async () => {
    const { calc } = fresh();
    const reply = await calc.importLibrary(new Uint8Array(beams), false);
    expect(ok(reply.result).plan.added).toEqual(["beam_M", "beam_w", "sumpow", "g0"]);
    expect(reply.lines).toEqual([
      { name: "beam_M", line: 6 },
      { name: "beam_w", line: 11 },
      { name: "sumpow", line: 15 },
      { name: "g0", line: 24 },
    ]);
    expect((await calc.names()).find((u) => u.name === "beam_M")?.desc).toMatch(/^Maximum bending moment/);
  });

  it("a version-2 file is migrated on its way to the worker: pasexp is gone, ph is stored with exp, its test passes (derived: exp(iπ) = −1)", { timeout: 30_000 }, async () => {
    const { calc } = fresh();
    const reply = await calc.importLibrary("// pascaline library 2\n// phasor\nph(w):=pasexp(i*w)\n// test: simplify(ph(pi)+1)==0\n", false);
    const r = ok(reply.result);
    expect(r.plan.added).toEqual(["ph"]);
    expect(r.tests).toBe(1);
    expect(reply.lines).toEqual([{ name: "ph", line: 3 }]);
    const cmds = r.log.find((e) => e.name === "ph")!.cmds.join("\n");
    expect(cmds).toMatch(/\bexp\(/);
    expect(cmds).not.toMatch(/pasexp/);
    expect((await calc.cas("ph(pi)", settings)).text).toBe("-1");
  });

  it("refuses a bad text whole, with its line, before the engine sees it (not UTF-8 too)", { timeout: 30_000 }, async () => {
    const { calc } = fresh();
    const r = (await calc.importLibrary("// pascaline library 4\n// fine\nokfn(x):=x+1\nassume(x>0)\n", false)).result;
    expect(r).toMatchObject({ ok: false, line: 4, dirty: false });
    expect(await calc.names()).toEqual([]);
    const bad = (await calc.importLibrary(new Uint8Array([0x2f, 0x2f, 0xff]), false)).result;
    expect(bad).toMatchObject({ ok: false, line: 0, error: "the file is not UTF-8 text" });
  });

  it("a picked file over the limit is read only to one byte past it, and refused as over the limit", { timeout: 30_000 }, async () => {
    expect(READ_CAP).toBe(LIB_MAX_BYTES + 1);
    const { calc } = fresh();
    const said: string[] = [];
    const big = new File([`// pascaline library 4\n${"// x\n".repeat(80_000)}`], "big.txt");
    const host = { jobs: () => calc, say: (s: string) => void said.push(s), refresh: async () => {}, showMenu: () => {} } as unknown as LibraryHost;
    await importFile(host, big);
    expect(said).toEqual(["Library refused, nothing changed: the file is over 256 kB"]);
  });

  it("a failing test: every failure with its line, and the engine restarts from the unchanged log", { timeout: 30_000 }, async () => {
    const { calc, workers } = fresh();
    await calc.cas("keep:=7", settings);
    const r = (await calc.importLibrary("// pascaline library 4\n// twice\ntw(x):=2*x\n// test: tw(2) == 4\n// test: tw(3) == 7\n// test: tw(1) == 3\n", false)).result;
    expect(r).toMatchObject({ ok: false, dirty: true });
    expect(!r.ok && r.failures?.map((f) => f.line)).toEqual([5, 6]);
    expect(workers()).toBe(2); // restarted
    expect((await calc.cas("tw(2)", settings)).text).toBe("tw(2)");
    expect((await calc.cas("keep", settings)).text).toBe("7");
    expect((await calc.names()).map((u) => u.name)).toEqual(["keep"]);
  });

  it("an import that throws partway: the call rejects, the engine restarts, and the name it defined is gone", { timeout: 30_000 }, async () => {
    ThrowingImportWorker.armed = true;
    const { calc, workers } = fresh(() => new ThrowingImportWorker());
    await calc.cas("keep:=7", settings);
    await expect(calc.importLibrary(new Uint8Array(beams), false)).rejects.toThrow("boom partway");
    expect(workers()).toBe(2); // restarted
    expect((await calc.cas("beam_M(2,4)", settings)).text).toBe("beam_M(2,4)");
    expect((await calc.cas("keep", settings)).text).toBe("7");
    expect((await calc.names()).map((u) => u.name)).toEqual(["keep"]);
  });

  it("a clash: listed with nothing defined; replace imports it", { timeout: 30_000 }, async () => {
    const { calc } = fresh();
    await calc.cas("beam_M(q,L):=q*L", settings);
    const first = await calc.importLibrary(new Uint8Array(beams), false);
    expect(first.result).toMatchObject({ ok: false, clashes: ["beam_M"], dirty: false });
    expect((await calc.cas("beam_M(2,4)", settings)).text).toBe("8");
    expect((await calc.names()).map((u) => u.name)).toEqual(["beam_M"]);
    const again = ok((await calc.importLibrary(new Uint8Array(beams), true)).result);
    expect(again.plan.replaced).toEqual(["beam_M"]);
    expect((await calc.cas("beam_M(2,4)", settings)).text).toBe("4");
  });

  it("the export imports again with every name unchanged, and exports the same text", { timeout: 30_000 }, async () => {
    const a = fresh();
    ok((await a.calc.importLibrary(new Uint8Array(beams), false)).result);
    const out = await a.calc.exportLibrary();
    expect(out.text.startsWith(`// pascaline library ${DATA_VERSION}\n`)).toBe(true);
    expect(out.skipped).toEqual([]);
    const same = ok((await a.calc.importLibrary(out.text, false)).result);
    expect(same.plan).toEqual({ added: [], same: ["beam_M", "beam_w", "sumpow", "g0"], replaced: [] });
    const b = fresh();
    ok((await b.calc.importLibrary(out.text, false)).result);
    expect((await b.calc.exportLibrary()).text).toBe(out.text);
  });
});
