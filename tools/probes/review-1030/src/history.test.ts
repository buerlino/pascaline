// SPDX-License-Identifier: GPL-3.0-or-later
// Night review 2026-10-30, bu-1, bu-2, bu-3, bu-5 (the history and settings rows; red at bb90a5e). From app/:
//   npx vitest run --dir ../tools/probes/review-1030
import { describe, expect, it } from "vitest";
import { FakeCalc } from "../../../../app/src/calc/fake.ts";
import { Session, migrateSettings, SETTINGS_SCHEMA } from "../../../../app/src/state/session.svelte.ts";
import { plainNumber } from "../../../../app/src/apps/decimal.ts";
import { copyFull } from "../../../../app/src/clipboard/text.ts";
import { giacOfEntry } from "../../../../app/src/input/entry.ts";

function memoryKv() {
  const data = new Map<string, unknown>();
  return {
    data,
    get: <T>(k: string) => Promise.resolve(structuredClone(data.get(k)) as T | undefined),
    set: (k: string, v: unknown) => { data.set(k, structuredClone(v)); return Promise.resolve(); },
  };
}
const n = (kv: ReturnType<typeof memoryKv>) => ((kv.data.get("history") as { home: unknown[] } | undefined)?.home.length ?? -1);

describe("vbu bu-1", () => {
  it("hide before the history read: stored history after flush and after the next launch", async () => {
    const kv = memoryKv();
    const a = new Session(new FakeCalc(), kv);
    for (const x of ["1", "2", "3", "4"]) await a.submit(x);
    const before = n(kv);
    const b = new Session(new FakeCalc(), kv); // launch 2: hidden before the 2nd frame
    b.flushHistory(); // pagehide / visibilitychange(hidden)
    const afterHide = n(kv);
    const c = new Session(new FakeCalc(), kv); // launch 3
    await c.restoreHistory();
    console.log(`VBU1 before=${before} afterHide=${afterHide} launch3.home=${c.home.length}`);
    // and during the read (restoring = true): flush also writes
    const kv2 = memoryKv();
    const d = new Session(new FakeCalc(), kv2);
    for (const x of ["1", "2"]) await d.submit(x);
    const e = new Session(new FakeCalc(), kv2);
    const p = e.restoreHistory();
    e.flushHistory();
    const mid = n(kv2);
    await p;
    console.log(`VBU1b during-read flush stored=${mid} memory=${e.home.length}`);
    expect(afterHide).toBe(before);
  });
});

describe("vbu bu-2", () => {
  it("Clear while a CAS job runs", async () => {
    const kv = memoryKv();
    const s = new Session(new FakeCalc(300), kv);
    s.setView("cas");
    const p1 = s.submit("1+1");
    const busy0 = s.busy;
    s.clearHistory();
    const busy1 = s.busy;
    const cancelled = await s.cancel();
    const p2 = s.submit("2+2");
    console.log(`VBU2 busyBefore=${busy0} busyAfterClear=${busy1} cancel()=${cancelled} secondSubmitAccepted=${p2 !== undefined}`);
    await Promise.allSettled([p1, p2]);
    expect(busy1).toBe(true);
  });
});

describe("vbu bu-3/6/7", () => {
  it("plainNumber, copyFull with drawn, parser on bare commas", () => {
    for (const l of ["2{,}5", "0{,}5", "2.5", "5\\emark-1"]) console.log(`VBU3 plainNumber(${l}) = ${JSON.stringify(plainNumber(l))}`);
    const src = { status: "done", latex: "", text: "{1.5,2}", resultLatex: "", drawn: "{1.5,2}", full: "list[1.5,2]" };
    console.log(`VBU6 copyFull(drawn list, comma) = ${JSON.stringify(copyFull(src as never, { decimalComma: true }))}`);
    const sc = { status: "done", latex: "", text: "0.75", resultLatex: "", full: "0.75" };
    console.log(`VBU6 copyFull(0.75, comma) = ${JSON.stringify(copyFull(sc as never, { decimalComma: true }))}`);
    for (const l of ["0,75", "\\left\\{1,5;2\\right\\}", "\\left\\{1{,}5;2\\right\\}"]) {
      try { console.log(`VBU7 giacOfEntry(${l}) = ${JSON.stringify(giacOfEntry(l, "home").giac)}`); }
      catch (e) { console.log(`VBU7 giacOfEntry(${l}) threw ${(e as Error).message}`); }
    }
    const m = migrateSettings({ schema: SETTINGS_SCHEMA + 1, decimalMark: "comma", future: 1 });
    console.log(`VBU5 newer schema: migrated=${m.migrated} keepsFuture=${"future" in m.settings}`);
    expect(plainNumber("2{,}5")).toBeDefined();
  });
});
