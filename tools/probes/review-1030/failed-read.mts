// SPDX-License-Identifier: GPL-3.0-or-later
// vca (night review 2026-10-30): ca-1. One failed IndexedDB open during kvGet, then a working store: does kvGet say
// "nothing stored" (undefined), and does the next kvSet replace the stored record? Second part: a migration step that
// throws inside r.onsuccess: does kvGet settle?
// From the repo root: node tools/probes/review-1030/failed-read.mts
import { fakeIndexedDb } from "../../../app/src/state/fakeIdb.ts";
import { kvGet, kvSet, MIGRATIONS, stamp } from "../../../app/src/state/storage.ts";

const idb = fakeIndexedDb();
let failNext = false;
const factory = {
  open(name: string, version: number) {
    if (!failNext) return idb.factory.open(name, version);
    failNext = false;
    const r = { result: undefined as unknown, error: new Error("UnknownError (simulated)"), onsuccess: null as null | (() => void), onerror: null as null | (() => void), onupgradeneeded: null };
    setTimeout(() => r.onerror?.(), 0);
    return r;
  },
};
(globalThis as Record<string, unknown>).indexedDB = factory;

await kvSet("seed", 0);
const kv = idb.stores.get("kv")!;
kv.set("defs", stamp([{ name: "a", text: "a:=1" }, { name: "b", text: "b:=2" }, { name: "f", text: "f(x):=x^2" }]));
console.log("stored before:", JSON.stringify(kv.get("defs")));
failNext = true;
const got = await kvGet("defs");
console.log("kvGet after a failed open returns:", JSON.stringify(got), "(same as a key never stored:", JSON.stringify(await kvGet("never")), ")");
// WorkerEngine: storeOk = true, log = validDefs(undefined) = []; a `c:=3` then saves the one-entry log
await kvSet("defs", [{ name: "c", text: "c:=3" }]);
console.log("stored after one save:", JSON.stringify(kv.get("defs")));

// part 2: a record stamped 2 whose step throws (a stand-in step; today's steps are defensive): kvGet never settles?
process.on("uncaughtException", (e) => console.log("uncaught in onsuccess:", (e as Error).message));
const real = MIGRATIONS[2]!["defs"];
kv.set("defs", { "@pascaline": 2, value: 42 });
console.log("today's step on a non-array:", JSON.stringify(real!(42)));
MIGRATIONS[2]!["defs"] = () => { throw new Error("step threw"); };
const r = await Promise.race([kvGet("defs").then((v) => `settled: ${JSON.stringify(v)}`), new Promise((res) => setTimeout(() => res("NOT settled after 500 ms"), 500))]);
console.log("throwing-step probe:", r);
process.exit(0);
