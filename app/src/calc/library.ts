// SPDX-License-Identifier: GPL-3.0-or-later
// R59: the library import and export behind the Calc port (EngineCalc loads this on the first call, so nothing of it is
// in the start chunk). An older stamp is brought up to date here (the migration steps are state/'s, G147); the reading,
// the check, the import and the export run in the worker (engine/library.ts importText, exportText), against the log
// as stored. A taken import's changes go into the log; a refusal that came after the engine was changed restarts it
// from the unchanged log, the path Cancel takes (archive/r10-connector.md 3.1).
import type { LibraryReply } from "../engine/library.ts";
import type { MathEngine } from "../engine/types.ts";
import type { Request, Response } from "../engine/protocol.ts";
import type { WorkerEngine } from "../engine/workerEngine.ts";
import { LIBRARY_FORMAT, upToDate } from "../state/libraryFormat.ts";
import type { LibraryJobs } from "./port.ts";

// Only type imports of the start chunk's modules: a value import of one makes Rolldown cut it out of the entry into a
// shared chunk, which the start chunk then loads as a file of its own (measured: engine/types.ts, +0.23 kB gzip).
type Body = Request extends infer R ? (R extends { type: "library" | "libraryExport" } ? Omit<R, "id" | "log"> : never) : never;
type Posting = MathEngine & Pick<WorkerEngine, "call" | "keep">;

/** The jobs on `engine`, the app's WorkerEngine (an engine without a worker has no library). A Cancel while one runs
 *  rejects it, and the caller says it did not import (views/libraryJobs.ts). */
export function jobs(engine: MathEngine): LibraryJobs {
  if (!("call" in engine && "keep" in engine)) throw new Error("no library in this engine");
  const worker = engine as Posting;
  /** A request against the log as stored (definitions() waits for the stored one). */
  const send = async (body: Body): Promise<Response> => worker.call({ ...body, log: [...(await worker.definitions())] } as Parameters<Posting["call"]>[0]);
  return {
    async importLibrary(input, replace): Promise<LibraryReply> {
      let r: Response;
      try {
        r = await send({ type: "library", input: upToDate(input), version: LIBRARY_FORMAT.version, replace });
      } catch (e) {
        // The worker's import threw partway (a `fatal` reply not marked dead, which does not restart it): the
        // definitions it already ran stay in Giac and in no log entry, so restart from the unchanged log, as a dirty
        // refusal does. Not after the user's own Cancel (already restarted) nor a dead engine (restartAfterCrash, G24,
        // G183).
        // By name: a value import of engine/types.ts would move it out of the start chunk (see above).
        const name = e instanceof Error ? e.name : "";
        if (name !== "EngineCancelled" && name !== "EngineMemoryError" && name !== "EngineCrashError") await worker.cancel();
        throw e;
      }
      if (r.type !== "library") throw new Error(`unexpected ${r.type}`);
      if (r.result.ok) worker.keep(r.result.changes);
      else if (r.result.dirty) await worker.cancel();
      return { result: r.result, lines: r.lines };
    },
    async exportLibrary() {
      const r = await send({ type: "libraryExport", version: LIBRARY_FORMAT.version });
      if (r.type !== "libraryExport") throw new Error(`unexpected ${r.type}`);
      return { text: r.text, skipped: r.skipped };
    },
  };
}
