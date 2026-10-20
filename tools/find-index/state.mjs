// SPDX-License-Identifier: GPL-3.0-or-later
// Shared by generate.mjs and refresh-factors.mjs: the pinned source tarballs, and the problems (fatal, printed together at
// the end) and notes (counted, printed with --verbose) of one run.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const problems = [];
export const notes = [];
export const fail = (m) => problems.push(m);

export const SOURCES = {
  giac: {
    file: "giac-2.1.0.tar.gz",
    sha256: "1d9536e02ce6a336793ebf11c02b93f084e28af2350871914acafa60282b5a67",
    dir: process.env.PASCALINE_DL_DIR ?? join(REPO, "engine/giac/_downloads"),
  },
  qalc: {
    file: "libqalculate-5.13.1.tar.gz",
    sha256: "cf8d3eaf3d85030115701e997b6585e69573e71add88e7758486c5d1b01d3cc3",
    dir: process.env.PASCALINE_QALC_DL_DIR ?? join(REPO, "engine/qalc/_downloads"),
  },
};


// ---------------------------------------------------------------------------------------------- sources

export function tarball(src) {
  const path = join(src.dir, src.file);
  if (!existsSync(path)) throw new Error(`missing ${path} (set ${src === SOURCES.giac ? "PASCALINE_DL_DIR" : "PASCALINE_QALC_DL_DIR"})`);
  const sha = createHash("sha256").update(readFileSync(path)).digest("hex");
  if (sha !== src.sha256) throw new Error(`SHA-256 mismatch: ${path}`);
  return path;
}

export function member(path, name) {
  return execFileSync("tar", ["-xzOf", path, name], { maxBuffer: 64 << 20 }).toString("utf8");
}

/** libqalculate's units, variables and prefixes definitions (XML text), from the pinned tarball: names and titles only. */
export function qalcXml() {
  const qtar = tarball(SOURCES.qalc);
  return Object.fromEntries(["units", "variables", "prefixes"].map((n) => [n, member(qtar, `libqalculate-5.13.1/data/${n}.xml.in`)]));
}
