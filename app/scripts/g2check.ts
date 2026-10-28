// SPDX-License-Identifier: GPL-3.0-or-later
// G79: the gate's G2 checklist step: when g2.yaml, the checklist or a golden file with a `g2:` link changed, run `oracle.py --g2 --check`.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The oracle venv's python: this checkout's, else the main checkout's; null when neither exists. */
export function oracleVenvPython(repo: string, main: string = repo): string | null {
  for (const root of [repo, main]) {
    const p = join(root, "tests/golden/.venv/bin/python");
    if (existsSync(p)) return p;
  }
  return null;
}

export const setupLine = "python3 -m venv tests/golden/.venv && tests/golden/.venv/bin/pip install mpmath==1.3.0 pyyaml==6.0.2";

/** Whether the diff touches the checklist's sources: g2.yaml, the checklist, or a golden yaml file that has a `g2:` link. */
export function touchesG2(changed: string[], repo: string): boolean {
  return changed.some((f) => {
    if (f === "tests/golden/g2.yaml" || f === "tests/golden/G2-CHECKLIST.md" || f === "tests/golden/oracle.py") return true;
    if (!/^tests\/golden\/[^/]+\.yaml$/.test(f)) return false;
    try {
      return /\bg2: *\d+/.test(readFileSync(join(repo, f), "utf8"));
    } catch {
      return false;
    }
  });
}
