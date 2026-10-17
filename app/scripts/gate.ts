// SPDX-License-Identifier: GPL-3.0-or-later
// `npm run gate`: every check a branch must pass (docs/shifts/brief.md section 8), one line each, the full log in
// app/_out/gate/<name>.log. Exit 1 on any FAIL.
//   npm run gate            # typecheck, index (when missing), vitest (FIND_INDEX=required), e2e, golden (when engine or
//                           # parser code changed against phase-1), size test, docs sizes
//   npm run gate -- --quick # typecheck and vitest only
// Environment: GIAC_OUT (absolute; default engine/giac/_out/gsl of this or the main checkout) for e2e and golden,
// QALC_OUT, PASCALINE_DL_DIR and PASCALINE_QALC_DL_DIR for `npm run index` (default: the main checkout's), PW_PORT for e2e's dev server, GATE_BASE (default phase-1) for the changed-files diff.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  duration, formatLine, playwrightFailures, summarizeDocs, summarizeGolden, summarizePlaywright, summarizeSize, summarizeTypecheck, summarizeVitest, vitestFailures,
  type DocSize, type Summary,
} from "./gate-summary.ts";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(app, "..");
const outDir = join(app, "_out/gate");
const quick = process.argv.includes("--quick");
const base = process.env["GATE_BASE"] ?? "phase-1";

interface Ran {
  code: number;
  out: string;
}

