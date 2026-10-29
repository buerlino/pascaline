// SPDX-License-Identifier: GPL-3.0-or-later
// Probe (G112, backlog F103, bug-patterns family 5): which Giac functions read one list argument as their argument list. Every
// function name of Find's index and of the census (find/functions.yaml `census` groups) gets one list of two and of three
// elements (listargs/sweep.ts SAMPLES) on plain giac.eval; a name is a hit when its answer is not one value per element and
// equals the call with the elements as separate arguments, or is one number. A name whose help signature takes a list (Lst,
// Vect, Mtrx) or that answers a list and its reverse alike (sum, gcd, mean) reads the list as its data and is never a hit.
//   node tools/probes/list-args.ts             # the hits with their reason, the counts
//   WRITE=1 node tools/probes/list-args.ts     # also writes app/src/engine/listargsTable.ts and listargsEvidence.ts (checked in)
//   node tools/probes/list-args.ts Psi Zeta     # these names only, every verdict
// Needs the Find index (`npm run index` in app/), Giac's tarball (PASCALINE_DL_DIR, default the main checkout's cache) and the
// engine as tools/probes/engine.ts (GIAC_OUT). One engine, the names in order; a name that hangs (DEADLINE_MS, default 5000) or
// traps the engine is skipped and listed (SKIP in the table), and the pass runs again until none is new, so that the last
// pass is what listargsTable.test.ts replays in one process. G124: a hit whose one-list form Giac documents (listargs/intended.ts)
// is written to PROBED_LIST_FORMS with its evidence instead of the refused names.
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { aideCas } from "./findcensus/run.ts";
import { listArgNames } from "./listargs/names.ts";
import { tableFiles } from "./listargs/table.ts";
import { helpEntries, intendedForm, type ListForm } from "./listargs/intended.ts";
import { loadNodeGiac } from "../../app/src/engine/nodeGiac.ts";
import type { Answer, Job } from "./listargs/worker.ts";
import type { Verdict } from "./listargs/sweep.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim();
const mainCheckout = common ? resolve(common, "..") : repo;
const deadline = Number(process.env["DEADLINE_MS"] ?? 5000);

const only = process.argv.slice(2);
const t0 = performance.now();
const aide = await aideCas(mainCheckout);
const all = listArgNames(repo, aide);
const names = only.length ? all.filter((n) => only.includes(n.name)) : all;

/** One pass over `names` minus `skip` on one engine; a hang or a trap adds the name to `skip` and starts a new engine. */
async function pass(skip: Map<string, string>): Promise<{ verdicts: Map<string, Verdict>; fresh: number }> {
  const verdicts = new Map<string, Verdict>();
  let fresh = 0;
  let w: Worker | null = null;
  let id = 0;
  const start = (): Promise<Worker> =>
    new Promise((res, rej) => {
      const nw = new Worker(new URL("./listargs/worker.ts", import.meta.url));
      nw.once("error", rej);
      nw.once("message", () => {
        nw.off("error", rej);
        res(nw);
      });
    });
  for (const n of names) {
    if (skip.has(n.name)) continue;
    const cur: Worker = w ?? (w = await start());
    const job: Job = { id: ++id, name: n.name, takesList: n.takesList };
    const a = await new Promise<Answer | { hang: true }>((res) => {
      const t = setTimeout(() => res({ hang: true }), deadline);
      const on = (m: Answer): void => {
        if (m.id !== job.id) return;
        clearTimeout(t);
        cur.off("message", on);
        cur.off("error", onErr);
        res(m);
      };
      const onErr = (e: unknown): void => {
        clearTimeout(t);
        cur.off("message", on);
        res({ id: job.id, crash: String(e).slice(0, 120) });
      };
      cur.on("message", on);
      cur.once("error", onErr);
      cur.postMessage(job);
    });
    if ("v" in a) {
      verdicts.set(n.name, a.v);
      continue;
    }
    skip.set(n.name, "hang" in a ? `no answer in ${deadline} ms` : `the engine threw: ${a.crash}`);
    fresh++;
    void cur.terminate();
    w = null;
  }
  if (w) await w.terminate();
  return { verdicts, fresh };
}

const skip = new Map<string, string>();
let r = await pass(skip);
let passes = 1;
while (r.fresh > 0 && passes < 5) {
  r = await pass(skip);
  passes++;
}
const hits = [...r.verdicts].filter((e): e is [string, Extract<Verdict, { hit: true }>] => e[1].hit);
for (const [n, v] of only.length ? [...r.verdicts] : hits) console.log(`${v.hit ? "hit " : "    "} ${n.padEnd(20)} ${v.why}`);
for (const [n, why] of skip) console.log(`skip ${n.padEnd(20)} ${why}`);
const counts = new Map<string, number>();
for (const v of r.verdicts.values()) counts.set(v.hit ? "hit" : v.why, (counts.get(v.hit ? "hit" : v.why) ?? 0) + 1);
console.log(
  `LIST ARGS: ${names.length} names, ${[...counts].map(([k, c]) => `${k} ${c}`).join(", ")}, skipped ${skip.size}; ${passes} passes; ${((performance.now() - t0) / 1000).toFixed(1)} s`,
);
if (r.fresh > 0) throw new Error("new skips in the last pass: the table would not replay");

// G124: the hits whose one-list form Giac documents (listargs/intended.ts) are not refused, each with its evidence
const entries = helpEntries(aide);
const { giac } = await loadNodeGiac();
const forms: [string, ListForm, string][] = [];
for (const [n] of hits) {
  const f = intendedForm((s) => giac.eval(s), entries, n);
  if (f) forms.push([n, f.form, f.why]);
}
for (const [n, form, why] of forms) console.log(`form ${n.padEnd(20)} ${form}: ${why}`);

if (process.env["WRITE"] === "1" && !only.length) {
  const { table, evidence } = tableFiles(hits.map(([n, v]) => [n, v.why] as const), forms, [...skip], deadline, names.length);
  writeFileSync(resolve(repo, "app/src/engine/listargsTable.ts"), table);
  writeFileSync(resolve(repo, "app/src/engine/listargsEvidence.ts"), evidence);
  console.log("wrote app/src/engine/listargsTable.ts and listargsEvidence.ts");
}
