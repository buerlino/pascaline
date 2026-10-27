// SPDX-License-Identifier: GPL-3.0-or-later
// A30: since A21 the Find index needs no qalc build, so the gate, the golden stages and the pipeline do not set QALC_OUT.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(app, "..");
const files = [
  join(app, "scripts/gate.ts"),
  join(repo, "scripts/pipeline.sh"),
  ...readdirSync(join(app, "scripts/golden")).filter((f) => f.endsWith(".ts")).map((f) => join(app, "scripts/golden", f)),
  join(app, "scripts/golden.ts"),
];

describe("QALC_OUT", () => {
  it.each(files)("%s does not name it", (f) => {
    expect(readFileSync(f, "utf8")).not.toContain("QALC_OUT");
  });
});
