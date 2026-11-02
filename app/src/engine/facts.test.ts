// SPDX-License-Identifier: GPL-3.0-or-later
// G146 (ca-7): the facts a stored name lends (facts.ts; decisions M4-7, G48, G49, G51), unit by unit: storedFacts,
// fnFacts and mergedFacts on their own, and storedFacts, nameFacts and readFacts on a real host's tables for a stored
// exact value, a stored ⚠ value read through a function (F63) and a relaunch. BesselJ(1,2) = 0.57672480775687338720
// (mpmath, precision.yaml g71-gt-besselj-half's note); Home shows it ⚠ 0.576724807757 (prec-5-BesselJ(1,2)-12).
import { describe, expect, it } from "vitest";
import { fnFacts, mergedFacts, nameFacts, readFacts, storedFacts } from "./facts.ts";
import { applyDefChanges, type DefEntry, type NameFacts } from "./defs.ts";
import { defaultHomeSettings, type HomeResult } from "./homeEval.ts";
import { giacAvailable, nodeHost } from "./nodeGiac.ts";
import type { EngineHost } from "./host.ts";
import type { InputReads } from "./stateRead.ts";

const EXACT: NameFacts = { exact: true, reliableDigits: null };
const WARN12: NameFacts = { exact: false, reliableDigits: 12, warn: "unaudited" };
const CHECKED9: NameFacts = { exact: false, reliableDigits: 9 };

describe("storedFacts (M4-7, G49)", () => {
  it("no facts: nothing is kept", () => {
    expect(storedFacts(null, false)).toEqual({});
    expect(storedFacts(null, true)).toEqual({});
  });
  it("a value that prints exactly keeps its facts only when they say it is not exact", () => {
    expect(storedFacts(EXACT, false)).toEqual({});
    expect(storedFacts({ ...WARN12, inexact: true }, false)).toEqual({ facts: { ...WARN12, inexact: true } });
    expect(storedFacts(WARN12, false)).toEqual({});
  });
  it("a float keeps its facts as they are, without `inexact` (its value shows it)", () => {
    expect(storedFacts({ ...WARN12, inexact: true }, true)).toEqual({ facts: WARN12 });
    expect(storedFacts(CHECKED9, true)).toEqual({ facts: CHECKED9 });
  });
});

describe("fnFacts and mergedFacts (G49f1)", () => {
  it("nothing lent and nothing read: null", () => {
    expect(fnFacts([], null)).toBeNull();
    expect(mergedFacts([])).toBeNull();
  });
  it("the fewest confirmed digits and the strongest warn, never exact", () => {
    expect(fnFacts([WARN12], CHECKED9)).toEqual({ exact: false, reliableDigits: 9, warn: "unaudited", inexact: true });
    expect(fnFacts([CHECKED9, { exact: false, reliableDigits: null, warn: "unchecked" }], null)).toEqual({ exact: false, reliableDigits: 9, warn: "unchecked", inexact: true });
  });
  it("an exact name lent alone still makes the function inexact (G49f1: whatever is lent caps it)", () => {
    expect(fnFacts([EXACT], null)).toEqual({ exact: false, reliableDigits: null, inexact: true });
  });
});

/** The digits, warn and display of a result: what the rows compare. */
const seen = (r: HomeResult) => ({ display: r.display, reliableDigits: r.facts.reliableDigits, warn: r.facts.warn });
const reads = (names: string[]): InputReads => ({ names, targets: [], fn: false });

