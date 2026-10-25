// SPDX-License-Identifier: GPL-3.0-or-later
// stage calls
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { EngineHost } from "../../src/engine/host.ts";
import type { GiacBridge } from "../../src/engine/bridge.ts";
import { defaultHomeSettings, type HomeSettings } from "../../src/engine/homeEval.ts";
import { defaultCasSettings } from "../../src/engine/types.ts";
import { giacOfEntry } from "../../src/input/entry.ts";
import { callsStage, type CallsBaseline } from "../calls-budget.ts";
import { root, cases, freshEngine, report } from "./lib.ts";

/** G52: Giac calls per input (one Enter at 12 digits) for the bench inputs (CAS) and home.yaml's single inputs (Home),
 *  against tests/golden/calls-baseline.yaml. A set whose calls per input are more than 10 % over its baseline fails. */
export async function stageCalls(): Promise<void> {
  const base = parse(readFileSync(`${root}tests/golden/calls-baseline.yaml`, "utf8")) as CallsBaseline;
  const counted = async (): Promise<{ host: EngineHost; calls: () => number }> => {
    const { giac, bridge } = await freshEngine();
    let n = 0;
    const evalOnce = giac.eval.bind(giac);
    giac.eval = (text: string) => {
      n++;
      return evalOnce(text);
    };
    // G99: a bridge call is a Giac call too
    const counted: GiacBridge = {
      ctxGet: () => (n++, bridge.ctxGet()),
      ctxSet: (f) => (n++, bridge.ctxSet(f)),
      parse: (t) => (n++, bridge.parse(t)),
      value: (t, p) => (n++, bridge.value(t, p)),
    };
    return { host: new EngineHost(giac, counted), calls: () => n };
  };
  const bench = new Map<string, number>();
  {
    const { host, calls } = await counted();
    for (const c of cases("bench.yaml")) {
      const n0 = calls();
      host.cas(c.input!, defaultCasSettings);
      bench.set(c.id, calls() - n0);
    }
  }
  const home = new Map<string, number>();
  {
    const { host, calls } = await counted();
    const s: HomeSettings = { ...defaultHomeSettings, digits: 12 };
    for (const c of cases("home.yaml")) {
      if (c.steps) continue;
      const hs: HomeSettings = { ...s, angle: c.settings?.angle ?? "rad" };
      const giacOf = (t: string): string => (c.latex !== undefined ? giacOfEntry(t, "home").giac : t);
      for (const b of c.before ?? []) host.home(giacOf(b), hs);
      const n0 = calls();
      host.home(giacOf(c.latex ?? c.input!), hs);
      home.set(c.id, calls() - n0);
    }
  }
  for (const [set, counts, baseline, baselineInputs] of [["bench", bench, base.bench, base.benchInputs], ["home", home, base.home, base.homeInputs]] as const) {
    const r = callsStage(set, counts, baseline, baselineInputs);
    report(`calls-${set}`, r.ok, r.line);
  }
}
