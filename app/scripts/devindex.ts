// SPDX-License-Identifier: GPL-3.0-or-later
// `npm run dev` (predev): rebuild the Find index (src/find/_gen/find-index.json) when one of its sources is newer than it,
// or it is missing; otherwise do nothing (A68). One line says which. The sources are what tools/find-index/generate.mjs reads:
// find/*.yaml, tools/find-index/**, tests/golden/*.yaml and the two pinned tarballs (state.mjs SOURCES, when present).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(here, "..");
const repo = resolve(appDir, "..");

/** Every file below `dir` (a missing folder gives none), or those directly in it when `deep` is false; `ext` filters by suffix. */
function files(dir: string, deep: boolean, ext = ""): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (deep && e.name !== "node_modules") out.push(...files(p, deep, ext));
    } else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

/** The files whose change makes the index stale. `tarballs` are the pinned downloads (taken as they are, when they exist). */
export function indexSources(root: string, tarballs: string[]): string[] {
  return [
    ...files(join(root, "find"), false, ".yaml"),
    ...files(join(root, "tools/find-index"), true),
    ...files(join(root, "tests/golden"), false, ".yaml"),
    ...tarballs.filter((t) => existsSync(t)),
  ];
}

/** Why the index must be rebuilt (a short text), or null when it is newer than every source. */
export function staleReason(index: string, sources: string[]): string | null {
  if (!existsSync(index)) return "missing";
  const built = statSync(index).mtimeMs;
  const newer = sources.find((s) => statSync(s).mtimeMs > built);
  return newer === undefined ? null : `${newer} is newer`;
}

export interface Deps {
  index: string;
  sources: string[];
  /** Runs `npm run index`; returns its exit code. */
  generate: () => number;
  log: (line: string) => void;
}

/** Returns the exit code: 0 when the index is fresh or was rebuilt. */
export function refreshIndex(d: Deps): number {
  const why = staleReason(d.index, d.sources);
  if (why === null) {
    d.log("find index: up to date, not rebuilt");
    return 0;
  }
  d.log(`find index: rebuilding (${why})`);
  const code = d.generate();
  d.log(code === 0 ? "find index: rebuilt" : `find index: rebuild FAILED (exit ${code})`);
  return code;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // the pinned tarballs: where generate.mjs looks (state.mjs SOURCES); a worktree falls back to nothing, the generator then says what is missing
  const dl = (env: string, sub: string, file: string): string => join(process.env[env] ?? join(repo, sub), file);
  process.exitCode = refreshIndex({
    index: join(appDir, "src/find/_gen/find-index.json"),
    sources: indexSources(repo, [
      dl("PASCALINE_DL_DIR", "engine/giac/_downloads", "giac_2.1.0-1.tar.gz"),
      dl("PASCALINE_QALC_DL_DIR", "engine/qalc/_downloads", "libqalculate-5.13.1.tar.gz"),
    ]),
    generate: () => spawnSync("npm", ["run", "index"], { cwd: appDir, stdio: "inherit" }).status ?? 1,
    log: (l) => console.log(l),
  });
}
