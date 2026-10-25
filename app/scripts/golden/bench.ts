// SPDX-License-Identifier: GPL-3.0-or-later
// stage bench
import { typed } from "../../src/goldenRun.ts";
import { defaultCasSettings } from "../../src/engine/types.ts";
import { hasAngleFactor } from "../../src/input/angles.ts";
import { cases, freshHost, report } from "./lib.ts";

/** A result text with a trig function in it (the CAS view draws its angle in degrees in DEG). */
const TRIG_TEXT = /(?<![A-Za-z0-9_])a?(sin|cos|tan|sec|csc|cot)\(/;

export async function stageBench(): Promise<void> {
  const cs = cases("bench.yaml");
  const host = await freshHost();
  let checked = 0;
  let pass = 0;
  const errors: string[] = [];
  const radText = new Map<string, string>();
  for (const c of cs) {
    const r = host.cas(c.input!, defaultCasSettings).result;
    if (!r.ok) errors.push(`${c.id} (${r.error})`);
    else radText.set(c.id, r.text);
    if (c.expect === undefined) continue;
    checked++;
    if (r.ok && r.text === c.expect) pass++;
    else console.log(`  bench ${c.id}: got ${r.text}, expect ${c.expect}`);
  }
  // G46: the same inputs in DEG. Every one that answers in RAD answers in DEG (A16 saw limit and series refused); `deg`
  // pins the DEG text; an input without an angle function shows the RAD text, unless its result holds a trig function
  // (the CAS view draws that in degrees, S14 option 2).
  const deg = { ...defaultCasSettings, angle: "deg" as const };
  let degChecked = 0;
  let degPass = 0;
  for (const c of cs) {
    const rad = radText.get(c.id);
    if (rad === undefined) continue;
    const r = host.cas(c.input!, deg).result;
    const want = c.deg ?? (hasAngleFactor(c.input!, "typed") || TRIG_TEXT.test(rad) ? undefined : rad);
    if (r.ok && want === undefined) continue;
    degChecked++;
    if (r.ok && r.text === want) degPass++;
    else console.log(`  bench ${c.id} in DEG: got ${r.ok ? r.text : `error ${r.error}: ${r.text}`}, expect ${want ?? "an answer"}`);
  }
  report(
    "bench",
    pass === checked && degPass === degChecked,
    `${pass}/${checked} expect match, ${cs.length} run, errors: ${errors.length ? errors.join(", ") : "none"}; DEG ${degPass}/${degChecked} match`,
  );
}
