// SPDX-License-Identifier: GPL-3.0-or-later
// A53: behaviour-diff.ts on fake source trees (no engine): each tree's host is built as nodeGiac.ts builds it (giac and
// bridge), each tree runs its own engine (GIAC_MJS_A, GIAC_MJS_B), and a tree whose runs mostly throw stops the tool.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { parse } from "yaml";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const tool = fileURLToPath(new URL("./behaviour-diff.ts", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "behaviour-diff-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** The first input the tool reads (home.yaml's first single-input case). */
const target = ((parse(readFileSync(`${repo}tests/golden/home.yaml`, "utf8")) as { cases: Record<string, unknown>[] }).cases.find(
  (c) => typeof c["input"] === "string" && !c["latex"] && !c["steps"] && !c["before"] && !c["beforeHome"] && !c["beforeCas"],
)!["input"]) as string;

/**
 * A fake tree. Its host needs the bridge on every call (as the real one does: ctxGate.ts first touches it in flush()), and
 * `display(input, engine)` gives Home's display, `engine` being the file name of the giac.mjs its loader was handed.
 * `throws`: every call throws this message.
 */
function tree(name: string, display: string, throws?: string): string {
  const dir = join(root, name);
  const eng = join(dir, "app/src/engine");
  mkdirSync(eng, { recursive: true });
  writeFileSync(join(dir, "package.json"), '{"type":"module"}\n');
  writeFileSync(join(dir, "app/package.json"), '{"type":"module"}\n');
  writeFileSync(join(eng, "homeEval.ts"), "export const defaultHomeSettings = {};\n");
  writeFileSync(join(eng, "types.ts"), "export const defaultCasSettings = {};\n");
  writeFileSync(join(eng, "format.ts"), "export const markOf = () => null;\n");
  writeFileSync(
    join(eng, "nodeGiac.ts"),
    "export async function loadNodeGiac(mjs) { return { giac: { mjs: mjs.split('/').pop(), eval: () => '' }, bridge: { ctxSet: () => 0 }, instantiateMs: 0 }; }\n",
  );
  writeFileSync(
    join(eng, "host.ts"),
    [
      `const TARGET = ${JSON.stringify(target)};`,
      `const display = ${display};`,
      "export class EngineHost {",
      "  constructor(giac, bridge) { this.giac = giac; this.bridge = bridge; }",
      "  call(input) {",
      throws ? `    throw new Error(${JSON.stringify(throws)});` : "    this.bridge.ctxSet;",
      "    return { result: { ok: true, display: display(input, this.giac.mjs), text: display(input, this.giac.mjs) } };",
      "  }",
      "  home(input) { return this.call(input); }",
      "  cas(input) { return this.call(input); }",
      "}",
      "",
    ].join("\n"),
  );
  return dir;
}

function diff(a: string, b: string, env: Record<string, string> = {}): { code: number | null; out: string } {
  const r = spawnSync(process.execPath, [tool, a, b], { cwd: repo + "app", encoding: "utf8", timeout: 120_000, env: { ...process.env, GIAC_MJS: "", ...env } });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe("behaviour-diff.ts (A53)", () => {
  const same = tree("same", "(input) => 'same'");

  it("lists the one input whose display differs in tree B's code", () => {
    const b = tree("b-differs", "(input) => (input === TARGET ? 'other' : 'same')");
    const r = diff(same, b, { GIAC_MJS_A: "/x/a/giac.mjs", GIAC_MJS_B: "/x/a/giac.mjs" });
    expect(r.code).toBe(0);
    expect(r.out).not.toMatch(/^none$/m);
    expect(r.out).toContain(`| home 12 rad | ${target.replace(/\|/g, "\\|")} | - same | - other |`);
    // 8 settings, Home and CAS alike
    expect(r.out).toMatch(/^8 difference\(s\)$/m);
  });

  it("runs tree A on GIAC_MJS_A and tree B on GIAC_MJS_B", () => {
    const e = tree("engine-shows", "(input, mjs) => (input === TARGET ? mjs : 'same')");
    const r = diff(e, e, { GIAC_MJS_A: "/x/p1/a.mjs", GIAC_MJS_B: "/x/branch/b.mjs" });
    expect(r.code).toBe(0);
    expect(r.out).toContain("engine A /x/p1/a.mjs");
    expect(r.out).toContain("engine B /x/branch/b.mjs");
    expect(r.out).toContain(`| home 30 deg | ${target.replace(/\|/g, "\\|")} | - a.mjs | - b.mjs |`);
  });

  it("refuses to say none when every run throws the same message", () => {
    const t = tree("throws", "(input) => 'same'", "Cannot read properties of undefined (reading 'ctxSet')");
    const r = diff(t, t);
    expect(r.code).not.toBe(0);
    expect(r.out).not.toMatch(/^none$/m);
    expect(r.out).toContain("Cannot read properties of undefined (reading 'ctxSet')");
  });
});
