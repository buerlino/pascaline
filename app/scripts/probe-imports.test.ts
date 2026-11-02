// SPDX-License-Identifier: GPL-3.0-or-later
// G144: the probes' import check on a fixture (a name its module does not export, a type-only name, a re-export, a missing file) and on the tree.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkImports, KNOWN } from "./probe-imports.ts";

const dir = mkdtempSync(join(tmpdir(), "probeimports-"));
const w = (name: string, text: string): string => {
  const p = join(dir, name);
  writeFileSync(p, text);
  return p;
};
w("lib.ts", "export function have(): number { return 1; }\nexport interface Shape { n: number }\nexport * from './more.ts';\nexport default 3;\n");
w("more.ts", "export const further = 2;\n");
const good = w("good.ts", "import d, { have, further, type Shape } from './lib.ts';\nimport type { Shape as S2 } from './lib.ts';\nvoid [d, have, further];\n");
const missing = w("missing.ts", "import { have, gone } from './lib.ts';\nvoid [have, gone];\n");
const typeOnly = w("typeonly.ts", "import { Shape } from './lib.ts';\nvoid Shape;\n");
const noFile = w("nofile.ts", "import { x } from './absent.ts';\nvoid x;\n");

describe("probe import check (G144)", () => {
  it("passes imports a module exports, re-exports, default and type-only specifiers", () => {
    expect(checkImports([good])).toEqual([]);
  });
  it("fails a name its module does not export, as Node's SyntaxError does", () => {
    const r = checkImports([missing]);
    expect(r.map((f) => f.problem)).toEqual(["./lib.ts does not export gone"]);
    expect(r[0]!.line).toBe(1);
  });
  it("fails a type imported as a value, and a file that is not there", () => {
    expect(checkImports([typeOnly]).map((f) => f.problem)).toEqual(["./lib.ts exports Shape as a type only"]);
    expect(checkImports([noFile]).map((f) => f.problem)).toEqual(["no such file"]);
  });
  it("the tree: every tools/probes file loads its imports, but the files KNOWN lists", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const files = execFileSync("git", ["ls-files", "tools/probes"], { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter((f) => /\.(ts|mts|mjs|js)$/.test(f))
      .map((f) => resolve(root, f));
    const bad = checkImports(files).filter((f) => !(f.file.slice(root.length + 1) in KNOWN));
    expect(bad.map((f) => `${f.file.slice(root.length + 1)}:${f.line} ${f.problem}`)).toEqual([]);
    // G146: it reads every probe and its imports; under the full parallel run it took past vitest's 5 s default
  }, 60_000);
});