describe.skipIf(!giacAvailable())("stored names lend their facts (real Giac)", () => {
  /** A host with pb:=BesselJ(1,2), f(t):=t and A6:=1/3 stored at `digits`, and the log they made. */
  const stored = async (digits: number): Promise<{ host: EngineHost; log: DefEntry[]; home: (t: string) => HomeResult }> => {
    const host = await nodeHost();
    let log: DefEntry[] = [];
    const home = (t: string): HomeResult => {
      const o = host.home(t, { ...defaultHomeSettings, digits });
      log = applyDefChanges(log, o.defs);
      return o.result;
    };
    home("pb:=BesselJ(1,2)");
    home("f(t):=t");
    home("A6:=1/3");
    return { host, log, home };
  };

  it("a stored exact value lends nothing: A6:=1/3 has no facts in the log, A6*3 is exactly 1", async () => {
    const { host, log, home } = await stored(12);
    expect(log.find((e) => e.name === "A6")).toMatchObject({ cmds: ["A6:=(1/3)"] });
    expect(log.find((e) => e.name === "A6")?.facts).toBeUndefined();
    expect(nameFacts(host, "A6", new Set())).toBeNull();
    expect(readFacts(host, "A6*3", reads(["A6"]))).toBeNull();
    expect(home("A6*3").facts).toEqual({ exact: true, reliableDigits: null });
  });

  it("a stored ⚠ value: the log keeps its float's facts (storedFacts), a read lends them with the name as the cause", async () => {
    const { host, log } = await stored(12);
    expect(log.find((e) => e.name === "pb")?.facts).toEqual(WARN12);
    expect(nameFacts(host, "pb", new Set())).toEqual(WARN12);
    expect(readFacts(host, "pb*2", reads(["pb"]))).toEqual({ facts: { ...WARN12, inexact: true }, causes: ["pb"] });
    // a function definition and purge store no value: they lend nothing (G51)
    expect(readFacts(host, "g(t):=t+pb", { names: ["pb"], targets: [], fn: true })).toBeNull();
    expect(readFacts(host, "purge(pb)", reads(["pb"]))).toBeNull();
  });

  it("F63 (pinned known): at 12 digits pb shows its 12 digits, through f(t):=t one fewer (11: cautious, not wrong)", async () => {
    const { home } = await stored(12);
    expect(seen(home("pb"))).toEqual({ display: "0.576724807757", reliableDigits: 12, warn: "unaudited" });
    const r = home("f(pb)");
    expect(seen(r)).toEqual({ display: "0.57672480776", reliableDigits: 11, warn: "unaudited" });
    expect(r.facts.why).toEqual({ unaudited: ["f"], inherited: ["pb"] });
  });

  it("F63 (pinned known): at 30 digits the store confirms the double's 14, a read by name 13, through f 13", async () => {
    const { log, home } = await stored(30);
    expect(log.find((e) => e.name === "pb")?.facts).toEqual({ ...WARN12, reliableDigits: 14 });
    expect(seen(home("pb"))).toEqual({ display: "0.5767248077569", reliableDigits: 13, warn: "unaudited" });
    expect(seen(home("f(pb)"))).toEqual({ display: "0.5767248077569", reliableDigits: 13, warn: "unaudited" });
  });

  it("a relaunch replays the log: pb keeps its facts (14 at 30 digits, not the 13 of a read before it), f(pb) 13, A6 stays exact", async () => {
    const { log } = await stored(30);
    const next = await nodeHost();
    next.restore(log);
    const s = { ...defaultHomeSettings, digits: 30 };
    expect(next.byName.get("pb")?.facts).toEqual({ ...WARN12, reliableDigits: 14 });
    expect(seen(next.home("pb", s).result)).toEqual({ display: "0.57672480775687", reliableDigits: 14, warn: "unaudited" });
    expect(seen(next.home("f(pb)", s).result)).toEqual({ display: "0.5767248077569", reliableDigits: 13, warn: "unaudited" });
    expect(next.home("A6*3", s).result.facts).toEqual({ exact: true, reliableDigits: null });
  });

  it("a relaunch at 12 digits: pb 12, f(pb) 11 (F63), as before it", async () => {
    const { log } = await stored(12);
    const next = await nodeHost();
    next.restore(log);
    expect(seen(next.home("pb", defaultHomeSettings).result)).toEqual({ display: "0.576724807757", reliableDigits: 12, warn: "unaudited" });
    expect(seen(next.home("f(pb)", defaultHomeSettings).result)).toEqual({ display: "0.57672480776", reliableDigits: 11, warn: "unaudited" });
  });
});
