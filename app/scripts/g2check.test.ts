// SPDX-License-Identifier: GPL-3.0-or-later
// G79: `oracle.py --g2 --check` fails on a hand edit of G2-CHECKLIST.md and names the item; phase-1's checklist passes.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { oracleVenvPython, setupLine, touchesG2 } from "./g2check.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim();
const py = oracleVenvPython(repo, common ? resolve(common, "..") : repo);
const checklist = join(repo, "tests/golden/G2-CHECKLIST.md");
// each case starts oracle.py (Python + mpmath, about 1 s alone); under the full suite's parallel load it passed 5 s (run 315)
const SPAWN_MS = 30_000;

function check(file: string): { code: number; out: string } {
  const r = spawnSync(py as string, [join(repo, "tests/golden/oracle.py"), "--g2", "--check", "--checklist", file], { encoding: "utf8" });
  return { code: r.status ?? 1, out: `${r.stdout}${r.stderr}` };
}

describe("oracle.py --g2 --check (G79)", () => {
  it("has the oracle venv", () => {
    if (py === null) throw new Error(`no oracle venv for the G79 tests; set it up: ${setupLine}`);
  });
  it("passes on the stored checklist", () => {
    const r = check(checklist);
    expect(r.out).toContain("checklist ok");
    expect(r.code).toBe(0);
  }, SPAWN_MS);
  it("fails on a hand edit and names the item", () => {
    const dir = mkdtempSync(join(tmpdir(), "g2check-"));
    const copy = join(dir, "G2-CHECKLIST.md");
    const orig = readFileSync(checklist, "utf8");
    const text = orig.replace("Display of division", "Display of DIVISION");
    expect(text).not.toBe(orig);
    writeFileSync(copy, text);
    const r = check(copy);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/item 5 differs/);
    expect(r.out).not.toMatch(/item 4 /);
  }, SPAWN_MS);
});

describe("touchesG2", () => {
  it("selects g2.yaml, the checklist and g2-linked files only", () => {
    expect(touchesG2(["tests/golden/g2.yaml"], repo)).toBe(true);
    expect(touchesG2(["tests/golden/G2-CHECKLIST.md"], repo)).toBe(true);
    expect(touchesG2(["tests/golden/home.yaml"], repo)).toBe(true);
    expect(touchesG2(["app/src/foo.ts"], repo)).toBe(false);
  });
  it("counts a file that lost its last link or was deleted (link in the base version)", () => {
    const base = (f: string): string | null => (f === "tests/golden/solve.yaml" ? '  - { id: "solve/x", g2: 12 }' : null);
    expect(touchesG2(["tests/golden/nolink-gone.yaml"], repo, base)).toBe(false);
    expect(touchesG2(["tests/golden/solve.yaml"], repo, base)).toBe(true);
    expect(touchesG2(["tests/golden/deleted-file.yaml"], repo, () => "{ g2: 3 }")).toBe(true);
  });
});
