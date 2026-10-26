// SPDX-License-Identifier: GPL-3.0-or-later
// A19: reads Giac's check/ files straight out of the source tarball (nothing is unpacked into the repo).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { splitInputs, splitOutputs, statementCount } from "./lib.ts";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
/** The sets with a test<name> and a <name>.out; partfrac and other have no usable pair. */
export const SETS: readonly string[] = ["cas", "factor", "geo", "integrate", "limit", "normalize", "proba"];

/** The tarball: GIAC_CHECK_TARBALL, else the download cache (PASCALINE_DL_DIR or this checkout's). */
export function tarballPath(): string {
  const env = process.env["GIAC_CHECK_TARBALL"];
  if (env && existsSync(env)) return env;
  const dirs = [process.env["PASCALINE_DL_DIR"], resolve(repo, "engine/giac/_downloads")].filter((d): d is string => !!d);
  for (const d of dirs) for (const n of ["giac-2.1.0.tar.gz", "giac_2.1.0-1.tar.gz"]) if (existsSync(resolve(d, n))) return resolve(d, n);
  return process.env["GIAC_CHECK_TARBALL"] ?? "";
}

/** The needed check/ files, extracted once (one pass over the tarball) into a cache outside the repo, keyed by the tarball's size and date. */
const cache = new Map<string, string>();
function member(tarball: string, path: string): string {
  if (cache.size === 0) {
    const st = statSync(tarball);
    const dir = resolve(tmpdir(), `pascaline-giac-check-${st.size}-${Math.floor(st.mtimeMs)}`);
    if (!existsSync(resolve(dir, "done"))) {
      mkdirSync(dir, { recursive: true });
      const names = SETS.flatMap((s) => [`*/check/test${s}`, `*/check/${s}.out`]);
      const r = spawnSync("tar", ["-xzf", tarball, "-C", dir, "--wildcards", "--strip-components=2", ...names], { encoding: "utf8" });
      if (r.status !== 0) throw new Error(`cannot read check/ from ${tarball}: ${r.stderr}`);
      writeFileSync(resolve(dir, "done"), "");
    }
    for (const f of readdirSync(dir)) cache.set(f, readFileSync(resolve(dir, f), "utf8"));
  }
  const t = cache.get(path);
  if (t === undefined) throw new Error(`no check/${path} in ${tarball}`);
  return t;
}

export interface Pair {
  /** "<set>#<n>", n counting from 1: the id the known-differences file uses */
  id: string;
  input: string;
  expected: string | null;
}

/** The inputs of a set with their answers (null where the .out is shorter than the inputs). */
export function loadSet(tarball: string, set: string): Pair[] {
  const inputs = splitInputs(member(tarball, `test${set}`));
  const outs = splitOutputs(member(tarball, `${set}.out`));
  let at = 0; // an input with k statements has k answers in the .out
  return inputs.map((input, i) => {
    const k = statementCount(input);
    const parts = outs.slice(at, at + k);
    at += k;
    return { id: `${set}#${i + 1}`, input, expected: parts.length === k ? parts.join(",") : null };
  });
}
