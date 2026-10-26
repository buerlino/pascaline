// SPDX-License-Identifier: GPL-3.0-or-later
// G112 (backlog F103): listargsTable.ts is what tools/probes/list-args.ts found on the pinned engine. This replays the probe's
// last pass (every name of Find's index and of the census but the skipped ones, in order, on one engine) and fails when the
// engine and the table disagree: a name that now reads its one list as its arguments, or no longer does, or another reason.
// Refresh with `WRITE=1 node tools/probes/list-args.ts`. Needs the Find index (skipped without one; FIND_INDEX=required fails),
// Giac's tarball (PASCALINE_DL_DIR, default the main checkout's cache) and the engine.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { giacAvailable, loadNodeGiac } from "./nodeGiac.ts";
import { PROBED_LIST_AS_ARGUMENTS, PROBED_NAMES } from "./listargsTable.ts";
import { PROBE_SKIPPED, PROBED_EVIDENCE } from "./listargsEvidence.ts";
import { LIST_AS_ARGUMENTS } from "./listargs.ts";
import { aideCas } from "../../../tools/probes/findcensus/run.ts";
import { listArgNames } from "../../../tools/probes/listargs/names.ts";
import { verdict } from "../../../tools/probes/listargs/sweep.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const hasIndex = existsSync(join(repo, "app/src/find/_gen/find-index.json"));

it("the Find index is there when required", () => {
  if (!hasIndex && process.env["FIND_INDEX"] === "required") expect.fail("no Find index: run `npm run index` first");
});

describe.skipIf(!hasIndex || !giacAvailable())("G112 the list-as-arguments table", () => {
  it("is what the probe finds on the pinned engine", { timeout: 300_000 }, async () => {
    const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim();
    const names = listArgNames(repo, await aideCas(common ? resolve(common, "..") : repo));
    expect(names.length, "the probe's names changed: run the probe again").toBe(PROBED_NAMES);
    const { giac } = await loadNodeGiac();
    const found: Record<string, string> = {};
    for (const n of names) {
      if (Object.hasOwn(PROBE_SKIPPED, n.name)) continue;
      const v = verdict((s) => giac.eval(s), n.name, n.takesList);
      if (v.hit) found[n.name] = v.why;
    }
    expect(found).toEqual(PROBED_EVIDENCE);
    expect(Object.keys(found)).toEqual(PROBED_LIST_AS_ARGUMENTS);
    expect(Object.keys(PROBE_SKIPPED).every((s) => names.some((n) => n.name === s))).toBe(true);
  });

  it("keeps G111's and R80f1's names", () => {
    for (const f of ["LambertW", "hermite", "legendre", "tchebyshev1", "tchebyshev2", "cyclotomic", "range", "randvector",
      "normald_cdf", "binomial", "poisson_icdf", "UTPT", "igamma", "ugamma", "negbinomial_icdf"]) {
      expect(LIST_AS_ARGUMENTS, f).toContain(f);
    }
  });
});

describe.skipIf(!giacAvailable())("G112 the probe's verdict (fix round 2)", () => {
  it("a sequence is not one number, and a plain vector of the elements' values maps", async () => {
    const { giac } = await loadNodeGiac();
    const ev = (s: string): string => giac.eval(s);
    // op(list[1,2]) = 1,2: evalf(1,2) is evalf of 1 to 2 digits, a real; the answer is the list's elements
    expect(verdict(ev, "op", false)).toEqual({ hit: false, why: "elements" });
    expect(verdict(ev, "feuille", false)).toEqual({ hit: false, why: "elements" });
    // arg(list[1,2]) = [0,0], not list[0,0]: still one value per element
    expect(verdict(ev, "arg", false)).toEqual({ hit: false, why: "maps" });
    expect(verdict(ev, "Psi", false).hit).toBe(true);
  });
});
