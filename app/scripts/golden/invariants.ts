// SPDX-License-Identifier: GPL-3.0-or-later
// stage invariants
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { EngineHost } from "../../src/engine/host.ts";
import { defaultHomeSettings, type HomeResult, type HomeSettings } from "../../src/engine/homeEval.ts";
import { giacOfEntry } from "../../src/input/entry.ts";
import { checkAngle, checkCopy, checkDigits, checkStoreBoth, copySourceOf, invariantsOf, storesNames, invariantsStage, type InvariantFailure } from "../invariants.ts";
import { copyFull } from "../../src/clipboard/text.ts";
import { parsePastedNumber } from "../../src/clipboard/paste.ts";
import { root, only, cases, freshHost, report } from "./lib.ts";

/** G43: the invariants over every home.yaml and precision.yaml input without settings; see invariants.ts. */
export async function stageInvariants(): Promise<void> {
  const seen = new Set<string>();
  const inputs: { id: string; giac: string; before: string[]; cas: boolean }[] = [];
  for (const file of ["home.yaml", "precision.yaml"]) {
    for (const c of cases(file)) {
      // A case whose only setting is `angle` joins when its input holds no angle function (G46: cosh(90*i), (-8)^0.2 exist
      // only in DEG cases); it runs in both modes, the setting dropped.
      const angleOnly = c.settings !== undefined && Object.keys(c.settings).every((k) => k === "angle");
      if ((c.settings && !angleOnly) || c.steps || c.beforeHome?.length || c.beforeCas?.length || c.relaunch || c.status === "pending" || c.kind === "cas") continue;
      const giacOf = (t: string): string => (c.latex !== undefined ? giacOfEntry(t, "home").giac : t);
      let giac: string;
      try {
        giac = giacOf(c.latex ?? c.input!);
      } catch {
        continue;
      }
      const before = (c.before ?? []).map(giacOf);
      if (angleOnly && !invariantsOf(giac, before).angleFree) continue;
      const key = `${before.join(";")}|${giac}`;
      if (seen.has(key)) continue;
      seen.add(key);
      inputs.push({ id: `${file === "home.yaml" ? "home" : "precision"}:${c.id}`, giac, before, cas: false });
    }
  }
  const at = async (host: EngineHost, i: (typeof inputs)[number], angle: "rad" | "deg", digits: number): Promise<HomeResult> => {
    const s: HomeSettings = { ...defaultHomeSettings, angle, digits };
    for (const b of i.before) host.home(b, s);
    return host.home(i.giac, s).result;
  };
  const failures: InvariantFailure[] = [];
  let stageHost: EngineHost | undefined;
  const t0 = performance.now();
  let checked = { a: 0, b: 0, c: 0, d: 0 };
  for (const i of inputs) {
    // `before` inputs and inputs that store a name themselves (`:=`, `=>`, `sto(`) get their own engine; the others share
    // one for the stage (check (d) purges its name after each direction).
    const keep = i.before.length > 0 || storesNames(i.giac);
    const own = keep ? await freshHost() : null;
    const host = async (): Promise<EngineHost> => own ?? (stageHost ??= await freshHost());
    const rad = await at(await host(), i, "rad", 12);
    const o = invariantsOf(i.giac, i.before);
    if (o.angleFree) {
      const deg = await at(await host(), i, "deg", 12);
      checked.a++;
      const f = checkAngle(i.id, rad, deg);
      if (f) failures.push(f);
    }
    if (rad.ok && rad.value) {
      const b = checkDigits(i.id, rad, await at(await host(), i, "rad", 30));
      if (b.checked) checked.b++;
      if (b.failure) failures.push(b.failure);
      // (c): the copy text the app makes (invariants.ts copySourceOf), read back by the paste reader
      const copy = copyFull(copySourceOf(rad));
      const pasted = copy === undefined ? null : parsePastedNumber(copy);
      if (copy !== undefined && pasted) {
        checked.c++;
        try {
          const back = (await host()).home(giacOfEntry(pasted.latex, "home").giac, { ...defaultHomeSettings, digits: 12 }).result;
          const f = checkCopy(i.id, rad, copy, back);
          if (f) failures.push(f);
        } catch (e) {
          failures.push({ id: i.id, check: "c", detail: `copy ${copy} pasted as ${pasted.latex}: ${e instanceof Error ? e.message : String(e)}` });
        }
      }
    }
    // (d): X:=input in one mode, X in the other shows what the store line showed
    // (d) runs for the inputs it ran for before G43f1: no `before`. Only a storing input gets a new engine per direction.
    if (rad.ok && rad.value && i.before.length === 0) {
      const d = await checkStoreBoth(storesNames(i.giac) ? async () => await freshHost() : host, i.id, i.giac);
      checked.d += d.checked;
      failures.push(...d.failures);
    }
  }
  const known = parse(readFileSync(`${root}tests/golden/invariants-known.yaml`, "utf8")) as { known?: { id: string; check: string; package: string; note?: string }[] };
  const r = invariantsStage(failures, known.known ?? []);
  for (const l of r.lines) console.log(`  invariants ${l}`);
  const secs = (performance.now() - t0) / 1000;
  report("invariants", r.ok && secs < 60, `${inputs.length} inputs, ${checked.a} (a) RAD/DEG, ${checked.b} (b) 12/30 digits, ${checked.c} (c) copy and paste, ${checked.d} (d) store; ${r.summary}; ${secs.toFixed(1)} s (< 60)`);
}
