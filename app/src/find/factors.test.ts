// SPDX-License-Identifier: GPL-3.0-or-later
// A21: the Find index is built from find/factors.yaml with no qalc build (QALC_OUT unset), and its bytes are the ones
// the qalc build gave before (hash pinned from phase-1 at bf54f3d). Needs the Giac and libqalculate tarballs (names and
// titles come from the XML in the latter); skipped without them unless FIND_INDEX=required.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const giac = join(process.env.PASCALINE_DL_DIR ?? join(repo, "engine/giac/_downloads"), "giac-2.1.0.tar.gz");
const qalc = join(process.env.PASCALINE_QALC_DL_DIR ?? join(repo, "engine/qalc/_downloads"), "libqalculate-5.13.1.tar.gz");
const have = existsSync(giac) && existsSync(qalc);
const required = process.env.FIND_INDEX === "required";

const INDEX_SHA256 = "44c3104775628e8b01f86267833fbc03b7beafccf6de00b364aa453221df9527";

describe("factors.yaml", () => {
  it("exists", () => {
    expect(existsSync(join(repo, "find/factors.yaml"))).toBe(true);
  });
  it.skipIf(!have && !required)("builds the Find index byte for byte without the qalc build", { timeout: 120_000 }, () => {
    const dir = mkdtempSync(join(tmpdir(), "factors-"));
    try {
      const out = join(dir, "find-index.json");
      const env = { ...process.env };
      delete env.QALC_OUT;
      execFileSync("node", [join(repo, "tools/find-index/generate.mjs"), "--out", out], { env, stdio: "pipe" });
      expect(createHash("sha256").update(readFileSync(out)).digest("hex")).toBe(INDEX_SHA256);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
