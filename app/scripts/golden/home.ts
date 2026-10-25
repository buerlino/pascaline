// SPDX-License-Identifier: GPL-3.0-or-later
// stage home
import { runHomeCase, typed, seqMark, markText } from "../../src/goldenRun.ts";
import { type HomeResult } from "../../src/engine/homeEval.ts";
import { type MarkInfo } from "../../src/engine/format.ts";
import { dropAngleFactor } from "../../src/input/angles.ts";
import { ROUNDS, HOME_LIMIT_MS, only, cases, median, freshHost, report, expectAt, lostAnswer } from "./lib.ts";

export async function stageHome(): Promise<void> {
  const cs = cases("home.yaml");
  const runs = new Map<string, HomeResult[]>(cs.map((c) => [c.id, []]));
  for (let r = 0; r < ROUNDS; r++) {
    const host = await freshHost();
    for (const c of cs) {
      runs.get(c.id)!.push(await runHomeCase(c, host, freshHost));
    }
  }
  let pass = 0;
  let slow = 0;
  let maxMed = 0;
  let assumed = 0;
  let marks = 0;
  for (const c of cs) {
    const rs = runs.get(c.id)!;
    const shown = rs[0]!.display;
    const digits = c.settings?.digits ?? 12;
    const marksOf = rs.map((x) => seqMark(x, digits));
    const got = marksOf.map(markText);
    const markOk = !c.mark || got.every((m) => m?.startsWith(c.mark!));
    if (c.mark) marks++;
    // ⚠ n: only the n confirmed digits are shown, and they must be the oracle's (as in the precision stage).
    const wantOf = (m: MarkInfo | null): string | null =>
      m?.mark === "⚠" && m.n !== undefined && m.n < digits ? expectAt(String(c.expect), Math.max(1, m.n)) : String(c.expect);
    const answered = c.expect === undefined ? rs.every((x) => x.ok && !lostAnswer(x.display, dropAngleFactor(c.input ?? "", "typed"))) : rs.every((x, k) => x.display === wantOf(marksOf[k]!));
    // `exact` (G38): the text the result copies (`full`), when the case pins it.
    const exactOk = c.exact === undefined || rs.every((x) => x.full === c.exact);
    const ok = answered && markOk && exactOk;
    const med = median(rs.map((x) => x.totalMs));
    maxMed = Math.max(maxMed, med);
    if (ok) pass++;
    else console.log(`  home ${c.id}: got ${rs.map((x, k) => `${got[k] ?? "-"} ${x.display}`).join(" / ")}, expect ${c.mark ?? ""} ${c.expect ?? "(mark only)"}${exactOk ? "" : `, copies ${rs[0]!.full}, expect ${c.exact}`}`);
    // G82: a case whose exact pass Home's step budget or its clock stops, not finishing on any device, may name its own.
    const limit = c.budgetMs ?? HOME_LIMIT_MS;
    if (!(med <= limit)) {
      slow++;
      console.log(`  home ${c.id}: median ${med.toFixed(1)} ms > ${limit} ms (${shown})`);
    }
    if (c.source === "assumed") assumed++;
  }
  report(
    "home",
    pass === cs.length && slow === 0,
    `${pass}/${cs.length} match with their mark (${assumed} assumed, ${marks} marks checked), ${slow} over ${HOME_LIMIT_MS} ms, max median ${maxMed.toFixed(1)} ms, rounds ${ROUNDS}`,
  );
}