/** Runs a command, writes its whole output to _out/gate/<log>.log and returns it. A timeout counts as a failure. */
function run(log: string, cmd: string, args: string[], env: Record<string, string> = {}, timeoutMs = 30 * 60_000, cwd = app): Ran {
  const r = spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, encoding: "utf8", timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024 });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? `\n${r.error.message}\n` : ""}`;
  writeFileSync(join(outDir, `${log}.log`), `$ ${cmd} ${args.join(" ")}\n${out}`);
  return { code: r.status ?? 1, out };
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** The engine for e2e and golden: $GIAC_OUT, else this checkout's build, else the main checkout's (a worktree). */
function giacOut(): string | null {
  const env = process.env["GIAC_OUT"];
  if (env) return isAbsolute(env) ? env : resolve(env);
  const candidates = [join(repo, "engine/giac/_out/gsl"), join(mainCheckout, "engine/giac/_out/gsl")];
  return candidates.find((c) => existsSync(join(c, "giac.mjs"))) ?? null;
}

/** The main checkout (the first worktree): where the shared download cache and engine builds live when this is a worktree. */
const mainCheckout = ((): string => {
  const common = spawnSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: repo, encoding: "utf8" }).stdout.trim();
  return common ? resolve(common, "..") : repo;
})();

const changed = ((): string[] => {
  const r = spawnSync("git", ["diff", "--name-only", `${base}...`], { cwd: repo, encoding: "utf8" });
  return r.status === 0 ? r.stdout.split("\n").filter(Boolean) : [];
})();
/** Engine-side or parser code: what the golden gate checks (CLAUDE.md: every engine build; brief section 8a step 3). */
const goldenPaths = [/^engine\/giac\//, /^app\/src\/engine\//, /^app\/src\/input\//, /^tests\/golden\//, /^app\/scripts\/golden\.ts$/];

interface Check {
  name: string;
  skip?: () => string | null;
  run: () => Summary;
}

const checks: Check[] = [
  {
    name: "typecheck",
    run: () => {
      const r = run("typecheck", "npm", ["run", "typecheck"]);
      return summarizeTypecheck(r.out, r.code);
    },
  },
  {
    name: "index",
    skip: () => (existsSync(join(app, "src/find/_gen/find-index.json")) ? "present" : null),
    run: () => {
      // in a worktree: the main checkout's tarball cache and libqalculate build (rules section 5)
      const r = run("index", "npm", ["run", "index"], {
        PASCALINE_DL_DIR: process.env["PASCALINE_DL_DIR"] ?? join(mainCheckout, "engine/giac/_downloads"),
        PASCALINE_QALC_DL_DIR: process.env["PASCALINE_QALC_DL_DIR"] ?? join(mainCheckout, "engine/qalc/_downloads"),
        QALC_OUT: process.env["QALC_OUT"] ?? join(mainCheckout, "engine/qalc/_out/dev"),
      });
      return { ok: r.code === 0, detail: r.code === 0 ? "generated" : `exit ${r.code}: ${r.out.trim().split("\n").slice(-1)[0]}` };
    },
  },
  {
    name: "vitest",
    run: () => {
      const json = join(outDir, "vitest.json");
      const go = (files: string[] = []): Summary => {
        rmSync(json, { force: true });
        run("vitest", "npx", ["vitest", "run", "--reporter=json", `--outputFile=${json}`, ...files], { FIND_INDEX: "required" });
        return summarizeVitest(readJson(json));
      };
      const first = go();
      if (first.ok) return first;
      // A wall-clock test (the Find query's p95) fails when the whole suite runs in parallel on this machine, which is the
      // gate's own load. Only those tests are run once more, alone; any other failure stays a FAIL.
      const failed = vitestFailures(readJson(json));
      if (failed.length > 0 && failed.every((f) => /takes well under/.test(f.title))) {
        const again = go([...new Set(failed.map((f) => f.file))]);
        if (again.ok) return { ok: true, detail: `${again.detail} (timing test re-run alone: ${failed.map((f) => f.title.slice(0, 40)).join(", ")})` };
      }
      return first;
    },
  },
  {
    name: "e2e",
    skip: () => (quick ? "--quick" : null),
    run: () => {
      const engine = giacOut();
      if (!engine) return { ok: false, detail: "no engine build: set GIAC_OUT (absolute)" };
      const json = join(outDir, "e2e.json");
      const go = (extra: string[] = []): Summary => {
        rmSync(json, { force: true });
        run("e2e", "npx", ["playwright", "test", "--reporter=json", ...extra], { GIAC_OUT: engine, PLAYWRIGHT_JSON_OUTPUT_NAME: json });
        return summarizePlaywright(readJson(json));
      };
      const first = go();
      if (first.ok) return first;
      // brief section 8: the known-flaky persistence test of solve.spec.ts may be re-run once, and only it
      const failed = playwrightFailures(readJson(json));
      if (failed.length > 0 && failed.every((f) => f.startsWith("solve.spec.ts"))) {
        const again = go(["solve.spec.ts"]);
        if (again.ok) return { ok: true, detail: `${again.detail} (solve.spec.ts re-run once, it was flaky: ${failed.join(", ")})` };
      }
      return first;
    },
  },
  {
    name: "golden",
    skip: () => {
      if (quick) return "--quick";
      const hit = changed.filter((f) => goldenPaths.some((p) => p.test(f)));
      return hit.length === 0 ? `no engine or parser change against ${base}` : null;
    },
    run: () => {
      const engine = giacOut();
      if (!engine) return { ok: false, detail: "no engine build: set GIAC_OUT (absolute)" };
      const r = run("golden", "npm", ["run", "golden"], { GIAC_OUT: engine });
      return summarizeGolden(r.out, r.code);
    },
  },
  {
    name: "size",
    skip: () => (quick ? "--quick" : null),
    run: () => {
      const engine = giacOut();
      const b = run("size-build", "npm", ["run", "engine:copy"], engine ? { GIAC_OUT: engine } : {});
      const v = b.code === 0 ? run("size-build", "npx", ["vite", "build"]) : b;
      if (v.code !== 0) return { ok: false, detail: `build failed (exit ${v.code}), see size-build.log` };
      const r = run("size", "node", ["scripts/size-check.ts"]);
      return summarizeSize(r.out, r.code);
    },
  },
  {
    name: "docs",
    skip: () => (quick ? "--quick" : null),
    run: () => {
      // S7 sets the budgets (brief S7 step: brief ≤ 25 kB, backlog ≤ 20 kB, decisions ≤ 40 kB, docs/04 ≤ 70 kB); until then: sizes only
      const files = ["docs/shifts/brief.md", "docs/backlog.md", "docs/decisions.md", "docs/04-architecture.md"];
      const sizes: DocSize[] = files.map((f) => ({ file: f.replace(/^docs\//, ""), bytes: statSync(join(repo, f)).size, limit: null }));
      return summarizeDocs(sizes);
    },
  },
];

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
let failed = 0;
const started = Date.now();
for (const c of checks) {
  const why = c.skip?.() ?? null;
  if (why !== null) {
    console.log(`SKIP ${c.name} ${why}`);
    continue;
  }
  const t = Date.now();
  let s: Summary;
  try {
    s = c.run();
  } catch (e) {
    s = { ok: false, detail: `gate error: ${(e as Error).message}` };
  }
  if (!s.ok) failed++;
  console.log(formatLine(c.name, s, Date.now() - t));
}
console.log(failed === 0 ? `GATE PASSED (${duration(Date.now() - started)})` : `GATE FAILED: ${failed} check${failed > 1 ? "s" : ""} (${duration(Date.now() - started)}); logs in app/_out/gate/`);
process.exit(failed === 0 ? 0 : 1);
